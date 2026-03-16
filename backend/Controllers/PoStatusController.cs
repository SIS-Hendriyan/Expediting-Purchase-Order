using DocumentFormat.OpenXml.Spreadsheet;
using EXPOAPI.Services;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class PoStatusController : ControllerBase
{
    private readonly IPoStatusService _service;

    public PoStatusController(IPoStatusService service)
    {
        _service = service;
    }

    [HttpPost("upsert")]
    public async Task<IActionResult> Upsert(
        [FromBody] Dictionary<string, object?> payload,
        CancellationToken ct)
    {
        var result = await _service.UpsertPoStatusAsync(payload, User, ct);
        return Ok(result);
    }

    [HttpGet("{idPoItem}")]
    public async Task<IActionResult> GetByIdPoItem(string idPoItem, CancellationToken ct)
    {
        var result = await _service.GetPoStatusByIdPoItemAsync(idPoItem, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var result = await _service.ListPoStatusesAsync(ct);
        return Ok(result);
    }
}