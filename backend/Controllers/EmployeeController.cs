using System;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXPOAPI.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeeController : ControllerBase
{
    private readonly IEmployeeService _service;

    public EmployeeController(IEmployeeService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        try
        {
            var data = await _service.GetAllAsync(ct);
            return Ok(ApiResponse.Ok("Employees retrieved.", data, 200));
        }
        catch (Exception ex)
        {
            return StatusCode(500, ApiResponse.Fail($"Failed to retrieve employees: {ex.Message}", 500));
        }
    }
}