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
        private const string SP_PO_STATUS_ON_DELIVERY_UPSERT = "[exp].[PO_STATUS_ON_DELIVERY_UPSERT_SP]";

        private readonly IDbConnectionFactory _db;

        public PoStatusService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        // =========================================================
        // UPSERT GENERAL STATUS
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
                                      ?? Get(payload, "Delivery Update"),
                    ["IsScheduled"] = ParseBool(Get(payload, "IsScheduled")
                                      ?? Get(payload, "isScheduled")
                                      ?? Get(payload, "Is Scheduled"))
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
        private static bool? ParseBool(object? value)
        {
            if (value == null) return null;

            var s = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (bool.TryParse(s, out var b))
                return b;

            if (s == "1") return true;
            if (s == "0") return false;

            return null;
        }

        // =========================================================
        // UPSERT ON DELIVERY
        // =========================================================
        public Task<Dictionary<string, object?>> UpsertOnDeliveryAsync(
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default)
        {
            try
            {
                if (payload is null)
                    throw new ArgumentNullException(nameof(payload));

                var actor = GetActor(payload, "CreatedBy", user);

                var parameters = new Dictionary<string, object?>
                {
                    ["ID_PO_Item"] = Get(payload, "ID_PO_Item")
                                  ?? Get(payload, "IDPOItem")
                                  ?? Get(payload, "IdPoItem")
                                  ?? Get(payload, "ID PO Item"),

                    ["AWB"] = Get(payload, "AWB"),

                    ["ActualDeliveryDate"] = ParseDateTime(
                                                Get(payload, "ActualDeliveryDate")
                                             ?? Get(payload, "ACTUAL_DELIVERY_DATE")
                                             ?? Get(payload, "OnDeliveryAt")
                                             ?? Get(payload, "ON_DELIVERY_AT")
                                             ?? Get(payload, "Actual Delivery Date")
                                            ),

                    ["LeadtimeDelivery"] = ParseInt(
                                                Get(payload, "LeadtimeDelivery")
                                             ?? Get(payload, "LEADTIME_DELIVERY")
                                             ?? Get(payload, "Lead Time Delivery")
                                            ),

                    ["Quantity"] = ParseDecimal(
                                        Get(payload, "Quantity")
                                     ?? Get(payload, "QUANTITY")
                                    ),

                    ["FileName"] = Get(payload, "FileName")
                                ?? Get(payload, "FILE_NAME")
                                ?? Get(payload, "fileName"),

                    ["ContentType"] = Get(payload, "ContentType")
                                   ?? Get(payload, "CONTENT_TYPE")
                                   ?? Get(payload, "contentType"),

                    ["FileSize"] = ParseLong(
                                        Get(payload, "FileSize")
                                     ?? Get(payload, "FILE_SIZE")
                                     ?? Get(payload, "fileSize")
                                    ),

                    ["BinaryData"] = ParseBytes(
                                        Get(payload, "BinaryData")
                                     ?? Get(payload, "BINARY_DATA")
                                    ),

                    ["Base64Data"] = Get(payload, "Base64Data")
                                  ?? Get(payload, "BASE64_DATA")
                                  ?? Get(payload, "base64Data"),

                    ["CreatedBy"] = actor
                };

                if (string.IsNullOrWhiteSpace(parameters["ID_PO_Item"]?.ToString()))
                    throw new ArgumentException("ID_PO_Item is required.", nameof(payload));

                if (string.IsNullOrWhiteSpace(parameters["AWB"]?.ToString()))
                    throw new ArgumentException("AWB is required.", nameof(payload));

                if (parameters["ActualDeliveryDate"] is null)
                    throw new ArgumentException("ActualDeliveryDate is required.", nameof(payload));

                if (string.IsNullOrWhiteSpace(parameters["FileName"]?.ToString()))
                    throw new ArgumentException("FileName is required.", nameof(payload));

                if (string.IsNullOrWhiteSpace(parameters["ContentType"]?.ToString()))
                    throw new ArgumentException("ContentType is required.", nameof(payload));

                var fileSize = parameters["FileSize"] as long?;
                if (!fileSize.HasValue || fileSize.Value <= 0)
                    throw new ArgumentException("FileSize must be greater than zero.", nameof(payload));

                return ExecutePoStatusOnDeliveryUpsertAsync(parameters, ct);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to prepare PO on-delivery upsert request.", ex);
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
        // Core: Execute General Upsert SP
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
                    parameters.Select(x => $"{x.Key}={FormatParameterValue(x.Value)}")
                );

                throw new InvalidOperationException(
                    $"Failed to execute stored procedure {SP_PO_STATUS_UPSERT}. Parameters: {parameterText}",
                    ex
                );
            }
        }

        // =========================================================
        // Core: Execute On Delivery Upsert SP
        // =========================================================
        private async Task<Dictionary<string, object?>> ExecutePoStatusOnDeliveryUpsertAsync(
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
                        commandText: SP_PO_STATUS_ON_DELIVERY_UPSERT,
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
                    parameters.Select(x => $"{x.Key}={FormatParameterValue(x.Value)}")
                );

                throw new InvalidOperationException(
                    $"Failed to execute stored procedure {SP_PO_STATUS_ON_DELIVERY_UPSERT}. Parameters: {parameterText}",
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
                throw new ArgumentException($"Value '{text}' must be a valid integer.");

            return parsed;
        }

        private static long? ParseLong(object? value)
        {
            if (value is null)
                return null;

            if (value is long l)
                return l;

            if (value is int i)
                return i;

            if (value is short s)
                return s;

            if (value is byte b)
                return b;

            if (value is decimal d)
                return (long)d;

            var text = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            if (!long.TryParse(text, out var parsed))
                throw new ArgumentException($"Value '{text}' must be a valid long integer.");

            return parsed;
        }

        private static decimal? ParseDecimal(object? value)
        {
            if (value is null)
                return null;

            if (value is decimal d)
                return d;

            if (value is double db)
                return Convert.ToDecimal(db);

            if (value is float f)
                return Convert.ToDecimal(f);

            if (value is int i)
                return i;

            if (value is long l)
                return l;

            var text = value.ToString()?.Trim();
            if (string.IsNullOrWhiteSpace(text))
                return null;

            if (!decimal.TryParse(text, out var parsed))
                throw new ArgumentException($"Value '{text}' must be a valid decimal.");

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

        private static byte[]? ParseBytes(object? value)
        {
            if (value is null)
                return null;

            if (value is byte[] bytes)
                return bytes;

            return null;
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
                        ?? user?.FindFirstValue(JwtRegisteredClaimNames.Sub)
                        ?? user?.FindFirstValue(ClaimTypes.Name)
                        ?? user?.Identity?.Name;

            return identity ?? string.Empty;
        }

        private static string FormatParameterValue(object? value)
        {
            if (value is null)
                return "NULL";

            if (value is byte[] bytes)
                return $"byte[{bytes.Length}]";

            var text = value.ToString();
            if (string.IsNullOrWhiteSpace(text))
                return "''";

            return text;
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