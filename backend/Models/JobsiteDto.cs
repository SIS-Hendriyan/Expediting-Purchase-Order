using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace EXPOAPI.Models;

public sealed class JobsiteCreateRequest
{
    [Required(ErrorMessage = "Code is required.")]
    [MaxLength(50, ErrorMessage = "Code cannot exceed 50 characters.")]
    public string Code { get; set; } = default!;

    [Required(ErrorMessage = "Name is required.")]
    [MaxLength(255, ErrorMessage = "Name cannot exceed 255 characters.")]
    public string Name { get; set; } = default!;
}

public sealed class JobsiteUpdateRequest
{
    [Required(ErrorMessage = "Code is required.")]
    [MaxLength(50, ErrorMessage = "Code cannot exceed 50 characters.")]
    public string Code { get; set; } = default!;

    [Required(ErrorMessage = "Name is required.")]
    [MaxLength(255, ErrorMessage = "Name cannot exceed 255 characters.")]
    public string Name { get; set; } = default!;
}

public sealed class JobsitePagedResult
{
    public List<Jobsite> Items { get; set; } = new();
    public int TotalRows { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
}