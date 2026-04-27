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
    public sealed class ReEtaRequestService : IReEtaRequestService
    {
        private readonly IDbConnectionFactory _db;

        private const string SP_PAGED = "[exp].[PO_RE_ETA_REQUEST_PAGED_SP]";
        private const string SP_DETAIL = "[exp].[PO_RE_ETA_REQUEST_DETAIL_SP]";
        private const string SP_CREATE = "[exp].[PO_RE_ETA_REQUEST_CREATE_SP]";
        private const string SP_APPROVE = "[exp].[PO_RE_ETA_REQUEST_APPROVE_SP]";
        private const string SP_REJECT = "[exp].[PO_RE_ETA_REQUEST_REJECT_SP]";
        private const string SP_VENDOR_RESPONSE = "[exp].[PO_RE_ETA_REQUEST_VENDOR_RESPONSE_SP]";
        private const string SP_DOC_GET = "[exp].[DOCUMENT_GET_SP]";

        public ReEtaRequestService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        // ✅ 3 resultset: summary + meta + items
        public async Task<Dictionary<string, object?>> GetPagedAsync(
            string? q = null,
            string? status = null,
            string? poNumber = null,
            string? vendorCode = null,
            DateTime? from = null,
            DateTime? to = null,
            int page = 1,
            int pageSize = 20,
            CancellationToken ct = default)
        {
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 20;
            if (pageSize > 200) pageSize = 200;

            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            AddString(dp, "Q", q);
            AddString(dp, "Status", status);
            AddString(dp, "PONumber", poNumber);
            AddString(dp, "VendorCode", vendorCode);
            AddDate(dp, "From", from);
            AddDate(dp, "To", to);
            dp.Add("Page", page);
            dp.Add("PageSize", pageSize);

            try
            {
                using var grid = await cn.QueryMultipleAsync(new CommandDefinition(
                    SP_PAGED,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ));

                // Resultset #1 Summary (single row)
                var summaryRow = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
                var summary = summaryRow != null ? ToDict(summaryRow) : new Dictionary<string, object?>();

                // Resultset #2 Meta (single row)
                var metaRow = (await grid.ReadAsync<dynamic>()).FirstOrDefault();
                var meta = metaRow != null ? ToDict(metaRow) : new Dictionary<string, object?>();

                // Resultset #3 Items (many rows)
                var items = (await grid.ReadAsync<dynamic>()).Select(ToDict).ToList();

                // fallback normalize meta (optional)
                meta.TryAdd("Page", page);
                meta.TryAdd("PageSize", pageSize);
                if (!meta.ContainsKey("TotalRows")) meta["TotalRows"] = items.Count;

                return new Dictionary<string, object?>
                {
                    ["summary"] = summary,
                    ["meta"] = meta,
                    ["items"] = items
                };
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_PAGED}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> GetDetailAsync(
            string? id = null,
            string? purchaseDocument = null,
            string? item = null,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            try
            {
                var dp = new DynamicParameters();
                if(id != "0")
                {
                    dp.Add("ID", id);

                }
                dp.Add("PurchaseDocument", purchaseDocument);
                dp.Add("Item", item);

                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_DETAIL,
                    dp,
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
           
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_DETAIL}: {ex.Message}", ex);
            }
        }

        // ✅ Proposed ETA = INT days
        public async Task<Dictionary<string, object?>> CreateAsync(
            string idPoItem,
            string? poNumber,
            string? poItemNo,
            string? vendorCode,
            string? vendorName,
            DateTime? currentEta,
            int? proposedEtaDays,
            string reason,
            int? delayReasonId,
            string? evidenceFileName,
            string? evidenceContentType,
            long? evidenceSize,
            string? evidenceBase64,
            string createdBy,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("ID_PO_Item", idPoItem);
            dp.Add("CurrentETA", currentEta?.Date);
            dp.Add("ProposedETADays", proposedEtaDays); // ✅ match SP
            dp.Add("Reason", reason);
            dp.Add("DelayReasonID", delayReasonId);

            dp.Add("EvidenceFileName", evidenceFileName);
            dp.Add("EvidenceContentType", evidenceContentType);
            dp.Add("EvidenceSize", evidenceSize);
            dp.Add("EvidenceBase64", evidenceBase64);

            dp.Add("CreatedBy", createdBy);

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_CREATE, dp, commandType: CommandType.StoredProcedure, cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_CREATE}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> ApproveAsync(
            string id,
            string feedback,
            string? fileName,
            string? contentType,
            long? fileSize,
            string? base64,
            string by,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("ID", id);
            dp.Add("Feedback", feedback);
            dp.Add("FileName", fileName);
            dp.Add("ContentType", contentType);
            dp.Add("FileSize", fileSize);
            dp.Add("Base64", base64);
            dp.Add("By", by);

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_APPROVE, dp, commandType: CommandType.StoredProcedure, cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_APPROVE}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> RejectAsync(
            string id,
            string feedback,
            string fileName,
            string? contentType,
            long? fileSize,
            string base64,
            string by,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("ID", id);
            dp.Add("Feedback", feedback);
            dp.Add("FileName", fileName);
            dp.Add("ContentType", contentType);
            dp.Add("FileSize", fileSize);
            dp.Add("Base64", base64);
            dp.Add("By", by);

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_REJECT, dp, commandType: CommandType.StoredProcedure, cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_REJECT}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> UploadVendorResponseAsync(
            string id,
            string fileName,
            string? contentType,
            long? fileSize,
            string base64,
            string by,
            CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            var dp = new DynamicParameters();
            dp.Add("ID", id);
            dp.Add("FileName", fileName);
            dp.Add("ContentType", contentType);
            dp.Add("FileSize", fileSize);
            dp.Add("Base64", base64);
            dp.Add("By", by);

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_VENDOR_RESPONSE, dp, commandType: CommandType.StoredProcedure, cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_VENDOR_RESPONSE}: {ex.Message}", ex);
            }
        }

        public async Task<Dictionary<string, object?>> GetDocumentAsync(long docId, CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            try
            {
                var row = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_DOC_GET,
                    new { DOC_ID = docId },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).FirstOrDefault();

                return row == null ? new Dictionary<string, object?>() : ToDict(row);
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_DOC_GET}: {ex.Message}", ex);
            }
        }

        // -------------------------
        // Helpers
        // -------------------------
        private static void AddString(DynamicParameters dp, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
                dp.Add(name, value.Trim());
        }

        private static void AddDate(DynamicParameters dp, string name, DateTime? value)
        {
            if (value != null)
                dp.Add(name, value.Value.Date);
        }

        private static Dictionary<string, object?> ToDict(dynamic row)
        {
            var dict = (IDictionary<string, object>)row; // DapperRow implements IDictionary
            return dict.ToDictionary(k => k.Key, v => (object?)v.Value);
        }


    }
}
