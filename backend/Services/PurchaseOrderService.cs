using Dapper;
using Microsoft.Data.SqlClient;
using System.Data;

namespace EXPOAPI.Services
{

    public class PurchaseOrderService : IPurchaseOrderService
    {
        private readonly IDbConnectionFactory _db;

        private const string SP_PURCHASE_ORDER = "[exp].[Purchase_Order_SP]";
        private const string SP_PO_DASHBOARD_SUMMARY = "[exp].[PO_DASHBOARD_SUMMARY_SP]";
        private const string SP_PO_VENDOR_SCORECARD = "[exp].[PO_VENDOR_SCORECARD_SP]";

        private const string SP_PO_TREND = "[exp].[PURCHASE_ORDER_TREND_SP]";
        private const string SP_PO_STATUS_DIST = "[exp].[PURCHASE_ORDER_STATUS_DISTRIBUTION_SP]";
        private const string SP_PO_MONTHLY_COMPLETION_DELAY = "[exp].[PURCHASE_ORDER_MONTHLY_COMPLETION_DELAY_SP]";
        private const string SP_PO_MASTERFILTER = "[exp].[PO_DASHBOARD_MASTERFILTER_SP]";

        private static readonly string[] SummaryKeys =
        {
        "TotalPO",
        "POSubmitted",
        "POWorkInProgress",
        "POOnDelivery",
        "POPartiallyReceived",
        "POFullyReceived",
        "TotalFiltered"
    };

        public PurchaseOrderService(IDbConnectionFactory db)
        {
            _db = db;
        }

        // ------------------------------------------------------------
        // exp.Purchase_Order_SP -> multi result sets: summary + items
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPurchaseOrderSummaryAsync(
            Dictionary<string, object?>? parameters = null,
            CancellationToken ct = default)
        {
            parameters ??= new Dictionary<string, object?>();

            using var cn = _db.CreateMain();

            var dp = ToDynamicParamsRemovingNull(parameters);

            using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                SP_PURCHASE_ORDER,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ));

            var summary = DefaultSummary();
            var items = new List<Dictionary<string, object?>>();

            // Scan all result sets like Python
            while (!grid.IsConsumed)
            {
                var rows = (await grid.ReadAsync<dynamic>()).ToList();
                if (rows.Count == 0) continue;

                // detect summary by column "TotalPO" (case-insensitive)
                var firstDict = ToDict(rows[0]);
                if (HasKey(firstDict, "TotalPO"))
                {
                    // build base summary with canonical keys; keep extras
                    var merged = DefaultSummary();

                    foreach (var k in SummaryKeys)
                    {
                        merged[k] = TryGetValueCaseInsensitive(firstDict, k) ?? 0;
                    }

                    // extras: columns not in SummaryKeys
                    foreach (var kv in firstDict)
                    {
                        if (!SummaryKeys.Any(x => x.Equals(kv.Key, StringComparison.OrdinalIgnoreCase)))
                            merged[kv.Key] = kv.Value;
                    }

                    summary = merged;
                }
                else
                {
                    // items set
                    items.AddRange(rows.Select(ToDict));
                }
            }

            return new Dictionary<string, object?>
            {
                ["summary"] = summary,
                ["items"] = items
            };
        }

        // ------------------------------------------------------------
        // exp.PO_DASHBOARD_SUMMARY_SP -> single row
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPoDashboardSummaryAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            if (startDate != null) dp.Add("StartDate", startDate.Value.Date);
            if (endDate != null) dp.Add("EndDate", endDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(plant)) dp.Add("Plant", plant);
            if (!string.IsNullOrWhiteSpace(group)) dp.Add("Group", group);
            if (!string.IsNullOrWhiteSpace(vendor)) dp.Add("Vendor", vendor);
            dp.Add("DocType", docType ?? "All");

            using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                SP_PO_DASHBOARD_SUMMARY,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ));

            var row = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
            return row == null ? new Dictionary<string, object?>() : ToDict(row);
        }

        // ------------------------------------------------------------
        // exp.PO_VENDOR_SCORECARD_SP -> 2 result sets: items + aggregates
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPoVendorScorecardAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string docType = "All",
            string? vendor = null,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            if (startDate != null) dp.Add("StartDate", startDate.Value.Date);
            if (endDate != null) dp.Add("EndDate", endDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(plant)) dp.Add("Plant", plant);
            if (!string.IsNullOrWhiteSpace(group)) dp.Add("Group", group);
            dp.Add("DocType", docType ?? "All");
            if (!string.IsNullOrWhiteSpace(vendor)) dp.Add("Vendor", vendor);

            using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                SP_PO_VENDOR_SCORECARD,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ));

            var itemsRows = (await grid.ReadAsync<dynamic>()).ToList();
            var vendorRows = (await grid.ReadAsync<dynamic>()).ToList();

            var items = itemsRows.Select(ToDict).ToList();
            var vendorAggregates = vendorRows.Select(ToDict).ToList();

            return new Dictionary<string, object?>
            {
                ["items"] = items,
                ["vendor_aggregates"] = vendorAggregates
            };
        }

        // ------------------------------------------------------------
        // exp.PURCHASE_ORDER_TREND_SP -> list rows
        // ------------------------------------------------------------
        public async Task<List<Dictionary<string, object?>>> GetPoTrendAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            if (startDate != null) dp.Add("StartDate", startDate.Value.Date);
            if (endDate != null) dp.Add("EndDate", endDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(plant)) dp.Add("Plant", plant);
            if (!string.IsNullOrWhiteSpace(purchasingGroup)) dp.Add("PurchasingGroup", purchasingGroup);
            if (!string.IsNullOrWhiteSpace(vendor)) dp.Add("Vendor", vendor);
            dp.Add("DocType", docType ?? "All");

            var rows = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                SP_PO_TREND,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ))).ToList();

            return rows.Select(ToDict).ToList();
        }

        // ------------------------------------------------------------
        // exp.PURCHASE_ORDER_STATUS_DISTRIBUTION_SP -> list rows
        // ------------------------------------------------------------
        public async Task<List<Dictionary<string, object?>>> GetPoStatusDistributionAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            if (startDate != null) dp.Add("StartDate", startDate.Value.Date);
            if (endDate != null) dp.Add("EndDate", endDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(plant)) dp.Add("Plant", plant);
            if (!string.IsNullOrWhiteSpace(purchasingGroup)) dp.Add("PurchasingGroup", purchasingGroup);
            if (!string.IsNullOrWhiteSpace(vendor)) dp.Add("Vendor", vendor);
            dp.Add("DocType", docType ?? "All");

            var rows = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                SP_PO_STATUS_DIST,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ))).ToList();

            return rows.Select(ToDict).ToList();
        }

        // ------------------------------------------------------------
        // exp.PURCHASE_ORDER_MONTHLY_COMPLETION_DELAY_SP -> list rows
        // ------------------------------------------------------------
        public async Task<List<Dictionary<string, object?>>> GetPoMonthlyCompletionDelayAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            if (startDate != null) dp.Add("StartDate", startDate.Value.Date);
            if (endDate != null) dp.Add("EndDate", endDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(plant)) dp.Add("Plant", plant);
            if (!string.IsNullOrWhiteSpace(group)) dp.Add("Group", group);
            if (!string.IsNullOrWhiteSpace(vendor)) dp.Add("Vendor", vendor);
            dp.Add("DocType", docType ?? "All");

            var rows = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                SP_PO_MONTHLY_COMPLETION_DELAY,
                dp,
                commandType: CommandType.StoredProcedure,
                cancellationToken: ct
            ))).ToList();

            return rows.Select(ToDict).ToList();
        }

        // ------------------------------------------------------------
        // exp.PO_DASHBOARD_MASTERFILTER_SP -> 2 result sets:
        //   1) plants (single col)
        //   2) suppliers (formatted_name, raw_name)
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPoDashboardMasterfiltersAsync(CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PO_MASTERFILTER,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                // Result set #1: plants
                var plantsRows = (await grid.ReadAsync<dynamic>()).ToList();

                // Result set #2: suppliers (guard kalau SP hanya return 1 set)
                var suppliersRows = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).ToList()
                    : new List<dynamic>();

                var plants = new List<string>();
                foreach (var r in plantsRows)
                {
                    var d = ToDict(r);
                    if (d.Count == 0) continue;

                    string? v = null;
                    using (var it = d.Values.GetEnumerator())
                    {
                        if (it.MoveNext())
                            v = it.Current?.ToString();
                    }

                    if (!string.IsNullOrWhiteSpace(v))
                        plants.Add(v);
                }


                // suppliers unique: (name, raw), sort by name
                var supplierSet = new HashSet<(string name, string raw)>();

                foreach (var r in suppliersRows)
                {
                    var d = ToDict(r);
                    if (d.Count == 0) continue;

                    string name = "";
                    string raw = "";

                    using (var it = d.Values.GetEnumerator())
                    {
                        if (it.MoveNext())
                            name = it.Current?.ToString() ?? "";

                        if (it.MoveNext())
                            raw = it.Current?.ToString() ?? "";
                    }

                    if (!string.IsNullOrWhiteSpace(name))
                        supplierSet.Add((name, raw));
                }


                var suppliers = supplierSet
                    .OrderBy(x => x.name, StringComparer.OrdinalIgnoreCase)
                    .Select(x => new Dictionary<string, object?>
                    {
                        ["name"] = x.name,
                        ["raw"] = x.raw
                    })
                    .ToList();

                return new Dictionary<string, object?>
                {
                    ["plants"] = plants,
                    ["suppliers"] = suppliers
                };
            }
            catch (OperationCanceledException)
            {
                // biar cancellation tetap benar (jangan dibungkus jadi exception lain)
                throw;
            }
            catch (SqlException ex) // kalau kamu pakai Microsoft.Data.SqlClient / System.Data.SqlClient
            {
                //_logger.LogError(ex,
                //    "SQL error calling {SP}. Number={Number}, State={State}, Line={Line}, Message={Message}",
                //    SP_PO_MASTERFILTER, ex.Number, ex.State, ex.LineNumber, ex.Message);

                throw new InvalidOperationException($"DB error executing {SP_PO_MASTERFILTER}: {ex.Message}", ex);
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Unhandled error calling {SP}", SP_PO_MASTERFILTER);
                throw;
            }
        }

        // =========================
        // Helpers
        // =========================
        private static Dictionary<string, object?> DefaultSummary()
        {
            var d = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var k in SummaryKeys) d[k] = 0;
            return d;
        }

        private static bool HasKey(Dictionary<string, object?> dict, string key)
            => dict.Keys.Any(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));

        private static object? TryGetValueCaseInsensitive(Dictionary<string, object?> dict, string key)
        {
            foreach (var kv in dict)
            {
                if (kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
                    return kv.Value;
            }
            return null;
        }

        private static DynamicParameters ToDynamicParamsRemovingNull(Dictionary<string, object?> dict)
        {
            var dp = new DynamicParameters();
            foreach (var kv in dict)
            {
                if (kv.Value != null)
                    dp.Add(kv.Key, kv.Value);
            }
            return dp;
        }

        private static Dictionary<string, object?> ToDict(dynamic row)
        {
            var dict = (IDictionary<string, object>)row;
            return dict.ToDictionary(k => k.Key, v => (object?)v.Value);
        }
    }
}
