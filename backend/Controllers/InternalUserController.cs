using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXPOAPI.Controllers
{
    [ApiController]
    [Route("api/user")]
    [Authorize]
    public sealed class InternalUserController : ControllerBase
    {
        private readonly IInternalUserService _svc;

        public InternalUserController(IInternalUserService svc)
        {
            _svc = svc ?? throw new ArgumentNullException(nameof(svc));
        }

        // GET /api/user
        [HttpGet]
        public async Task<IActionResult> GetUsers(CancellationToken ct)
        {
            try
            {
                var data = await _svc.ListUsersAsync(ct);
                return OkResponse("users retrieved", data);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to list users: {ex.Message}");
            }
        }

        // GET /api/user/{userId}
        [HttpGet("{userId:int}")]
        public async Task<IActionResult> GetUser([FromRoute] int userId, CancellationToken ct)
        {
            try
            {
                var data = await _svc.GetUserDetailAsync(userId, ct);
                if (data == null)
                    return NotFoundResponse("user not found");

                return OkResponse("user retrieved", data);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to retrieve user: {ex.Message}");
            }
        }

        // POST /api/user
        [HttpPost]
        public async Task<IActionResult> CreateInternalUser(
            [FromBody] Dictionary<string, object?>? payload,
            CancellationToken ct)
        {
            if (payload == null || payload.Count == 0)
                return BadRequestResponse("body is required");

            try
            {
                var result = await _svc.CreateUserAsync(payload, User, ct);
                return CreatedResponse("user created", result);
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
                return ServerErrorResponse($"failed to create user: {ex.Message}");
            }
        }

        // PUT /api/user/{userId}
        [HttpPut("{userId:int}")]
        public async Task<IActionResult> UpdateInternalUser(
            [FromRoute] int userId,
            [FromBody] Dictionary<string, object?>? payload,
            CancellationToken ct)
        {
            if (payload == null || payload.Count == 0)
                return BadRequestResponse("body is required");

            try
            {
                var result = await _svc.UpdateUserAsync(userId, payload, User, ct);
                return OkResponse("user updated", result);
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
                return ServerErrorResponse($"failed to update user: {ex.Message}");
            }
        }

        // DELETE /api/user/{userId}
        [HttpDelete("{userId:int}")]
        public async Task<IActionResult> DeleteInternalUser(
            [FromRoute] int userId,
            [FromBody] Dictionary<string, object?>? payload,
            CancellationToken ct)
        {
            payload ??= new Dictionary<string, object?>();

            try
            {
                var result = await _svc.DeleteUserAsync(userId, payload, User, ct);
                return OkResponse("user deleted", result);
            }
            catch (Exception ex)
            {
                return ServerErrorResponse($"failed to delete user: {ex.Message}");
            }
        }

        // =========================================================
        // Response helpers (responseCode ikut HTTP status)
        // =========================================================
        private IActionResult OkResponse(string message, object? data)
            => Ok(ApiResponse.Ok(message, data, 200));

        private IActionResult CreatedResponse(string message, object? data)
            => StatusCode(201, ApiResponse.Ok(message, data, 201));

        private IActionResult BadRequestResponse(string message, object? data = null)
            => BadRequest(ApiResponse.Fail(message, 400, data));

        private IActionResult NotFoundResponse(string message, object? data = null)
            => NotFound(ApiResponse.Fail(message, 404, data));

        private IActionResult ServerErrorResponse(string message, object? data = null)
            => StatusCode(500, ApiResponse.Fail(message, 500, data));
    }
}
