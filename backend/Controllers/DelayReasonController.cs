using System.Threading;
using System.Threading.Tasks;
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

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var reasons = await _service.GetAllAsync(ct);
        return Ok(new { message = "success", data = reasons });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var reason = await _service.GetByIdAsync(id, ct);
        if (reason == null)
            return NotFound(new { message = "Delay reason not found" });
        return Ok(new { message = "success", data = reason });
    }
}