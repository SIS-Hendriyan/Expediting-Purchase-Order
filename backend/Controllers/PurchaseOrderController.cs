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
        public async Task<IActionResult> Summary([FromQuery] string? status, CancellationToken ct)
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
