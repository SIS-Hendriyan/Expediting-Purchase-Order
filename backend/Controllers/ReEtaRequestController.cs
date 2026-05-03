using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace EXPOAPI.Controllers
{
    [ApiController]
    [Route("api/re-eta")]
    [Authorize]
    public sealed class ReEtaRequestController : ControllerBase
    {
        private readonly IReEtaRequestService _reEta;
        private readonly IReEtaRequestLogService _log;

        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg"
        };

        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg"
        };

        private const long MaxFileSize = 1_048_576; // 1 MB

        public ReEtaRequestController(IReEtaRequestService reEta, IReEtaRequestLogService log)
        {
            _reEta = reEta ?? throw new ArgumentNullException(nameof(reEta));
            _log = log ?? throw new ArgumentNullException(nameof(log));
        }

        // =========================================================
        // GET /api/re-eta/requests
        // -> return { summary, meta, items }
        // =========================================================
        [HttpGet("requests")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetPaged(
            [FromQuery] string? q,
            [FromQuery] string? status,
            [FromQuery] string? poNumber,
            [FromQuery] string? vendorCode,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken ct = default)
        {
            try
            {
                var data = await _reEta.GetPagedAsync(q, status, poNumber, vendorCode, from, to, page, pageSize, ct);
                return Ok(ApiResponse.Ok("re-eta requests retrieved", data, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to fetch re-eta requests: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // GET /api/re-eta/requests/{id}
        // id is STRING (NVARCHAR) e.g. POREETANUMBER or request key
        // =========================================================
        [HttpGet("requests/{id?}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetDetail(
            [FromRoute] string? id = null,
            [FromQuery] string? purchaseDocument = null,
            [FromQuery] string? item = null,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(id) && string.IsNullOrWhiteSpace(purchaseDocument))
                return BadRequest(ApiResponse.Fail("invalid id or purchase document", 400, null));

            try
            {
                var data = await _reEta.GetDetailAsync(id, purchaseDocument, item, ct);
                return Ok(ApiResponse.Ok("re-eta request detail retrieved", data, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to fetch re-eta request detail: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // GET /api/re-eta/requests/{id}/logs
        // id MUST MATCH request identifier type (string)
        // =========================================================
        [HttpGet("requests/{id}/logs")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetLogs([FromRoute] long id, CancellationToken ct = default)
        {
            if (id <= 0)
                return BadRequest(ApiResponse.Fail("invalid id", 400, null));

            try
            {
                // NOTE: make service accept string id
                var logs = await _log.ListByRequestIdAsync(id, ct);
                return Ok(ApiResponse.Ok("re-eta request logs retrieved", logs, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to fetch re-eta request logs: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // POST /api/re-eta/requests
        // vendor create request (multipart form-data)
        // =========================================================
        [HttpPost("requests")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileSize)]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Create(
            [FromForm] ReEtaCreateMultipartRequest request,
            CancellationToken ct = default)
        {
            if (request == null)
                return BadRequest(ApiResponse.Fail("request body cannot be null", 400, null));

            if (string.IsNullOrWhiteSpace(request.IdPoItem))
                return BadRequest(ApiResponse.Fail("IdPoItem is required", 400, null));

            if (request.ProposedEtaDays == null || request.ProposedEtaDays < 0)
                return BadRequest(ApiResponse.Fail("ProposedEtaDays must be >= 0", 400, null));

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest(ApiResponse.Fail("Reason is required", 400, null));

            // Validate and read optional evidence file
            byte[]? evidenceBytes = null;
            string? evidenceFileName = null;
            string? evidenceContentType = null;
            long? evidenceSize = null;

            if (request.EvidenceFile != null && request.EvidenceFile.Length > 0)
            {
                var validation = ValidateFile(request.EvidenceFile, required: false);
                if (validation != null)
                    return BadRequest(ApiResponse.Fail(validation, 400, null));

                evidenceBytes = await ReadFileBytesAsync(request.EvidenceFile, ct);
                evidenceFileName = request.EvidenceFile.FileName;
                evidenceContentType = request.EvidenceFile.ContentType;
                evidenceSize = request.EvidenceFile.Length;
            }

            try
            {
                var createdBy = User?.FindFirst("nrp")?.Value ?? "SYSTEM";

                var result = await _reEta.CreateAsync(
                    request.IdPoItem,
                    request.PoNumber,
                    request.PoItemNo,
                    request.VendorCode,
                    request.VendorName,
                    request.NewETD,
                    request.CurrentETA,
                    request.ProposedEtaDays,
                    request.Reason,
                    request.DelayReasonId,
                    evidenceFileName,
                    evidenceContentType,
                    evidenceSize,
                    evidenceBytes,
                    createdBy,
                    ct
                );

                return StatusCode(StatusCodes.Status201Created,
                    ApiResponse.Ok("re-eta request created", result, 201));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to create re-eta request: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // POST /api/re-eta/requests/{id}/approve
        // admin approve (attachment optional)
        // =========================================================
        [HttpPost("requests/{id}/approve")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileSize)]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Approve(
            [FromRoute] string id,
            [FromForm] ReEtaApproveMultipartRequest request,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(ApiResponse.Fail("invalid id", 400, null));

            if (request == null)
                return BadRequest(ApiResponse.Fail("request body cannot be null", 400, null));

            if (string.IsNullOrWhiteSpace(request.Feedback))
                return BadRequest(ApiResponse.Fail("Feedback is required", 400, null));

            // Validate and read optional attachment file
            byte[]? attachmentBytes = null;
            string? fileName = null;
            string? contentType = null;
            long? fileSize = null;

            if (request.AttachmentFile != null && request.AttachmentFile.Length > 0)
            {
                var validation = ValidateFile(request.AttachmentFile, required: false);
                if (validation != null)
                    return BadRequest(ApiResponse.Fail(validation, 400, null));

                attachmentBytes = await ReadFileBytesAsync(request.AttachmentFile, ct);
                fileName = request.AttachmentFile.FileName;
                contentType = request.AttachmentFile.ContentType;
                fileSize = request.AttachmentFile.Length;
            }

            try
            {
                var by = User?.FindFirst("nrp")?.Value ?? "SYSTEM";

                var result = await _reEta.ApproveAsync(
                    id,
                    request.Feedback,
                    fileName,
                    contentType,
                    fileSize,
                    attachmentBytes,
                    by,
                    ct
                );

                return Ok(ApiResponse.Ok("re-eta request approved", result, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to approve re-eta request: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // POST /api/re-eta/requests/{id}/reject
        // admin reject (attachment REQUIRED)
        // =========================================================
        [HttpPost("requests/{id}/reject")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileSize)]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Reject(
            [FromRoute] string id,
            [FromForm] ReEtaRejectMultipartRequest request,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(ApiResponse.Fail("invalid id", 400, null));

            if (request == null)
                return BadRequest(ApiResponse.Fail("request body cannot be null", 400, null));

            if (string.IsNullOrWhiteSpace(request.Feedback))
                return BadRequest(ApiResponse.Fail("Feedback is required", 400, null));

            if (request.AttachmentFile == null || request.AttachmentFile.Length == 0)
                return BadRequest(ApiResponse.Fail("Attachment file is required for reject", 400, null));

            var validation = ValidateFile(request.AttachmentFile, required: true);
            if (validation != null)
                return BadRequest(ApiResponse.Fail(validation, 400, null));

            var attachmentBytes = await ReadFileBytesAsync(request.AttachmentFile, ct);
            var fileName = request.AttachmentFile.FileName;
            var contentType = request.AttachmentFile.ContentType;
            var fileSize = request.AttachmentFile.Length;

            try
            {
                var by = User?.FindFirst("nrp")?.Value ?? "SYSTEM";

                var result = await _reEta.RejectAsync(
                    id,
                    request.Feedback,
                    fileName,
                    contentType,
                    fileSize,
                    attachmentBytes,
                    by,
                    ct
                );

                return Ok(ApiResponse.Ok("re-eta request rejected", result, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to reject re-eta request: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // POST /api/re-eta/requests/{id}/vendor-response
        // vendor upload response (attachment required)
        // =========================================================
        [HttpPost("requests/{id}/vendor-response")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MaxFileSize)]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> VendorResponse(
            [FromRoute] string id,
            [FromForm] ReEtaVendorResponseMultipartRequest request,
            CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(id))
                return BadRequest(ApiResponse.Fail("invalid id", 400, null));

            if (request == null)
                return BadRequest(ApiResponse.Fail("request body cannot be null", 400, null));

            if (request.ResponseFile == null || request.ResponseFile.Length == 0)
                return BadRequest(ApiResponse.Fail("Response file is required", 400, null));

            var validation = ValidateFile(request.ResponseFile, required: true);
            if (validation != null)
                return BadRequest(ApiResponse.Fail(validation, 400, null));

            var responseBytes = await ReadFileBytesAsync(request.ResponseFile, ct);
            var fileName = request.ResponseFile.FileName;
            var contentType = request.ResponseFile.ContentType;
            var fileSize = request.ResponseFile.Length;

            try
            {
                var by = User?.FindFirst("nrp")?.Value ?? "SYSTEM";

                var result = await _reEta.UploadVendorResponseAsync(
                    id,
                    fileName,
                    contentType,
                    fileSize,
                    responseBytes,
                    by,
                    ct
                );

                return Ok(ApiResponse.Ok("vendor response uploaded", result, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to upload vendor response: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // GET /api/re-eta/documents/{docId}
        // =========================================================
        [HttpGet("documents/{docId:long}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> GetDocument([FromRoute] long docId, CancellationToken ct = default)
        {
            if (docId <= 0)
                return BadRequest(ApiResponse.Fail("invalid docId", 400, null));

            try
            {
                var doc = await _reEta.GetDocumentAsync(docId, ct);
                return Ok(ApiResponse.Ok("document retrieved", doc, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to fetch document: {ex.Message}", 500, null));
            }
        }

        // =========================================================
        // File validation & reading helpers
        // =========================================================

        private static string? ValidateFile(IFormFile file, bool required)
        {
            if (file == null || file.Length == 0)
            {
                if (required)
                    return "File is required.";
                return null;
            }

            if (file.Length > MaxFileSize)
                return $"File size exceeds the maximum allowed size of {MaxFileSize / 1024 / 1024} MB.";

            var contentType = file.ContentType?.Trim() ?? string.Empty;
            var extension = Path.GetExtension(file.FileName ?? string.Empty);

            if (!AllowedContentTypes.Contains(contentType))
                return $"Content type '{contentType}' is not allowed. Only PDF and image files (PNG, JPG, JPEG) are permitted.";

            if (!AllowedExtensions.Contains(extension))
                return $"File extension '{extension}' is not allowed. Only .pdf, .png, .jpg, and .jpeg files are permitted.";

            return null;
        }

        private static async Task<byte[]> ReadFileBytesAsync(IFormFile file, CancellationToken ct)
        {
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            return ms.ToArray();
        }
    }
}
