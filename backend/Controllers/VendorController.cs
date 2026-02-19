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
    [Route("api/vendor")]
    [Authorize]
    public sealed class VendorController : ControllerBase
    {
        private readonly IVendorService _svc;

        public VendorController(IVendorService svc)
        {
            _svc = svc ?? throw new ArgumentNullException(nameof(svc));
        }

        // GET /api/vendors?email=...
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> List([FromQuery] string? email, CancellationToken ct)
        {
            try
            {
                var data = await _svc.ListVendorsAsync(email, ct);
                return OkResponse("vendors retrieved", data);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to list vendors: {ex.Message}");
            }
        }

        // GET /api/vendors/{vendorId}
        [HttpGet("{vendorId:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Detail([FromRoute] int vendorId, CancellationToken ct)
        {
            try
            {
                var data = await _svc.GetVendorDetailAsync(vendorId, ct);
                if (data == null)
                    return NotFoundResponse("vendor not found");

                return OkResponse("vendor retrieved", data);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to retrieve vendor: {ex.Message}");
            }
        }

        // POST /api/vendors
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Create([FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
        {
            if (payload == null || payload.Count == 0)
                return BadRequestResponse("body is required");

            try
            {
                var result = await _svc.CreateVendorAsync(payload, User, ct);
                return CreatedResponse("vendor created", result);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to create vendor: {ex.Message}");
            }
        }

        // PUT /api/vendors/{vendorId}
        [HttpPut("{vendorId:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Update([FromRoute] int vendorId, [FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
        {
            if (payload == null || payload.Count == 0)
                return BadRequestResponse("body is required");

            try
            {
                var result = await _svc.UpdateVendorAsync(vendorId, payload, User, ct);
                return OkResponse("vendor updated", result);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to update vendor: {ex.Message}");
            }
        }

        // POST /api/vendors/{vendorId}/access
        [HttpPost("{vendorId:int}/access")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> UpdateAccess([FromRoute] int vendorId, [FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
        {
            if (payload == null || payload.Count == 0 || !payload.ContainsKey("IsAccess"))
                return BadRequestResponse("IsAccess is required");

            try
            {
                var result = await _svc.UpdateVendorAccessAsync(vendorId, payload, User, ct);
                return OkResponse("vendor access updated", result);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to update vendor access: {ex.Message}");
            }
        }

        // DELETE /api/vendors/{vendorId}
        [HttpDelete("{vendorId:int}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete([FromRoute] int vendorId, [FromBody] Dictionary<string, object?>? payload, CancellationToken ct)
        {
            payload ??= new Dictionary<string, object?>(); // python allow empty payload for delete

            try
            {
                var result = await _svc.DeleteVendorAsync(vendorId, payload, User, ct);
                return OkResponse("vendor deleted", result);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to delete vendor: {ex.Message}");
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

        private IActionResult NotFoundResponse(string message, object? data = null)
            => NotFound(ApiResponse.Fail(message, 404, data));

        private IActionResult ServerErrorResponse(string message, object? data = null)
            => StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.Fail(message, 500, data));
    }
}
