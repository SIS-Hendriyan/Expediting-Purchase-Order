using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{
    public interface IReEtaRequestService
    {
        Task<Dictionary<string, object?>> GetPagedAsync(
            string? q = null,
            string? status = null,
            string? poNumber = null,
            string? vendorCode = null,
            DateTime? from = null,
            DateTime? to = null,
            int page = 1,
            int pageSize = 20,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> GetDetailAsync(long id, CancellationToken ct = default);

        Task<Dictionary<string, object?>> CreateAsync(
            string idPoItem,
            string? poNumber,
            string? poItemNo,
            string? vendorCode,
            string? vendorName,
            DateTime? currentEta,
            int? proposedEtaDays,            // ✅ INT days
            string reason,

            // evidence doc (base64)
            string? evidenceFileName,
            string? evidenceContentType,
            long? evidenceSize,
            string? evidenceBase64,

            string createdBy,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> ApproveAsync(
            string id,
            string feedback,
            string? fileName,
            string? contentType,
            long? fileSize,
            string? base64,                  // optional
            string by,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> RejectAsync(
            string id,
            string feedback,
            string fileName,
            string? contentType,
            long? fileSize,
            string base64,                   // required
            string by,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> UploadVendorResponseAsync(
            string id,
            string fileName,
            string? contentType,
            long? fileSize,
            string base64,                   // required
            string by,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> GetDocumentAsync(long docId, CancellationToken ct = default);
    }

    public interface IReEtaRequestLogService
    {
        Task<List<Dictionary<string, object?>>> ListByRequestIdAsync(long requestId, CancellationToken ct = default);
    }
}