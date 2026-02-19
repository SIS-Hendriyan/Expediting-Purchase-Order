using Dapper;
using Microsoft.IdentityModel.JsonWebTokens;
using System.Data;
using System.Security.Claims;

namespace EXPOAPI.Services
{

    public  class VendorService : IVendorService
    {
        private const string SP_VENDORS = "[exp].[VENDORS_SP]";
        private const string SP_VENDOR_IUD = "[exp].[Vendor_IUD_SP]";

        private static readonly string[] SummaryKeys =
        {
            "TotalVendor",
            "VendorWithAccess",
            "VendorWithoutAccess",
            "AverageScore"
        };

        private readonly IDbConnectionFactory _db;

        public VendorService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        // =========================================================
        // LIST vendors (+ summary)
        // =========================================================
        public async Task<Dictionary<string, object?>> ListVendorsAsync(string? email = null, CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var param = new DynamicParameters();
            param.Add("Type", "LIST");
            if (!string.IsNullOrWhiteSpace(email))
                param.Add("Email", email.Trim());

            using var grid = await cn.QueryMultipleAsync(
                new CommandDefinition(
                    SP_VENDORS,
                    param,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            var vendors = new List<Dictionary<string, object?>>();
            var summary = DefaultSummary();

            // Scan all result sets (like Python) & classify using column keys
            while (!grid.IsConsumed)
            {
                var rows = (await grid.ReadAsync<dynamic>()).AsList();
                if (rows.Count == 0) continue;

                // IMPORTANT: force non-dynamic type here
                Dictionary<string, object?> first = ToDict(rows[0]);

                // Build normalized key set WITHOUT LINQ lambdas on dynamic
                var lowerKeys = BuildLowerKeySet(first.Keys);

                // Vendor list set: must have VendorID + VendorName
                if (lowerKeys.Contains("vendorid") && lowerKeys.Contains("vendorname"))
                {
                    vendors = rows.Select(r => (Dictionary<string, object?>)ToDict(r)).ToList();
                    continue;
                }

                // Summary set: must contain all summary keys
                if (ContainsAllSummaryKeys(lowerKeys))
                {
                    foreach (var k in SummaryKeys)
                    {
                        if (first.TryGetValue(k, out object? v))
                            summary[k] = v ?? 0;
                        else
                            summary[k] = 0;
                    }
                }
            }

            return new Dictionary<string, object?>
            {
                ["vendors"] = vendors,
                ["summary"] = summary
            };
        }

        // =========================================================
        // DETAIL
        // =========================================================
        public async Task<Dictionary<string, object?>?> GetVendorDetailAsync(int vendorId, CancellationToken ct = default)
        {
            if (vendorId <= 0) return null;

            using var cn = _db.CreateMain();

            using var grid = await cn.QueryMultipleAsync(
                new CommandDefinition(
                    SP_VENDORS,
                    new { Type = "RETRIEVE", VendorID = vendorId },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            while (!grid.IsConsumed)
            {
                var row = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
                if (row != null)
                    return ToDict(row);
            }

            return null;
        }

        // =========================================================
        // IUD wrappers
        // =========================================================
        public Task<Dictionary<string, object?>> CreateVendorAsync(Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default)
        {
            var actor = GetActor(payload, "CreatedBy", user);

            var p = new Dictionary<string, object?>
            {
                ["Email"] = Get(payload, "Email"),
                ["VendorName"] = Get(payload, "VendorName"),
                ["CompleteName"] = Get(payload, "CompleteName"),
                ["UserName"] = Get(payload, "UserName"),
                ["OTP"] = Get(payload, "OTP"),
                ["OtpExpiresAt"] = ParseDateTime(Get(payload, "OtpExpiresAt")),
                ["IsAccess"] = NormalizeBool(Get(payload, "IsAccess")),
                ["CreatedBy"] = actor
            };

            return ExecuteVendorIudAsync("INSERT", p, ct);
        }

        public Task<Dictionary<string, object?>> UpdateVendorAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default)
        {
            var actor = GetActor(payload, "UpdatedBy", user);

            var p = new Dictionary<string, object?>
            {
                ["VendorID"] = vendorId,
                ["Email"] = Get(payload, "Email"),
                ["VendorName"] = Get(payload, "VendorName"),
                ["CompleteName"] = Get(payload, "CompleteName"),
                ["UserName"] = Get(payload, "UserName"),
                ["OTP"] = Get(payload, "OTP"),
                ["OtpExpiresAt"] = ParseDateTime(Get(payload, "OtpExpiresAt")),
                ["IsAccess"] = NormalizeBool(Get(payload, "IsAccess")),
                ["UpdatedBy"] = actor
            };

            return ExecuteVendorIudAsync("UPDATE", p, ct);
        }

        public Task<Dictionary<string, object?>> UpdateVendorAccessAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default)
        {
            var actor = GetActor(payload, "UpdatedBy", user);

            var p = new Dictionary<string, object?>
            {
                ["VendorID"] = vendorId,
                ["IsAccess"] = NormalizeBool(Get(payload, "IsAccess")),
                ["UpdatedBy"] = actor
            };

            return ExecuteVendorIudAsync("UpdateAccess", p, ct);
        }

        public Task<Dictionary<string, object?>> DeleteVendorAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default)
        {
            // Keep original Python key typo if your SP expects it
            var actor = GetActor(payload, "DeleteddBy", user);

            var p = new Dictionary<string, object?>
            {
                ["VendorID"] = vendorId,
                ["DeleteddBy"] = actor
            };

            return ExecuteVendorIudAsync("DELETE", p, ct);
        }

        // =========================================================
        // Core: Execute Vendor IUD (scan multi result sets; return first row found)
        // =========================================================
        private async Task<Dictionary<string, object?>> ExecuteVendorIudAsync(string action, Dictionary<string, object?> parameters, CancellationToken ct)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("Action", (action ?? "").ToUpperInvariant());

            foreach (var kv in parameters)
                dp.Add(kv.Key, kv.Value);

            using var grid = await cn.QueryMultipleAsync(
                new CommandDefinition(
                    SP_VENDOR_IUD,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                )
            );

            while (!grid.IsConsumed)
            {
                var rows = (await grid.ReadAsync<dynamic>()).AsList();
                if (rows.Count > 0)
                    return ToDict(rows[0]);
            }

            return new Dictionary<string, object?>();
        }

        // =========================================================
        // Result-set classification helpers (NO dynamic-lambda)
        // =========================================================
        private static HashSet<string> BuildLowerKeySet(IEnumerable<string> keys)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var key in keys)
            {
                var normalized = (key ?? "").Trim().ToLowerInvariant();
                if (normalized.Length > 0)
                    set.Add(normalized);
            }
            return set;
        }

        private static bool ContainsAllSummaryKeys(HashSet<string> lowerKeys)
        {
            foreach (var k in SummaryKeys)
            {
                var normalized = (k ?? "").Trim().ToLowerInvariant();
                if (!lowerKeys.Contains(normalized))
                    return false;
            }
            return true;
        }

        // =========================================================
        // Python-mirror helpers
        // =========================================================
        private static Dictionary<string, object?> DefaultSummary() => new()
        {
            ["TotalVendor"] = 0,
            ["VendorWithAccess"] = 0,
            ["VendorWithoutAccess"] = 0,
            ["AverageScore"] = 0
        };

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

        private static DateTime? ParseDateTime(object? value)
        {
            if (value is null) return null;
            if (value is DateTime dt) return dt;
            if (value is DateTimeOffset dto) return dto.DateTime;

            var s = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;

            return DateTime.TryParse(s, out var parsed) ? parsed : null;
        }

        private static string GetActor(Dictionary<string, object?> payload, string key, ClaimsPrincipal? user)
        {
            var fromPayload = Get(payload, key)?.ToString();
            if (!string.IsNullOrWhiteSpace(fromPayload))
                return fromPayload;

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

            if (row is IDictionary<string, object> d1)
                return d1.ToDictionary(k => k.Key, v => (object?)v.Value);

            if (row is IDictionary<string, object?> d2)
                return d2.ToDictionary(k => k.Key, v => v.Value);

            var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            var props = row.GetType().GetProperties();
            foreach (var p in props)
                result[p.Name] = p.GetValue(row);
            return result;
        }
    }
}
