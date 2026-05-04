using System;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXPOAPI.Controllers;

[ApiController]
[Route("api/jobsites")]
[Authorize]
public class JobsiteController : ControllerBase
{
    private readonly IJobsiteService _service;

    public JobsiteController(IJobsiteService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        CancellationToken ct = default)
    {
        try
        {
            var result = await _service.GetAllPagedAsync(pageNumber, pageSize, search, ct);
            return OkResponse("Jobsites retrieved.", result);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to retrieve jobsites: {ex.Message}");
        }
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        try
        {
            var jobsite = await _service.GetByIdAsync(id, ct);
            if (jobsite == null)
                return NotFoundResponse("Jobsite not found.");

            return OkResponse("Jobsite retrieved.", jobsite);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to retrieve jobsite: {ex.Message}");
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] JobsiteCreateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequestResponse("Validation failed.", ModelState);

        try
        {
            var newId = await _service.CreateAsync(request, User, ct);
            return CreatedResponse("Jobsite created.", new { id = newId });
        }
        catch (ArgumentException ex)
        {
            return BadRequestResponse(ex.Message);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to create jobsite: {ex.Message}");
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] JobsiteUpdateRequest request,
        CancellationToken ct)
    {
        if (!ModelState.IsValid)
            return BadRequestResponse("Validation failed.", ModelState);

        try
        {
            await _service.UpdateAsync(id, request, User, ct);
            return OkResponse("Jobsite updated.", null);
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
            return ServerErrorResponse($"Failed to update jobsite: {ex.Message}");
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        try
        {
            await _service.DeleteAsync(id, User, ct);
            return OkResponse("Jobsite deleted.", null);
        }
        catch (InvalidOperationException ex)
        {
            return NotFoundResponse(ex.Message);
        }
        catch (Exception ex)
        {
            return ServerErrorResponse($"Failed to delete jobsite: {ex.Message}");
        }
    }

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