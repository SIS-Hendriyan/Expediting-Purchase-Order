using System.ComponentModel.DataAnnotations;

namespace EXPOAPI.Models;

public sealed class DelayReasonCreateRequest
{
    [Required(ErrorMessage = "Title is required.")]
    [MaxLength(255, ErrorMessage = "Title cannot exceed 255 characters.")]
    public string Title { get; set; } = default!;

    public string? Describe { get; set; }
}

public sealed class DelayReasonUpdateRequest
{
    [Required(ErrorMessage = "Title is required.")]
    [MaxLength(255, ErrorMessage = "Title cannot exceed 255 characters.")]
    public string Title { get; set; } = default!;

    public string? Describe { get; set; }
}
