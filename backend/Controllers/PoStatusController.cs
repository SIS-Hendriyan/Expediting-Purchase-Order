using EXPOAPI.Models;
using EXPOAPI.Models;
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

    [HttpPost("on-delivery")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> UpsertOnDelivery(
        [FromForm] PoStatusOnDeliveryMultipartRequest request,
        CancellationToken ct)
    {
        if (request.File == null || request.File.Length == 0)
            return BadRequest(new { message = "File is required." });

        var allowedContentTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "application/pdf",
            "image/png",
            "image/jpeg",
            "image/jpg"
        };

        var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg"
        };

        var contentType = request.File.ContentType?.Trim() ?? string.Empty;
        var extension = Path.GetExtension(request.File.FileName ?? string.Empty);

        if (!allowedContentTypes.Contains(contentType) || !allowedExtensions.Contains(extension))
        {
            return BadRequest(new
            {
                message = "Only PDF, PNG, JPG, and JPEG files are allowed."
            });
        }

        byte[] fileBytes;
        using (var ms = new MemoryStream())
        {
            await request.File.CopyToAsync(ms, ct);
            fileBytes = ms.ToArray();
        }

        var payload = new Dictionary<string, object?>
        {
            ["ID_PO_Item"] = request.ID_PO_Item,
            ["AWB"] = request.AWB,
            ["ActualDeliveryDate"] = request.ActualDeliveryDate,
            ["LeadtimeDelivery"] = request.LeadtimeDelivery,
            ["Quantity"] = request.Quantity,

            ["FileName"] = request.File.FileName,
            ["ContentType"] = request.File.ContentType,
            ["FileSize"] = request.File.Length,
            ["BinaryData"] = fileBytes,
            ["Base64Data"] = Convert.ToBase64String(fileBytes)
        };

        var result = await _service.UpsertOnDeliveryAsync(payload, User, ct);
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