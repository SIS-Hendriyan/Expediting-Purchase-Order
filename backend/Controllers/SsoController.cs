using System;
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
    [Route("api/sso")]
    [Authorize] // @jwt_required()
    public sealed class SsoController : ControllerBase
    {
        private readonly ISsoAuthService _sso;

        public SsoController(ISsoAuthService sso)
        {
            _sso = sso ?? throw new ArgumentNullException(nameof(sso));
        }

        // GET /api/sso/get-user?nrp=...
        [HttpGet("get-user")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status502BadGateway)]
        public async Task<IActionResult> GetUser([FromQuery] string? nrp, CancellationToken ct)
        {
            nrp = (nrp ?? "").Trim();
            if (string.IsNullOrWhiteSpace(nrp))
                return BadRequestResponse("nrp query parameter is required");

            try
            {
                // Python get_sso_user(nrp) -> returns dict {FullName, Email} or None
                var user = await _sso.GetUserAsync(nrp, ct);

                if (user == null)
                    return NotFoundResponse("user not found in SSO");

                return OkResponse("sso user retrieved", user);
            }
            catch (InvalidOperationException ex)
            {
                // Mis: "SSO integration is not configured"
                return BadGatewayResponse(ex.Message);
            }
            catch (Exception ex)
            {
                // Transport / SOAP error => 502
                return BadGatewayResponse(ex.Message);
            }
        }

        // =========================================================
        // Response helpers (responseCode ikut HTTP status)
        // =========================================================
        private IActionResult OkResponse(string message, object? data)
            => Ok(ApiResponse.Ok(message, data, 200));

        private IActionResult BadRequestResponse(string message, object? data = null)
            => BadRequest(ApiResponse.Fail(message, 400, data));

        private IActionResult NotFoundResponse(string message, object? data = null)
            => NotFound(ApiResponse.Fail(message, 404, data));

        private IActionResult BadGatewayResponse(string message, object? data = null)
            => StatusCode(StatusCodes.Status502BadGateway, ApiResponse.Fail(message, 502, data));
    }
}
