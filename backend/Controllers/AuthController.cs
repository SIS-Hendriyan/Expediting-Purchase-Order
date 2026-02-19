// ============================================================
// FILE: AuthController.cs
// Routes:
//   POST /api/auth/login
//   POST /api/auth/verify-otp
//   POST /api/auth/register/vendor
// ============================================================

using EXPOAPI.Models;              // VendorLoginResult, etc.
using EXPOAPI.Services;            // AuthService, IVendorOtpEmailSender
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace EXPOAPI.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthService _auth;
    private readonly IVendorOtpEmailSender _otpEmail;
    private readonly IConfiguration _config;

    public AuthController(AuthService auth, IVendorOtpEmailSender otpEmail, IConfiguration config)
    {
        _auth = auth ?? throw new ArgumentNullException(nameof(auth));
        _otpEmail = otpEmail ?? throw new ArgumentNullException(nameof(otpEmail));
        _config = config ?? throw new ArgumentNullException(nameof(config));
    }

    // =========================
    // POST /api/auth/login
    // body: { userName/username/UserName/nrp, password/Password }
    // =========================
    [HttpPost("login")]
    public async Task<IActionResult> LoginUnified([FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
    {
        payload ??= new Dictionary<string, object?>();

        var rawUsername =
            GetString(payload, "userName")
            ?? GetString(payload, "username")
            ?? GetString(payload, "UserName")
            ?? GetString(payload, "nrp")
            ?? "";

        var userName = rawUsername.Trim();
        var password = GetString(payload, "password") ?? GetString(payload, "Password") ?? "";

        if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
            return Fail("userName dan password wajib diisi", 400);

        // ========= VENDOR FLOW =========
        if (userName.Contains("@"))
        {
            VendorLoginResult? result;
            try
            {
                result = await _auth.AuthenticateVendorAsync(userName, password, ct);
            }
            catch (Exception ex)
            {
                return Fail($"internal error (vendor): {GetInner(ex).Message}", 500);
            }

            if (result is null)
                return Fail("email atau password salah", 401);

            var profile = result.profile;

            var otpEmail = profile?.Email ?? result.account.email;
            var otpCode = profile?.OTP ?? "";

            // default: return object account+profile
            object data = new
            {
                account = result.account,
                profile = result.profile
            };

            // Flask behavior: if OTP exists -> send email and return "VENDOR"
            if (!string.IsNullOrWhiteSpace(otpEmail) && !string.IsNullOrWhiteSpace(otpCode))
            {
                try
                {
                    await _otpEmail.SendVendorOtpEmailAsync(otpEmail, otpCode, ct);
                }
                catch (Exception ex)
                {
                    // kalau email gagal, masih bisa login? kamu bisa pilih:
                    // - tetap 200 tapi info gagal email, atau
                    // - 500
                    return Fail($"gagal mengirim OTP email: {GetInner(ex).Message}", 500);
                }

                data = "VENDOR";
            }

            return Success("login vendor berhasil", data);
        }

        // ========= INTERNAL FLOW =========
        Dictionary<string, object>? resDict;
        try
        {
            resDict = await _auth.AuthenticateInternalAsync(userName, password, ct);
        }
        catch (OperationCanceledException)
        {
            // biasanya timeout / request aborted
            return Fail("request timeout saat autentikasi internal", 408);
        }
        catch (Exception ex)
        {
            return Fail($"internal error (internal): {GetInner(ex).Message}", 500);
        }

        if (resDict is null)
            return Fail("nrp/username atau password salah", 401);

        var identity =
            GetObjString(resDict, "nrp")
            ?? GetObjString(resDict, "email")
            ?? userName;

        var claims = new Dictionary<string, string?>
        {
            ["type"] = "INTERNAL",
            ["id"] = GetObjString(resDict, "id"),
            ["nrp"] = GetObjString(resDict, "nrp"),
            ["email"] = GetObjString(resDict, "email"),
            ["name"] = GetObjString(resDict, "name"),
            ["role"] = GetObjString(resDict, "role"),
            ["department"] = GetObjString(resDict, "department"),
            ["jobsite"] = GetObjString(resDict, "jobsite"),
        };

        var accessToken = CreateJwt(identity, claims, isRefresh: false);
        var refreshToken = CreateJwt(identity, claims, isRefresh: true);

        var dataInternal = new
        {
            token = new { access = accessToken, refresh = refreshToken },
            @internal = resDict   // rename: internal_user -> internal
        };

        return Success("login internal berhasil", dataInternal);
    }

    // =========================
    // POST /api/auth/verify-otp
    // body: { email, otp }
    // =========================
    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
    {
        payload ??= new Dictionary<string, object?>();

        var email = (GetString(payload, "email") ?? "").Trim();
        var otp = (GetString(payload, "otp") ?? "").Trim();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(otp))
            return Fail("email dan otp wajib diisi", 400);

        VendorLoginResult? result;
        try
        {
            result = await _auth.VerifyVendorOtpAsync(email, otp, ct);
        }
        catch (Exception ex)
        {
            return Fail($"internal error (verify-otp): {GetInner(ex).Message}", 500);
        }

        if (result is null)
            return Fail("otp tidak valid", 401);

        var identity = result.account.vendor_id ?? result.account.email ?? email;

        var claims = new Dictionary<string, string?>
        {
            ["type"] = "VENDOR",
            ["email"] = result.account.email ?? email,
            ["vendor_id"] = result.account.vendor_id
        };

        var accessToken = CreateJwt(identity, claims, isRefresh: false);
        var refreshToken = CreateJwt(identity, claims, isRefresh: true);

        // remove OTP field from profile (match Flask: profile.pop("OTP"))
        var vendorData = new
        {
            account = result.account,
            profile = result.profile is null ? null : new
            {
                result.profile.VendorID,
                result.profile.Email,
                result.profile.VendorName,
                result.profile.CompleteName,
                result.profile.UserName,
                OTP = (string?)null,
                result.profile.OtpExpiresAt,
                result.profile.IsAccess
            }
        };

        var data = new
        {
            token = new { access = accessToken, refresh = refreshToken },
            vendor = vendorData
        };

        return Success("OTP terverifikasi", data);
    }

    // =========================
    // POST /api/auth/register/vendor
    // body: { email, password, complete_name, username }
    // =========================
    [HttpPost("register/vendor")]
    public async Task<IActionResult> RegisterVendor([FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
    {
        payload ??= new Dictionary<string, object?>();

        var email = (GetString(payload, "email") ?? "").Trim();
        var password = GetString(payload, "password") ?? "";
        var completeName = (GetString(payload, "complete_name") ?? "").Trim();
        var username = (GetString(payload, "username") ?? "").Trim();

        if (string.IsNullOrWhiteSpace(username) && email.Contains("@"))
            username = email.Split('@')[0];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            return Fail("email dan password wajib diisi", 400);

        string vendorId;
        try
        {
            vendorId = await _auth.RegisterVendorAsync(
                email: email,
                rawPassword: password,
                completeName: completeName,
                userName: username,
                iterations: null,
                ct: ct
            );
        }
        catch (ArgumentException ex)
        {
            return Fail(ex.Message, 400);
        }
        catch (Exception ex)
        {
            return Fail($"gagal mendaftarkan vendor: {GetInner(ex).Message}", 500);
        }

        var data = new
        {
            id = vendorId,
            email,
            complete_name = completeName,
            username
        };

        return Success("registrasi vendor berhasil", data, 201);
    }

    // =========================================================
    // Standard Response Wrapper
    // =========================================================
    private IActionResult Success(string message, object? Data, int statusCode = 200)
        => StatusCode(statusCode, new
        {
            success = true,
            ResponseCode = statusCode,
            Message = message,
            Data
        });

    private IActionResult Fail(string message, int statusCode, object? Data = null)
        => StatusCode(statusCode, new
        {
            success = true,
            ResponseCode = statusCode,
            Message = message,
            Data
        });

    // =========================================================
    // Utilities
    // =========================================================
    private static Exception GetInner(Exception ex) => ex.InnerException ?? ex;

    private static string? GetString(Dictionary<string, object?> dict, string key)
        => dict.TryGetValue(key, out var v) ? v?.ToString() : null;

    private static string? GetObjString(Dictionary<string, object> dict, string key)
        => dict.TryGetValue(key, out var v) ? v?.ToString() : null;

    // =========================================================
    // JWT create (access + refresh)
    // appsettings.json:
    // "Jwt": { "Key": "...", "Issuer": "...", "Audience": "...", "AccessMinutes": 60, "RefreshDays": 30 }
    // =========================================================
    private string CreateJwt(string identity, Dictionary<string, string?> claims, bool isRefresh)
    {
        var jwt = _config.GetSection("Jwt");

        var key = jwt["Key"] ?? throw new InvalidOperationException("Jwt:Key missing");
        var issuer = jwt["Issuer"] ?? "expoapi";
        var audience = jwt["Audience"] ?? "expoapi-client";

        var accessMinutes = int.TryParse(jwt["AccessMinutes"], out var am) ? am : 60;
        var refreshDays = int.TryParse(jwt["RefreshDays"], out var rd) ? rd : 30;

        var expires = isRefresh
            ? DateTime.UtcNow.AddDays(refreshDays)
            : DateTime.UtcNow.AddMinutes(accessMinutes);

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var creds = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var jwtClaims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, identity),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("identity", identity),
            new("token_type", isRefresh ? "refresh" : "access")
        };

        foreach (var kv in claims)
        {
            if (!string.IsNullOrWhiteSpace(kv.Key) && kv.Value != null)
                jwtClaims.Add(new Claim(kv.Key, kv.Value));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: jwtClaims,
            expires: expires,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
