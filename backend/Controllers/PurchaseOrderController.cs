using System;
using System.Collections.Generic;
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
    [Route("api/purchase-order")]
    [Authorize]
    public sealed class PurchaseOrderController : ControllerBase
    {
        private readonly IPurchaseOrderService _po;
        private readonly IPurchaseOrderImportService _import;

        private static readonly Dictionary<string, string> StatusMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["submitted"] = "Submitted",
            ["workInProgress"] = "Work In Progress",
            ["onDelivery"] = "On Delivery",
            ["partiallyReceived"] = "Partially Received",
            ["fullyReceived"] = "Fully Received",
            ["received"] = "Received",
            ["cancel"] = "cancel",
        };

        public PurchaseOrderController(
            IPurchaseOrderService po,
            IPurchaseOrderImportService import)
        {
            _po = po ?? throw new ArgumentNullException(nameof(po));
            _import = import ?? throw new ArgumentNullException(nameof(import));
        }

        // GET /api/purchase-order/summary
        [HttpGet("summary")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Summary(
            [FromQuery] string? status,
            [FromQuery] int? attention,
            [FromQuery] string? vendorName,
            [FromQuery] string? plant,
            [FromQuery] string? storageLocation,
            [FromQuery] string? purchasingGroup,
            [FromQuery] string? purchasingDocType,
            [FromQuery] string? keyword,
            [FromQuery] int? pageNumber,
            [FromQuery] int? pageSize,
            CancellationToken ct)
        {
            var spParams = new Dictionary<string, object?>();

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!TryMapStatus(status, out var mappedStatus))
                {
                    return BadRequestResponse(
                        "invalid status value. Allowed values: submitted, workInProgress, onDelivery, partiallyReceived, fullyReceived"
                    );
                }

                spParams["Status"] = mappedStatus;
            }

            if (attention.HasValue)
            {
                if (!IsValidAttention(attention.Value))
                {
                    return BadRequestResponse(
                        "invalid attention value. Allowed values: 1 (Need Update), 2 (Overdue)"
                    );
                }

                spParams["Attention"] = attention.Value;
            }

            if (!string.IsNullOrWhiteSpace(vendorName))
                spParams["VendorName"] = vendorName.Trim();

            if (!string.IsNullOrWhiteSpace(plant))
                spParams["Plant"] = plant.Trim();

            if (!string.IsNullOrWhiteSpace(storageLocation))
                spParams["StorageLocation"] = storageLocation.Trim();

            if (!string.IsNullOrWhiteSpace(purchasingGroup))
                spParams["PurchasingGroup"] = purchasingGroup.Trim();

            if (!string.IsNullOrWhiteSpace(purchasingDocType))
                spParams["PurchasingDocType"] = purchasingDocType.Trim();

            if (!string.IsNullOrWhiteSpace(keyword))
                spParams["Keyword"] = keyword.Trim();

            if (pageNumber.HasValue)
            {
                if (pageNumber.Value < 1)
                {
                    return BadRequestResponse("invalid pageNumber. Minimum value is 1.");
                }

                spParams["PageNumber"] = pageNumber.Value;
            }

            if (pageSize.HasValue)
            {
                if (pageSize.Value < 1)
                {
                    return BadRequestResponse("invalid pageSize. Minimum value is 1.");
                }

                //if (pageSize.Value > 1000)
                //{
                //    return BadRequestResponse("invalid pageSize. Maximum value is 1000.");
                //}

                spParams["PageSize"] = pageSize.Value;
            }

            try
            {
                var data = await _po.GetPurchaseOrderSummaryAsync(spParams, ct);
                return OkResponse("purchase order summary retrieved", data);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase order summary: {ex.Message}");
            }
        }

        // GET /api/purchase-order/master
        [HttpGet("master")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Master(
            [FromQuery] string? status,
            [FromQuery] int? attention,
            [FromQuery] string? vendorName,
            CancellationToken ct)
        {
            string? mappedStatus = null;

            if (!string.IsNullOrWhiteSpace(status))
            {
                if (!TryMapStatus(status, out var statusValue))
                {
                    return BadRequestResponse(
                        "invalid status value. Allowed values: submitted, workInProgress, onDelivery, partiallyReceived, fullyReceived"
                    );
                }

                mappedStatus = statusValue;
            }

            if (attention.HasValue && !IsValidAttention(attention.Value))
            {
                return BadRequestResponse(
                    "invalid attention value. Allowed values: 1 (Need Update), 2 (Overdue)"
                );
            }

            try
            {
                var data = await _po.GetPurchaseOrderMasterAsync(
                    mappedStatus,
                    attention,
                    Normalize(vendorName),
                    ct
                );

                return OkResponse("purchase order master retrieved", data);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase order master: {ex.Message}");
            }
        }

        // GET /api/purchase-order/{poid}/detail
        [HttpGet("{poid}/detail")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Detail(
            [FromRoute] string poid,
            [FromQuery] string? type,
            CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(poid))
                return BadRequestResponse("POID is required");

            try
            {
                var (statusFlow, reEtaRequests, poDetail) = await _po.GetPurchaseOrderDetailAsync(poid, type, ct);

                return OkResponse("purchase order detail retrieved", new
                {
                    StatusFlow = statusFlow,
                    ReEtaRequests = reEtaRequests,
                    PoDetail = poDetail
                });
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase order detail: {ex.Message}");
            }
        }

        // GET /api/purchase-order/items
        [HttpGet("items")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Items(
            [FromQuery] string? poNumber,
            [FromQuery] string? status,
            [FromQuery] string? attention,
            [FromQuery] string? vendor,
            [FromQuery] string? q,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50,
            [FromQuery] bool eligibleOnly = true,
            CancellationToken ct = default)
        {
            try
            {
                var data = await _po.GetPurchaseOrderItemsAsync(
                    poNumber,
                    status,
                    attention,
                    vendor,
                    q,
                    page,
                    pageSize,
                    eligibleOnly,
                    ct
                );

                return Ok(ApiResponse.Ok("purchase order items retrieved", data, 200));
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    ApiResponse.Fail($"failed to fetch purchase order items: {ex.Message}", 500, null)
                );
            }
        }

        // GET /api/purchase-order/needing-update
        [HttpGet("needing-update")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> NeedingUpdate(
            [FromQuery] string? vendorName,
            [FromQuery] string? plant,
            [FromQuery] string? storageLocation,
            [FromQuery] string? purchasingGroup,
            [FromQuery] string? purchasingDocType,
            [FromQuery] string? keyword,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            CancellationToken ct = default)
        {
            if (page < 1)
                return BadRequestResponse("invalid page. Minimum value is 1.");

            if (pageSize < 1)
                return BadRequestResponse("invalid pageSize. Minimum value is 1.");

            if (pageSize > 1000)
                return BadRequestResponse("invalid pageSize. Maximum value is 1000.");

            try
            {
                var data = await _po.GetPurchaseOrdersNeedingUpdateAsync(
                    Normalize(vendorName),
                    Normalize(plant),
                    Normalize(storageLocation),
                    Normalize(purchasingGroup),
                    Normalize(purchasingDocType),
                    Normalize(keyword),
                    page,
                    pageSize,
                    ct
                );

                return OkResponse("purchase orders needing update retrieved", data);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase orders needing update: {ex.Message}");
            }
        }

        [HttpPost("import")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Import(
     [FromForm] PurchaseOrderImportRequest request,
     CancellationToken ct)
        {
            if (request == null)
            {
                return BadRequestResponse("request is required");
            }

            if (request.ME2NFile == null || request.ME2NFile.Length == 0)
            {
                return BadRequestResponse("ME2N file is required");
            }

            if (request.ME5AFile == null || request.ME5AFile.Length == 0)
            {
                return BadRequestResponse("ME5A file is required");
            }

            if (request.ZMM013RFile == null || request.ZMM013RFile.Length == 0)
            {
                return BadRequestResponse("ZMM013R file is required");
            }

            try
            {
                var result = await _import.ImportPurchaseOrderTransactionsAsync(
                    request.ME2NFile,
                    request.ME5AFile,
                    request.ZMM013RFile,
                    ct
                );

                return CreatedResponse("purchase order data imported", result);
            }
            catch (ArgumentException ex)
            {
                return BadRequestResponse(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequestResponse(ex.Message);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to import purchase order data: {ex.Message}");
            }
        }

        // =========================================================
        // Helpers
        // =========================================================
        private static bool TryMapStatus(string rawStatus, out string mappedStatus)
        {
            mappedStatus = string.Empty;

            if (string.IsNullOrWhiteSpace(rawStatus))
                return false;

            return StatusMap.TryGetValue(rawStatus.Trim(), out mappedStatus!);
        }

        private static bool IsValidAttention(int attention)
            => attention == 1 || attention == 2;

        private static string? Normalize(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private IActionResult OkResponse(string message, object? data)
            => Ok(ApiResponse.Ok(message, data, StatusCodes.Status200OK));

        private IActionResult CreatedResponse(string message, object? data)
            => StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(message, data, StatusCodes.Status201Created));

        private IActionResult BadRequestResponse(string message, object? data = null)
            => BadRequest(ApiResponse.Fail(message, StatusCodes.Status400BadRequest, data));

        private IActionResult ServerErrorResponse(string message, object? data = null)
            => StatusCode(
                StatusCodes.Status500InternalServerError,
                ApiResponse.Fail(message, StatusCodes.Status500InternalServerError, data)
            );
    }

    //public sealed class PurchaseOrderImportRequest
    //{
    //    [FromForm(Name = "file")]
    //    public IFormFile? File { get; set; }
    //}
}
