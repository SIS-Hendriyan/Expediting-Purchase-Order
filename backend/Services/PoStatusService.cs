using Dapper;
using Microsoft.IdentityModel.JsonWebTokens;
using System.Data;
using System.Security.Claims;
using EXPOAPI.Helpers;

namespace EXPOAPI.Services
{
    public class PoStatusService : IPoStatusService
    {
        private const string SP_PO_STATUS_UPSERT = "[exp].[PO_STATUS_TRANSACTION_UPSERT_SP]";
        private const string SP_PO_STATUS = "[exp].[PO_STATUS_TRANSACTION_SP]";

        private readonly IDbConnectionFactory _db;

        public PoStatusService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        // =========================================================
        // UPSERT
        // =========================================================
        public Task<Dictionary<string, object?>> UpsertPoStatusAsync(
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default)
        {
            try
            {
                if (payload is null)
                    throw new ArgumentNullException(nameof(payload));

                var actor = GetActor(payload, "By", user);

                var parameters = new Dictionary<string, object?>
                {
                    ["IDPOItem"] = Get(payload, "IDPOItem")
                                ?? Get(payload, "IdPoItem")
                                ?? Get(payload, "ID PO Item"),

                    ["ETD"] = ParseDateTime(Get(payload, "ETD")),
                    ["ETA"] = ParseInt(Get(payload, "ETA")),
                    ["WIPRemark"] = Get(payload, "WIPRemark")
                                 ?? Get(payload, "WIP Remark"),
                    ["AWB"] = Get(payload, "AWB"),
                    ["DeliveryUpdate"] = Get(payload, "DeliveryUpdate")
                                      ?? Get(payload, "Delivery Update")
                };

                if (string.IsNullOrWhiteSpace(parameters["IDPOItem"]?.ToString()))
                    throw new ArgumentException("IDPOItem is required.", nameof(payload));

                return ExecutePoStatusUpsertAsync(parameters, ct);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to prepare PO status upsert request.", ex);
            }
        }

        // =========================================================
        // DETAIL BY ID PO ITEM
        // =========================================================
        public async Task<Dictionary<string, object?>?> GetPoStatusByIdPoItemAsync(
            string idPoItem,
            CancellationToken ct = default)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(idPoItem))
                    return null;

                using var cn = _db.CreateMain();

                using var grid = await cn.QueryMultipleAsync(
                    new CommandDefinition(
                        commandText: SP_PO_STATUS,
                        parameters: new
                        {
                            Type = "RETRIEVE",
                            IDPOItem = idPoItem.Trim()
                        },
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
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    $"Failed to retrieve PO status for IDPOItem '{idPoItem}'.",
                    ex
                );
            }
        }

        // =========================================================
        // LIST
        // =========================================================
        public async Task<List<Dictionary<string, object?>>> ListPoStatusesAsync(
            CancellationToken ct = default)
        {
            try
            {
                using var cn = _db.CreateMain();

                using var grid = await cn.QueryMultipleAsync(
                    new CommandDefinition(
                        commandText: SP_PO_STATUS,
                        parameters: new { Type = "LIST" },
                        commandType: CommandType.StoredProcedure,
                        cancellationToken: ct
                    )
                );

                while (!grid.IsConsumed)
                {
                    var rows = (await grid.ReadAsync<dynamic>()).AsList();
                    if (rows.Count > 0)
                        return rows
                            .Select(r => (Dictionary<string, object?>)ToDict(r))
                            .ToList();
                }

                return new List<Dictionary<string, object?>>();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to list PO statuses.", ex);
            }
        }

        // =========================================================
        // Core: Execute Upsert SP
        // =========================================================
        private async Task<Dictionary<string, object?>> ExecutePoStatusUpsertAsync(
            Dictionary<string, object?> parameters,
            CancellationToken ct)
        {
            try
            {
                using var cn = _db.CreateMain();

                var dp = new DynamicParameters();
                foreach (var (key, value) in parameters)
                {
                    dp.Add(key, value);
                }

                using var grid = await cn.QueryMultipleAsync(
                    new CommandDefinition(
                        commandText: SP_PO_STATUS_UPSERT,
                        parameters: dp,
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
            catch (Exception ex)
            {
                var parameterText = string.Join(
                    ", ",
                    parameters.Select(x => $"{x.Key}={x.Value ?? "NULL"}")
                );

                throw new InvalidOperationException(
                    $"Failed to execute stored procedure {SP_PO_STATUS_UPSERT}. Parameters: {parameterText}",
                    ex
                );
            }
        }

        // =========================================================
        // Helpers
        // =========================================================
        private static object? Get(Dictionary<string, object?> payload, string key)
        {
            if (payload == null)
                return null;

            return payload.TryGetValue(key, out var value)
                ? NormalizeJSONValue.NormalizeJsonValue(value)
                : null;
        }

        private static int? ParseInt(object? value)
        {
            if (value is null)
                return null;

            if (value is int i)
                return i;

            if (value is long l)
                return checked((int)l);

            if (value is short s)
                return s;

            if (value is byte b)
                return b;

            if (value is decimal d)
                return (int)d;

            var text = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            if (!int.TryParse(text, out var parsed))
                throw new ArgumentException("ETA must be a valid integer.");

            return parsed;
        }

        private static DateTime? ParseDateTime(object? value)
        {
            if (value is null)
                return null;

            if (value is DateTime dt)
                return dt;

            if (value is DateTimeOffset dto)
                return dto.DateTime;

            var text = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            return DateTime.TryParse(text, out var parsed) ? parsed : null;
        }

        private static string GetActor(
            Dictionary<string, object?> payload,
            string key,
            ClaimsPrincipal? user)
        {
            var fromPayload = Get(payload, key)?.ToString();
            if (!string.IsNullOrWhiteSpace(fromPayload))
                return fromPayload;

            var identity = user?.FindFirstValue("identity")
                        ?? user?.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? user?.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return identity ?? string.Empty;
        }

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

            foreach (var prop in props)
            {
                result[prop.Name] = prop.GetValue(row);
            }

            return result;
        }
    }
}