using Dapper;
using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{
    public sealed class PurchaseOrderService : IPurchaseOrderService
    {
        private readonly IDbConnectionFactory _db;
        private const string SP_PURCHASE_ORDER_MASTER = "[exp].[Purchase_Order_Master_SP]";
        private const string SP_PURCHASE_ORDER = "[exp].[Purchase_Order_SP]";
        private const string SP_PO_DASHBOARD_SUMMARY = "[exp].[PO_DASHBOARD_SUMMARY_SP]";
        private const string SP_PO_VENDOR_SCORECARD = "[exp].[PO_VENDOR_SCORECARD_SP]";
        private const string SP_PO_TREND = "[exp].[PURCHASE_ORDER_TREND_SP]";
        private const string SP_PO_STATUS_DIST = "[exp].[PURCHASE_ORDER_STATUS_DISTRIBUTION_SP]";
        private const string SP_PO_MONTHLY_COMPLETION_DELAY = "[exp].[PURCHASE_ORDER_MONTHLY_COMPLETION_DELAY_SP]";
        private const string SP_PO_MASTERFILTER = "[exp].[PO_DASHBOARD_MASTERFILTER_SP]";
        private const string SP_PO_DETAIL = "[exp].[PurchaseOrderDetail_SP]";

        // ✅ NEW SP for eligible items
        private const string SP_PO_ITEMS_ELIGIBLE_REETA = "[exp].[PO_ITEM_ELIGIBLE_FOR_REETA_SP]";

        // ✅ SP for purchase orders needing update
        private const string SP_PO_NEEDING_UPDATE = "[exp].[Purchase_Order_Needing_Update_SP]";

        // status mapping sama seperti Python
        private static readonly Dictionary<string, string> StatusMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["submitted"] = "Submitted",
            ["workInProgress"] = "Work In Progress",
            ["onDelivery"] = "On Delivery",
            ["partiallyReceived"] = "Partially Received",
            ["fullyReceived"] = "Fully Received",
        };

        private static readonly string[] SummaryKeys =
        {
            "TotalPO",
            "POSubmitted",
            "POWorkInProgress",
            "POOnDelivery",
            "POPartiallyReceived",
            "POFullyReceived",

            "PONeedUpdate",
            "POOverdue",

            "TotalFiltered",
            "PageSize",
            "FilterStatus",

            "PONeedUpdateFiltered",
            "POOverdueFiltered"
        };

        private static Dictionary<string, object?> DefaultSummary() => new(StringComparer.OrdinalIgnoreCase)
        {
            ["TotalPO"] = 0L,
            ["POSubmitted"] = 0L,
            ["POWorkInProgress"] = 0L,
            ["POOnDelivery"] = 0L,
            ["POPartiallyReceived"] = 0L,
            ["POFullyReceived"] = 0L,

            ["PONeedUpdate"] = 0L,
            ["POOverdue"] = 0L,

            ["TotalFiltered"] = 0L,
            ["PageSize"] = 0L,
            ["FilterStatus"] = null,

            ["PONeedUpdateFiltered"] = 0L,
            ["POOverdueFiltered"] = 0L
        };

        public PurchaseOrderService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        private static object? TryGetValueIgnoreCase(IDictionary<string, object?> dict, string key)
        {
            foreach (var kv in dict)
            {
                if (kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
                    return kv.Value;
            }

            return null;
        }
        private static List<Dictionary<string, object?>> NormalizeMasterList(
    List<Dictionary<string, object?>> rows)
        {
            var result = new List<Dictionary<string, object?>>();

            foreach (var row in rows)
            {
                var value = TryGetValueIgnoreCase(row, "Value");
                var text = TryGetValueIgnoreCase(row, "Text");

                if (value == null && text == null)
                    continue;

                result.Add(new Dictionary<string, object?>
                {
                    ["value"] = value,
                    ["text"] = text ?? value
                });
            }

            return result;
        }

        public async Task<Dictionary<string, object?>> GetPurchaseOrderMasterAsync(
    string? status = null,
    int? attention = null,
    string? vendorName = null,
    CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            AddString(dp, "Status", status);
            if (attention.HasValue) dp.Add("Attention", attention.Value);
            AddString(dp, "VendorName", vendorName);

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PURCHASE_ORDER_MASTER,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                var listStatus = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();
                var listPlant = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                    : new List<Dictionary<string, object?>>();

                var listLocation = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                    : new List<Dictionary<string, object?>>();

                var listDocType = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                    : new List<Dictionary<string, object?>>();

                var listPurchasingGroup = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                    : new List<Dictionary<string, object?>>();

                return new Dictionary<string, object?>
                {
                    ["listStatus"] = NormalizeMasterList(listStatus),
                    ["listPlant"] = NormalizeMasterList(listPlant),
                    ["listLocation"] = NormalizeMasterList(listLocation),
                    ["listDocType"] = NormalizeMasterList(listDocType),
                    ["listPurchasingGroup"] = NormalizeMasterList(listPurchasingGroup)
                };
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (SqlException ex)
            {
                throw new InvalidOperationException(
                    $"DB error executing {SP_PURCHASE_ORDER_MASTER}: {ex.Message}",
                    ex
                );
            }
        }

        // ------------------------------------------------------------
        // Summary + items (Purchase_Order_SP)
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPurchaseOrderSummaryAsync(
            Dictionary<string, object?>? parameters = null,
            CancellationToken ct = default)
        {
            parameters ??= new Dictionary<string, object?>();

            using var cn = _db.CreateMain();
            var dp = ToDynamicParamsRemovingNull(parameters);

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PURCHASE_ORDER,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                var summary = DefaultSummary();
                var items = new List<Dictionary<string, object?>>();

                while (!grid.IsConsumed)
                {
                    var rows = (await grid.ReadAsync<dynamic>()).ToList();
                    if (rows.Count == 0) continue;

                    var first = ToDict(rows[0]);

                    // Resultset summary dikenali dari "TotalPO"
                    if (HasKey(first, "TotalPO"))
                    {
                        summary = MergeSummary(first);
                    }
                    else
                    {
                        items.AddRange(rows.Select(ToDict));
                    }
                }

                return new Dictionary<string, object?>
                {
                    ["summary"] = summary,
                    ["items"] = items
                };
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PURCHASE_ORDER}: {ex.Message}", ex);
            }
        }

        // ------------------------------------------------------------
        // PurchaseOrderDetail_SP -> 2 result sets: statusFlow + reEtaRequests
        // ------------------------------------------------------------
        public async Task<(
       List<Dictionary<string, object?>> StatusFlow,
       List<Dictionary<string, object?>> ReEtaRequests,
       Dictionary<string, object?>? PoDetail
   )> GetPurchaseOrderDetailAsync(string poid, string? type = null, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(poid))
            {
                return
                (
                    new List<Dictionary<string, object?>>(),
                    new List<Dictionary<string, object?>>(),
                    null
                );
            }

            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("POID", poid.Trim());

            // @Type controls conditional resultsets in the SP:
            // - null  => returns StatusFlow, ReEtaRequests, PoDetail
            // - "Detail" => returns only PoDetail
            if (!string.IsNullOrWhiteSpace(type))
                dp.Add("Type", type.Trim());

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PO_DETAIL,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                var statusFlow = new List<Dictionary<string, object?>>();
                var reEtaRequests = new List<Dictionary<string, object?>>();
                Dictionary<string, object?>? poDetail = null;

                // When @Type = 'Detail', the SP skips the first two resultsets
                // and returns only PoDetail. We read greedily and infer by content.
                while (!grid.IsConsumed)
                {
                    var rows = (await grid.ReadAsync<dynamic>()).ToList();
                    if (rows.Count == 0) continue;

                    var first = ToDict(rows[0]);

                    // PoDetail is recognized by POID column
                    if (HasKey(first, "POID") || HasKey(first, "poid"))
                    {
                        poDetail = first;
                    }
                    // StatusFlow is recognized by Status / StepNo columns
                    else if (HasKey(first, "Status") || HasKey(first, "StepNo"))
                    {
                        statusFlow = rows.Select(ToDict).ToList();
                    }
                    // ReEtaRequests is recognized by ReETARequestID / POREETANUMBER columns
                    else if (HasKey(first, "ReETARequestID") || HasKey(first, "POREETANUMBER"))
                    {
                        reEtaRequests = rows.Select(ToDict).ToList();
                    }
                    else
                    {
                        // Fallback: if we already have statusFlow, assume this is reEtaRequests
                        if (statusFlow.Count > 0 && reEtaRequests.Count == 0)
                            reEtaRequests = rows.Select(ToDict).ToList();
                        else
                            statusFlow = rows.Select(ToDict).ToList();
                    }
                }

                return (statusFlow, reEtaRequests, poDetail);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (SqlException ex)
            {
                throw new InvalidOperationException(
                    $"DB error executing {SP_PO_DETAIL}: {ex.Message}",
                    ex
                );
            }
        }

        // ------------------------------------------------------------
        // PO_DASHBOARD_SUMMARY_SP -> single row
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
            AddDate(dp, "StartDate", startDate);
            AddDate(dp, "EndDate", endDate);
            AddString(dp, "Plant", plant);
            AddString(dp, "Group", group);
            AddString(dp, "Vendor", vendor);
            dp.Add("DocType", string.IsNullOrWhiteSpace(docType) ? "All" : docType);

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_PO_DASHBOARD_SUMMARY,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PO_DASHBOARD_SUMMARY}: {ex.Message}", ex);
            }
        }

        // ------------------------------------------------------------
        // PO_VENDOR_SCORECARD_SP -> 2 result sets: items + aggregates
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
            AddDate(dp, "StartDate", startDate);
            AddDate(dp, "EndDate", endDate);
            AddString(dp, "Plant", plant);
            AddString(dp, "Group", group);
            dp.Add("DocType", string.IsNullOrWhiteSpace(docType) ? "All" : docType);
            AddString(dp, "Vendor", vendor);

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PO_VENDOR_SCORECARD,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                var items = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();
                var vendorAgg = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();

                return new Dictionary<string, object?>
                {
                    ["items"] = items,
                    ["vendor_aggregates"] = vendorAgg
                };
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PO_VENDOR_SCORECARD}: {ex.Message}", ex);
            }
        }

        // ------------------------------------------------------------
        // List SP helpers (Trend / StatusDist / MonthlyCompletionDelay)
        // ------------------------------------------------------------
        public Task<List<Dictionary<string, object?>>> GetPoTrendAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
            => QueryListSpAsync(
                SP_PO_TREND,
                dp =>
                {
                    AddDate(dp, "StartDate", startDate);
                    AddDate(dp, "EndDate", endDate);
                    AddString(dp, "Plant", plant);
                    AddString(dp, "PurchasingGroup", purchasingGroup);
                    AddString(dp, "Vendor", vendor);
                    dp.Add("DocType", string.IsNullOrWhiteSpace(docType) ? "All" : docType);
                },
                ct);

        public Task<List<Dictionary<string, object?>>> GetPoStatusDistributionAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? purchasingGroup = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
            => QueryListSpAsync(
                SP_PO_STATUS_DIST,
                dp =>
                {
                    AddDate(dp, "StartDate", startDate);
                    AddDate(dp, "EndDate", endDate);
                    AddString(dp, "Plant", plant);
                    AddString(dp, "PurchasingGroup", purchasingGroup);
                    AddString(dp, "Vendor", vendor);
                    dp.Add("DocType", string.IsNullOrWhiteSpace(docType) ? "All" : docType);
                },
                ct);

        public Task<List<Dictionary<string, object?>>> GetPoMonthlyCompletionDelayAsync(
            DateTime? startDate = null,
            DateTime? endDate = null,
            string? plant = null,
            string? group = null,
            string? vendor = null,
            string docType = "All",
            CancellationToken ct = default)
            => QueryListSpAsync(
                SP_PO_MONTHLY_COMPLETION_DELAY,
                dp =>
                {
                    AddDate(dp, "StartDate", startDate);
                    AddDate(dp, "EndDate", endDate);
                    AddString(dp, "Plant", plant);
                    AddString(dp, "Group", group);
                    AddString(dp, "Vendor", vendor);
                    dp.Add("DocType", string.IsNullOrWhiteSpace(docType) ? "All" : docType);
                },
                ct);

        // ------------------------------------------------------------
        // PO_DASHBOARD_MASTERFILTER_SP -> 2 result sets: plants + suppliers
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

                var plantsRows = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();
                var suppliersRows = !grid.IsConsumed
                    ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                    : new List<Dictionary<string, object?>>();

                var plants = plantsRows
                    .Select(d => d.Values.FirstOrDefault()?.ToString())
                    .Where(v => !string.IsNullOrWhiteSpace(v))
                    .Cast<string>()
                    .ToList();

                var supplierSet = new HashSet<(string name, string raw)>();

                foreach (var d in suppliersRows)
                {
                    // ambil 2 kolom pertama dari SP (name, raw) — sesuai logic kamu sebelumnya
                    var vals = d.Values.Select(v => v?.ToString() ?? "").ToList();
                    var name = vals.Count > 0 ? vals[0] : "";
                    var raw = vals.Count > 1 ? vals[1] : "";

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
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PO_MASTERFILTER}: {ex.Message}", ex);
            }
        }

        // ------------------------------------------------------------
        // ✅ NEW: Eligible PO items for Re-ETA (meta + items)
        // SP should return:
        //   set#1 meta: TotalRows, Page, PageSize
        //   set#2 items: rows
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPurchaseOrderItemsAsync(
            string? poNumber = null,
            string? status = null,
            string? attention = null,
            string? vendor = null,
            string? q = null,
            int page = 1,
            int pageSize = 50,
            bool eligibleOnly = true,
            CancellationToken ct = default)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 50;
            if (pageSize > 200) pageSize = 200;

            var dp = new DynamicParameters();

            AddString(dp, "PONumber", poNumber);

            // allow FE send "onDelivery" OR "On Delivery"
            if (!string.IsNullOrWhiteSpace(status))
            {
                var key = status.Trim();
                dp.Add("Status", StatusMap.TryGetValue(key, out var mapped) ? mapped : key);
            }

            AddString(dp, "Attention", attention);
            AddString(dp, "Vendor", vendor);
            AddString(dp, "Search", q);

            dp.Add("EligibleOnly", eligibleOnly ? 1 : 0);
            dp.Add("Page", page);
            dp.Add("PageSize", pageSize);

            using var cn = _db.CreateMain();

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PO_ITEMS_ELIGIBLE_REETA,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                // meta
                var metaRow = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
                var meta = metaRow != null ? ToDict(metaRow) : new Dictionary<string, object?>();

                // normalize fallback
                meta.TryAdd("Page", page);
                meta.TryAdd("PageSize", pageSize);
                if (!meta.ContainsKey("TotalRows")) meta["TotalRows"] = 0L;

                // items
                var items = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();

                // fallback total if SP doesn't provide
                if (ToLongOrZero(meta["TotalRows"]) == 0 && items.Count > 0)
                    meta["TotalRows"] = items.Count;

                return new Dictionary<string, object?>
                {
                    ["meta"] = meta,
                    ["items"] = items
                };
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PO_ITEMS_ELIGIBLE_REETA}: {ex.Message}", ex);
            }
        }

        // ------------------------------------------------------------
        // Purchase_Order_Needing_Update_SP -> 2 result sets: items + pagination
        // ------------------------------------------------------------
        public async Task<Dictionary<string, object?>> GetPurchaseOrdersNeedingUpdateAsync(
            string? vendorName = null,
            string? plant = null,
            string? storageLocation = null,
            string? purchasingGroup = null,
            string? purchasingDocType = null,
            string? keyword = null,
            int page = 1,
            int pageSize = 10,
            CancellationToken ct = default)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 10;
            if (pageSize > 1000) pageSize = 1000;

            var dp = new DynamicParameters();
            AddString(dp, "VendorName", vendorName);
            AddString(dp, "Plant", plant);
            AddString(dp, "StorageLocation", storageLocation);
            AddString(dp, "PurchasingGroup", purchasingGroup);
            AddString(dp, "PurchasingDocType", purchasingDocType);
            AddString(dp, "Keyword", keyword);
            dp.Add("PageNumber", page);
            dp.Add("PageSize", pageSize);

            using var cn = _db.CreateMain();

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PO_NEEDING_UPDATE,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                // result set #1: items
                var items = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();

                // result set #2: pagination info
                var metaRow = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
                var meta = metaRow != null ? ToDict(metaRow) : new Dictionary<string, object?>();

                // normalize fallback
                meta.TryAdd("TotalFiltered", 0L);
                meta.TryAdd("PageSize", pageSize);
                meta.TryAdd("PageNumber", page);
                meta.TryAdd("TotalPages", 0L);

                return new Dictionary<string, object?>
                {
                    ["items"] = items,
                    ["meta"] = meta
                };
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PO_NEEDING_UPDATE}: {ex.Message}", ex);
            }
        }

        // =========================================================
        // Internal helpers
        // =========================================================
        private async Task<List<Dictionary<string, object?>>> QueryListSpAsync(
            string spName,
            Action<DynamicParameters> buildParams,
            CancellationToken ct)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            buildParams(dp);

            try
            {
                var rows = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    spName,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).ToList();

                return rows.Select(ToDict).ToList();
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {spName}: {ex.Message}", ex);
            }
        }

        private static Dictionary<string, object?> MergeSummary(Dictionary<string, object?> firstRow)
        {
            var merged = DefaultSummary();

            foreach (var k in SummaryKeys)
            {
                var v = TryGetValueCaseInsensitive(firstRow, k);

                if (!k.Equals("FilterStatus", StringComparison.OrdinalIgnoreCase))
                    merged[k] = ToLongOrZero(v);
                else
                    merged[k] = v;
            }

            // extras: kolom lain dari SP yang belum masuk SummaryKeys
            foreach (var kv in firstRow)
            {
                if (!SummaryKeys.Any(x => x.Equals(kv.Key, StringComparison.OrdinalIgnoreCase)))
                    merged[kv.Key] = kv.Value;
            }

            return merged;
        }

        private static void AddDate(DynamicParameters dp, string name, DateTime? value)
        {
            if (value != null) dp.Add(name, value.Value.Date);
        }

        private static void AddString(DynamicParameters dp, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                dp.Add(name, value.Trim());
        }

        private static bool HasKey(Dictionary<string, object?> dict, string key)
            => dict.Keys.Any(k => k.Equals(key, StringComparison.OrdinalIgnoreCase));

        private static object? TryGetValueCaseInsensitive(Dictionary<string, object?> dict, string key)
        {
            foreach (var kv in dict)
                if (kv.Key.Equals(key, StringComparison.OrdinalIgnoreCase))
                    return kv.Value;

            return null;
        }

        private static DynamicParameters ToDynamicParamsRemovingNull(Dictionary<string, object?> dict)
        {
            var dp = new DynamicParameters();
            foreach (var kv in dict)
                if (kv.Value != null)
                    dp.Add(kv.Key, kv.Value);

            return dp;
        }

        private static Dictionary<string, object?> ToDict(dynamic row)
        {
            // DapperRow implements IDictionary<string, object>
            var dict = (IDictionary<string, object>)row;
            return dict.ToDictionary(k => k.Key, v => (object?)v.Value);
        }

        private static long ToLongOrZero(object? v)
        {
            if (v is null) return 0;

            try
            {
                return v switch
                {
                    long l => l,
                    int i => i,
                    short s => s,
                    byte b => b,
                    decimal d => (long)d,
                    double db => (long)db,
                    float f => (long)f,
                    string str when long.TryParse(str, out var n) => n,
                    _ => Convert.ToInt64(v)
                };
            }
            catch
            {
                return 0;
            }
        }

        // =========================================================
        // Vendor Performance Overview
        // =========================================================
        private const string SP_VENDOR_PERFORMANCE_OVERVIEW = "[exp].[Vendor_Performance_Overview_SP]";
        private const string SP_VENDOR_EVALUATION_SUMMARY = "[exp].[Vendor_Evaluation_Summary_SP]";

        public async Task<Dictionary<string, object?>> GetVendorPerformanceOverviewAsync(
            string vendorName,
            string plant,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(vendorName))
                return new Dictionary<string, object?>();

            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("VendorName", vendorName.Trim());
            if (!string.IsNullOrWhiteSpace(plant))
            {
                dp.Add("plant", plant.Trim());

            }

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_VENDOR_PERFORMANCE_OVERVIEW,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_VENDOR_PERFORMANCE_OVERVIEW}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> GetVendorEvaluationSummaryAsync(
            string role,
            string plant,
            string? vendorName = null,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("Role", role?.Trim() ?? "");
            if (!string.IsNullOrWhiteSpace(vendorName))
                dp.Add("VendorName", vendorName.Trim());


            if (!string.IsNullOrWhiteSpace(plant))
            {
                dp.Add("plant", plant.Trim());

            }

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_VENDOR_EVALUATION_SUMMARY,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                var isVendorRole = string.Equals(role?.Trim(), "VENDOR", StringComparison.OrdinalIgnoreCase);

                if (isVendorRole)
                {
                    var items = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();
                    return new Dictionary<string, object?>
                    {
                        ["items"] = items
                    };
                }
                else
                {
                    var vendors = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();
                    var items = !grid.IsConsumed
                        ? (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList()
                        : new List<Dictionary<string, object?>>();

                    return new Dictionary<string, object?>
                    {
                        ["vendors"] = vendors,
                        ["items"] = items
                    };
                }
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_VENDOR_EVALUATION_SUMMARY}: {ex.Message}", ex);
            }
        }
    }
}