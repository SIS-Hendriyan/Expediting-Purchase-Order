using System;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXPOAPI.Controllers;

[ApiController]
[Route("api/delayreasons")]
[Authorize]
public class DelayReasonController : ControllerBase
{
    private readonly IDelayReasonService _service;

    public DelayReasonController(IDelayReasonService service)
    {
        _service = service;
    }

    // GET /api/delayreasons
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        try
        {
            var data = await _service.GetAllAsync(ct);
            return OkResponse("Delay reasons retrieved.", data);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to retrieve delay reasons: {ex.Message}");
        }
    }

    // GET /api/delayreasons/{id}
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        try
        {
            var reason = await _service.GetByIdAsync(id, ct);
            if (reason == null)
                return NotFoundResponse("Delay reason not found.");

            return OkResponse("Delay reason retrieved.", reason);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to retrieve delay reason: {ex.Message}");
        }
    }

    // POST /api/delayreasons
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] DelayReasonCreateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequestResponse("Validation failed.", ModelState);

        try
        {
            var newId = await _service.CreateAsync(request, User, ct);
            return CreatedResponse("Delay reason created.", new { id = newId });
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse(ex.Message);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to create delay reason: {ex.Message}");
        }
    }

    // PUT /api/delayreasons/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] DelayReasonUpdateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequestResponse("Validation failed.", ModelState);

        try
        {
            await _service.UpdateAsync(id, request, User, ct);
            return OkResponse("Delay reason updated.", null);
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return NotFoundResponse(ex.Message);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to update delay reason: {ex.Message}");
        }
    }

    // DELETE /api/delayreasons/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteAsync(id, User, ct);
            return OkResponse("Delay reason deleted.", null);
        }
        catch (InvalidOperationException ex)
        {
            return NotFoundResponse(ex.Message);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to delete delay reason: {ex.Message}");
        }
    }

    // =========================================================
    // Response helpers
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
