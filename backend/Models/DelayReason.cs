using System;

namespace EXPOAPI.Models;

public  class DelayReason
{
    public int ID { get; set; }
    public string TITLE { get; set; } = default!;
    public string DESCRIBE { get; set; } = default!;
    public DateTime CREATED_AT { get; set; }
    public string CREATED_BY { get; set; } = default!;
    public DateTime? UPDATED_AT { get; set; }
    public string? UPDATED_BY { get; set; }
    public DateTime? DELETED_AT { get; set; }
    public string? DELETED_BY { get; set; }
}