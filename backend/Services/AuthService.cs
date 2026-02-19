using System;
using System.Collections.Generic;
using System.Data;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;


public sealed class AuthService
{
    private readonly IDbConnectionFactory _db;
    private readonly PasswordHasher<object> _hasher;

    public AuthService(IDbConnectionFactory db, IOptions<AuthHashOptions> hashOptions)
    {
        _db = db ?? throw new ArgumentNullException(nameof(db));

        var opt = new PasswordHasherOptions
        {
            CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
            IterationCount = hashOptions?.Value?.IterationCount ?? 100_000
        };
        _hasher = new PasswordHasher<object>(Options.Create(opt));
    }

    // =========================
    // UNIFIED ENTRY POINT
    // =========================
    public async Task<object?> AuthenticateAsync(string identifier, string password, CancellationToken ct = default)
    {
        identifier = (identifier ?? "").Trim();
        password = password ?? "";

        if (string.IsNullOrWhiteSpace(identifier) || string.IsNullOrEmpty(password))
            return null;

        if (identifier.Contains("@"))
            return await AuthenticateVendorAsync(identifier, password, ct);

        return await AuthenticateInternalAsync(identifier, password, ct);
    }

    // =========================
    // VENDOR AUTHENTICATION
    // =========================
    public async Task<VendorLoginResult?> AuthenticateVendorAsync(string email, string password, CancellationToken ct = default)
    {
        email = (email ?? "").Trim();
        password = password ?? "";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(password))
            return null;

        using var cn = _db.CreateVendor();

        const string sql = @"
SELECT
    CAST(Id AS nvarchar(50)) AS Id,
    CompleteName,
    Email,
    PasswordHash,
    IsActive
FROM dbo.APP_USERS_T
WHERE Email = @Email;
";

        var row = await cn.QuerySingleOrDefaultAsync<VendorUserRow>(
            new CommandDefinition(sql, new { Email = email }, cancellationToken: ct)
        );

        if (row is null) return null;
        if (!row.IsActive) return null;
        if (string.IsNullOrWhiteSpace(row.PasswordHash)) return null;

        if (!VerifyIdentityV3(row.PasswordHash!, password))
            return null;

        var account = new VendorAccount(
            vendor_id: row.Id ?? "",
            complete_name: row.CompleteName ?? "",
            email: row.Email ?? ""
        );

        var profile = await FetchVendorProfileAsync(account.vendor_id, ct);
        return new VendorLoginResult(account: account, profile: profile);
    }

    // =========================
    // INTERNAL AUTHENTICATION
    // =========================
    public async Task<Dictionary<string, object>?> AuthenticateInternalAsync(
     string nrp, string password, CancellationToken ct = default)
    {
        nrp = (nrp ?? "").Trim();
        password = password ?? "";

        if (string.IsNullOrWhiteSpace(nrp) || string.IsNullOrEmpty(password))
            return null;

        using var cn = _db.CreateMain();

        const string sql = @"
SELECT TOP (1)
    CAST([ID_User] AS nvarchar(50)) AS Id,
    [NRP],
    ISNULL([Email], '')      AS Email,
    ISNULL([Nama], '')       AS Nama,
    ISNULL([Role], '')       AS [Role],
    ISNULL([Department], '') AS Department,
    ISNULL([Jobsite], '')    AS Jobsite,
    [Password]               AS PasswordHash,
    [IsActive]               AS IsActive
FROM [exp].[INT_USER_T]
WHERE [NRP] = @NRP;
";

        var row = await cn.QuerySingleOrDefaultAsync<InternalUserRow>(
            new CommandDefinition(sql, new { NRP = nrp }, cancellationToken: ct)
        );

        if (row is null) return null;
        if (!row.IsActive) return null;
        if (string.IsNullOrWhiteSpace(row.PasswordHash)) return null;

        if (!VerifyIdentityV3(row.PasswordHash!, password))
            return null;

        // RETURN FLAT DICTIONARY (tanpa "account")
        return new Dictionary<string, object>
        {
            ["id"] = row.Id ?? "",
            ["nrp"] = row.NRP ?? "",
            ["email"] = row.Email ?? "",
            ["name"] = row.Nama ?? "",
            ["role"] = row.Role ?? "",
            ["department"] = row.Department ?? "",
            ["jobsite"] = row.Jobsite ?? ""
        };
    }


    // =========================
    // REGISTER VENDOR
    // =========================
    public async Task<string> RegisterVendorAsync(
        string email,
        string rawPassword,
        string completeName,
        string userName,
        int? iterations = null,
        CancellationToken ct = default)
    {
        email = (email ?? "").Trim();
        completeName = (completeName ?? "").Trim();
        userName = (userName ?? "").Trim();
        rawPassword = rawPassword ?? "";

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrEmpty(rawPassword))
            throw new ArgumentException("email & password wajib");

        var passwordHash = HashIdentityV3(rawPassword, iterations);

        using var cn = _db.CreateVendor();

        const string sql = @"
INSERT INTO dbo.APP_USERS_T(Email, CompleteName, UserName, PasswordHash, IsActive)
VALUES(@Email, @CompleteName, @UserName, @PasswordHash, 1);
SELECT CAST(SCOPE_IDENTITY() AS nvarchar(50));
";

        var id = await cn.ExecuteScalarAsync<string>(
            new CommandDefinition(sql, new
            {
                Email = email,
                CompleteName = completeName,
                UserName = userName,
                PasswordHash = passwordHash
            }, cancellationToken: ct)
        );

        return id ?? "";
    }

    // =========================
    // VERIFY VENDOR OTP (SP)
    // =========================
    public async Task<VendorLoginResult?> VerifyVendorOtpAsync(string email, string otp, CancellationToken ct = default)
    {
        email = (email ?? "").Trim();
        otp = (otp ?? "").Trim();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(otp))
            return null;

        using var cn = _db.CreateMain();

        // SP exp.VerifyVendorOTP(Email, OTP)
        var data = await cn.QuerySingleOrDefaultAsync<VerifyVendorOtpRow>(
            new CommandDefinition(
                "exp.VerifyVendorOTP",
                new { Email = email, OTP = otp },
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            )
        );

        if (data is null) return null;

        var status = (data.StatusCode ?? "").Trim().ToUpperInvariant();
        if (status != "SUCCESS") return null;

        var profile = new VendorProfile(
            VendorID: data.VendorID ?? "",
            Email: data.Email ?? "",
            VendorName: data.VendorName ?? "",
            CompleteName: data.CompleteName ?? "",
            UserName: data.UserName ?? "",
            OTP: "",
            OtpExpiresAt: null,
            IsAccess: true
        );

        var account = new VendorAccount(
            vendor_id: profile.VendorID,
            complete_name: profile.CompleteName,
            email: string.IsNullOrWhiteSpace(profile.Email) ? email : profile.Email
        );

        return new VendorLoginResult(account: account, profile: profile);
    }

    // =========================
    // Helper: fetch vendor profile + generate OTP (SP)
    // =========================
    private async Task<VendorProfile?> FetchVendorProfileAsync(string vendorId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(vendorId))
            return null;

        var otp = GenerateOtp6();

        using var cn = _db.CreateMain();

        // SP exp.UpdateVendorOtp(VendorID, OTP)
        var row = await cn.QuerySingleOrDefaultAsync<VendorProfileRow>(
            new CommandDefinition(
                "exp.UpdateVendorOtp",
                new { VendorID = vendorId, OTP = otp },
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            )
        );

        if (row is null) return null;

        // Mapping: sesuaikan dengan output SELECT SP kamu
        return new VendorProfile(
            VendorID: row.VendorID ?? vendorId,
            Email: row.Email ?? "",
            VendorName: row.VendorName ?? "",
            CompleteName: row.CompleteName ?? "",
            UserName: row.UserName ?? "",
            OTP: row.OTP ?? otp,
            OtpExpiresAt: row.OtpExpiresAt,
            IsAccess: row.IsAccess ?? true
        );
    }

    // =========================
    // Identity v3 helpers
    // =========================
    private bool VerifyIdentityV3(string hashedPassword, string providedPassword)
    {
        var res = _hasher.VerifyHashedPassword(null!, hashedPassword, providedPassword);
        return res != PasswordVerificationResult.Failed;
    }

    private string HashIdentityV3(string rawPassword, int? iterationsOverride)
    {
        if (iterationsOverride is null || iterationsOverride <= 0)
            return _hasher.HashPassword(null!, rawPassword);

        var opt = new PasswordHasherOptions
        {
            CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
            IterationCount = iterationsOverride.Value
        };
        var hasher = new PasswordHasher<object>(Options.Create(opt));
        return hasher.HashPassword(null!, rawPassword);
    }

    private static string GenerateOtp6()
    {
        var num = RandomNumberGenerator.GetInt32(0, 1_000_000);
        return num.ToString("D6");
    }

   
   

   
   
}
public sealed class AuthHashOptions
{
    public int IterationCount { get; set; } = 100_000;
}
