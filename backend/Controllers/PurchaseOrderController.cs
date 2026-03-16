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

        // status mapping sama seperti Python
        private static readonly Dictionary<string, string> StatusMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["submitted"] = "Submitted",
            ["workInProgress"] = "Work In Progress",
            ["onDelivery"] = "On Delivery",
            ["partiallyReceived"] = "Partially Received",
            ["fullyReceived"] = "Fully Received",
        };

        public PurchaseOrderController(IPurchaseOrderService po, IPurchaseOrderImportService import)
        {
            _po = po ?? throw new ArgumentNullException(nameof(po));
            _import = import ?? throw new ArgumentNullException(nameof(import));
        }

        // GET /api/purchase-order/summary
        [HttpGet("summary")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
<<<<<<< Updated upstream
        public async Task<IActionResult> Summary([FromQuery] string? status,int? Attraction, CancellationToken ct)
=======
        public async Task<IActionResult> Summary(
     [FromQuery] string? status,
     [FromQuery] int? attention,
     [FromQuery] string? vendorName,
     [FromQuery] string? plant,
     [FromQuery] string? storageLocation,
     [FromQuery] string? purchasingGroup,
     [FromQuery] string? purchasingDocType,
     [FromQuery] int? pageNumber,
     [FromQuery] int? pageSize,
     CancellationToken ct)
>>>>>>> Stashed changes
        {
            var spParams = new Dictionary<string, object?>();

            if (!string.IsNullOrWhiteSpace(status))
            {
                var key = status.Trim();

                if (!StatusMap.TryGetValue(key, out var mapped))
                {
                    return BadRequestResponse(
                        "invalid status value. Allowed values: submitted, workInProgress, onDelivery, partiallyReceived, fullyReceived"
                    );
                }

                spParams["Status"] = mapped;
            }

            if (Attraction.HasValue)
            {
                if (Attraction.Value != 1 && Attraction.Value != 2)
                {
                    return BadRequestResponse("invalid attention value. Allowed values: 1 (Need Update), 2 (Overdue)");
                }

<<<<<<< Updated upstream
                spParams["Attention"] = Attraction.Value; // ✅ matches SP param name
=======
                spParams["Attention"] = attention.Value;
            }

            if (!string.IsNullOrWhiteSpace(vendorName))
            {
                spParams["VendorName"] = vendorName.Trim();
            }

            if (!string.IsNullOrWhiteSpace(plant))
            {
                spParams["Plant"] = plant.Trim();
            }

            if (!string.IsNullOrWhiteSpace(storageLocation))
            {
                spParams["StorageLocation"] = storageLocation.Trim();
            }

            if (!string.IsNullOrWhiteSpace(purchasingGroup))
            {
                spParams["PurchasingGroup"] = purchasingGroup.Trim();
            }

            if (!string.IsNullOrWhiteSpace(purchasingDocType))
            {
                spParams["PurchasingDocType"] = purchasingDocType.Trim();
            }

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

                if (pageSize.Value > 1000)
                {
                    return BadRequestResponse("invalid pageSize. Maximum value is 1000.");
                }

                spParams["PageSize"] = pageSize.Value;
>>>>>>> Stashed changes
            }

            try
            {
                var data = await _po.GetPurchaseOrderSummaryAsync(spParams, ct);
                return OkResponse("purchase order summary retrieved", data);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase order summary: {ex.Message}");
            }
        }

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
                var key = status.Trim();

                if (!StatusMap.TryGetValue(key, out var mapped))
                {
                    return BadRequestResponse(
                        "invalid status value. Allowed values: submitted, workInProgress, onDelivery, partiallyReceived, fullyReceived"
                    );
                }

                mappedStatus = mapped;
            }

            if (attention.HasValue)
            {
                if (attention.Value != 1 && attention.Value != 2)
                {
                    return BadRequestResponse(
                        "invalid attention value. Allowed values: 1 (Need Update), 2 (Overdue)"
                    );
                }
            }

            try
            {
                var data = await _po.GetPurchaseOrderMasterAsync(
                    mappedStatus,
                    attention,
                    string.IsNullOrWhiteSpace(vendorName) ? null : vendorName.Trim(),
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
        public async Task<IActionResult> Detail([FromRoute] string poid, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(poid))
                return BadRequestResponse("POID is required");

            try
            {
                var (statusFlow, reEtaRequests) = await _po.GetPurchaseOrderDetailAsync(poid, ct);
                return OkResponse("purchase order detail retrieved", new
                {
                    StatusFlow = statusFlow,
                    ReEtaRequests = reEtaRequests
                });
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to fetch purchase order detail: {ex.Message}");
            }
        }

        // GET /api/purchase-order/items
        [HttpGet("items")]
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
                var data = await _po.GetPurchaseOrderItemsAsync(poNumber, status, attention, vendor, q, page, pageSize, eligibleOnly, ct);
                return Ok(ApiResponse.Ok("purchase order items retrieved", data, 200));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse.Fail($"failed to fetch purchase order items: {ex.Message}", 500, null));
            }
        }

        // POST /api/purchase-order/import
        [HttpPost("import")]
        [Consumes("multipart/form-data")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Import([FromForm] PurchaseOrderImportRequest request, CancellationToken ct)
        {
            var file = request?.File;

            if (file == null || file.Length == 0)
                return BadRequestResponse("file is required");

            try
            {
                var result = await _import.ImportPurchaseOrderTransactionsAsync(file, ct);
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
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to import purchase order data: {ex.Message}");
            }
        }

        // =========================================================
        // Response helpers (responseCode ikut HTTP status)
        // =========================================================
        private IActionResult OkResponse(string message, object? data)
            => Ok(ApiResponse.Ok(message, data, 200));

        private IActionResult CreatedResponse(string message, object? data)
            => StatusCode(StatusCodes.Status201Created, ApiResponse.Ok(message, data, 201));

        private IActionResult BadRequestResponse(string message, object? data = null)
            => BadRequest(ApiResponse.Fail(message, 400, data));

        private IActionResult ServerErrorResponse(string message, object? data = null)
            => StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.Fail(message, 500, data));
    }

    // DTO untuk Swagger multipart/form-data
    public sealed class PurchaseOrderImportRequest
    {
        [FromForm(Name = "file")]
        public IFormFile? File { get; set; }
    }
}
