
using Dapper;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{
    public  class AuthHashOptions
    {
        public int IterationCount { get; set; } = 100_000;
    }

    public  class InternalUserService : IInternalUserService
    {
        private const string SP_USER_IUD = "[exp].[INT_USER_IUD]";
        private const string SP_USER_GET = "[exp].[INT_USER_Get]";

        private static readonly string[] SummaryKeys = { "TotalUsers", "TotalAdmin", "TotalPurchaser", "TotalUser" };

        private readonly IDbConnectionFactory _db;
        private readonly PasswordHasher<object> _hasher;

        public InternalUserService(IDbConnectionFactory db, IOptions<AuthHashOptions> hashOptions)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));

            var opt = new PasswordHasherOptions
            {
                CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3,
                IterationCount = hashOptions?.Value?.IterationCount ?? 100_000
            };

            _hasher = new PasswordHasher<object>(Options.Create(opt));
        }

        // =========================================================
        // CRUD via SP_USER_IUD
        // =========================================================
        public Task<Dictionary<string, object?>> CreateUserAsync(
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default)
        {
            var actor = GetActor(payload, "CreatedBy", user);

            var p = new Dictionary<string, object?>
            {
                ["NRP"] = Get(payload, "NRP"),
                ["Email"] = Get(payload, "Email"),
                ["Nama"] = Get(payload, "Nama"),
                ["Role"] = Get(payload, "Role"),
                ["Department"] = Get(payload, "Department"),
                ["Jobsite"] = Get(payload, "Jobsite"),
                ["IsActive"] = NormalizeBool(Get(payload, "IsActive")),
                ["CreatedBy"] = actor
            };

            var passwordHash = PreparePassword(Get(payload, "Password")?.ToString());
            if (!string.IsNullOrWhiteSpace(passwordHash))
                p["Password"] = passwordHash;

            return ExecuteUserIudAsync("INSERT", p, ct);
        }

        public Task<Dictionary<string, object?>> UpdateUserAsync(
            int userId,
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default)
        {
            var actor = GetActor(payload, "UpdatedBy", user);

            var p = new Dictionary<string, object?>
            {
                ["ID_User"] = userId,
                ["NRP"] = Get(payload, "NRP"),
                ["Email"] = Get(payload, "Email"),
                ["Nama"] = Get(payload, "Nama"),
                ["Role"] = Get(payload, "Role"),
                ["Department"] = Get(payload, "Department"),
                ["Jobsite"] = Get(payload, "Jobsite"),
                ["IsActive"] = NormalizeBool(Get(payload, "IsActive")),
                ["UpdatedBy"] = actor
            };

            var passwordHash = PreparePassword(Get(payload, "Password")?.ToString());
            if (!string.IsNullOrWhiteSpace(passwordHash))
                p["Password"] = passwordHash;

            return ExecuteUserIudAsync("UPDATE", p, ct);
        }

        public Task<Dictionary<string, object?>> DeleteUserAsync(
            int userId,
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default)
        {
            var actor = GetActor(payload, "DiscardBy", user);

            var p = new Dictionary<string, object?>
            {
                ["ID_User"] = userId,
                ["DiscardBy"] = actor
            };

            return ExecuteUserIudAsync("DELETE", p, ct);
        }

        // =========================================================
        // Queries via SP_USER_GET (multiple result sets)
        // =========================================================
        public async Task<Dictionary<string, object?>> ListUsersAsync(CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            using var grid = await cn.QueryMultipleAsync(
                new CommandDefinition(
                    SP_USER_GET,
                    new { Type = "LIST" },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            // Result set #1: Users
            var usersRows = (await grid.ReadAsync<dynamic>()).ToList();
            var users = usersRows.Select(ToDict).ToList();

            // Result set #2: Summary (optional)
            Dictionary<string, object?> summary = CreateDefaultSummary();
            var summaryRow = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
            if (summaryRow != null)
            {
                var s = ToDict(summaryRow);
                foreach (var k in SummaryKeys)
                {
                    if (s.TryGetValue(k, out object? v))
                        summary[k] = v ?? 0;
                    else
                        summary[k] = 0;
                }
            }

            return new Dictionary<string, object?>
            {
                ["users"] = users,
                ["summary"] = summary
            };
        }

        public async Task<Dictionary<string, object?>?> GetUserDetailAsync(int userId, CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            using var grid = await cn.QueryMultipleAsync(
                new CommandDefinition(
                    SP_USER_GET,
                    new { Type = "DETAIL", ID_User = userId },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            var row = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
            return row == null ? null : ToDict(row);
        }

        private static DynamicParameters BuildDp(string action, Dictionary<string, object?> parameters)
        {
            var dp = new DynamicParameters();
            dp.Add("@Action", (action ?? "").ToUpperInvariant());

            foreach (var kv in parameters)
                dp.Add("@" + kv.Key, UnwrapJson(kv.Value));

            return dp;
        }
        // =========================================================
        // Core: Execute IUD (scan multiple result sets; return first row found)
        // =========================================================
        private async Task<Dictionary<string, object?>> ExecuteUserIudAsync(
    string action,
    Dictionary<string, object?> parameters,
    CancellationToken ct)
        {
            using var cn = _db.CreateMain();
            var act = (action ?? "").ToUpperInvariant();
            var dp = BuildDp(act, parameters);

            // INSERT: SP kamu melakukan SELECT SCOPE_IDENTITY() AS NewID_User;
            if (act == "INSERT")
            {
                var row = await cn.QueryFirstOrDefaultAsync<dynamic>(
                    new CommandDefinition(
                        SP_USER_IUD,
                        dp,
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: ct
                    )
                );

                // kalau row null, tetap return status
                if (row is null)
                    return new Dictionary<string, object?> { ["success"] = false, ["message"] = "No result returned from INSERT." };

                return ToDict(row);
            }

            // UPDATE / DELETE: SP tidak SELECT, jadi pakai ExecuteAsync untuk dapat rowcount
            var affected = await cn.ExecuteAsync(
                new CommandDefinition(
                    SP_USER_IUD,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            return new Dictionary<string, object?>
            {
                ["success"] = affected > 0,
                ["action"] = act,
                ["affectedRows"] = affected,
                ["ID_User"] = parameters.TryGetValue("ID_User", out var id) ? UnwrapJson(id) : null
            };
        }




        private static object? UnwrapJson(object? value)
        {
            if (value is null) return null;

            if (value is JsonElement je)
            {
                return je.ValueKind switch
                {
                    JsonValueKind.String => je.GetString(),
                    JsonValueKind.Number => je.TryGetInt64(out var l) ? l
                                         : je.TryGetDecimal(out var d) ? d
                                         : je.GetDouble(),
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Null => null,
                    JsonValueKind.Undefined => null,
                    // Object/Array tidak bisa langsung jadi parameter SQL: pakai raw json
                    JsonValueKind.Object or JsonValueKind.Array => je.GetRawText(),
                    _ => je.ToString()
                };
            }

            return value;
        }

        // =========================================================
        // Helpers (mirror your Python)
        // =========================================================
        private string? PreparePassword(string? rawPassword)
        {
            if (string.IsNullOrWhiteSpace(rawPassword)) return null;
            return _hasher.HashPassword(null!, rawPassword);
        }

        private static Dictionary<string, object?> CreateDefaultSummary()
        {
            return new Dictionary<string, object?>
            {
                ["TotalUsers"] = 0,
                ["TotalAdmin"] = 0,
                ["TotalPurchaser"] = 0,
                ["TotalUser"] = 0
            };
        }

        private static object? NormalizeBool(object? value)
        {
            if (value is null) return null;
            if (value is bool b) return b;
            if (value is byte by) return by != 0;
            if (value is short sh) return sh != 0;
            if (value is int i) return i != 0;
            if (value is long l) return l != 0;
            if (value is decimal d) return d != 0;
            if (value is double db) return Math.Abs(db) > 0;

            if (value is string s)
            {
                var lowered = s.Trim().ToLowerInvariant();
                if (lowered is "true" or "1" or "yes" or "y") return true;
                if (lowered is "false" or "0" or "no" or "n") return false;
                return lowered.Length > 0;
            }

            return true;
        }

        private static string GetActor(Dictionary<string, object?> payload, string key, ClaimsPrincipal? user)
        {
            // 1) From payload
            var fromPayload = Get(payload, key)?.ToString();
            if (!string.IsNullOrWhiteSpace(fromPayload))
                return fromPayload;

            // 2) From claims
            var identity = user?.FindFirstValue("identity")
                        ?? user?.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user?.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return identity ?? "";
        }

        private static object? Get(Dictionary<string, object?> payload, string key)
            => payload != null && payload.TryGetValue(key, out var v) ? v : null;

        /// <summary>
        /// Convert Dapper dynamic row into Dictionary<string, object?>
        /// Handles DapperRow and fallback reflection.
        /// </summary>
        private static Dictionary<string, object?> ToDict(dynamic row)
        {
            if (row is null)
                return new Dictionary<string, object?>();

            // DapperRow: IDictionary<string, object>
            if (row is IDictionary<string, object> d1)
                return d1.ToDictionary(k => k.Key, v => (object?)v.Value);

            // Some cases: IDictionary<string, object?>
            if (row is IDictionary<string, object?> d2)
                return d2.ToDictionary(k => k.Key, v => v.Value);

            // Reflection fallback
            var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            var props = row.GetType().GetProperties();
            foreach (var p in props)
                result[p.Name] = p.GetValue(row);

            return result;
        }
    }
}
