using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace EXPOAPI.Models
{
    public class PoStatusOnDeliveryMultipartRequest
    {
        [Required]
        public string ID_PO_Item { get; set; } = string.Empty;

        [Required]
        public string AWB { get; set; } = string.Empty;

        [Required]
        public DateTime ActualDeliveryDate { get; set; }

        public int? LeadtimeDelivery { get; set; }

        public decimal? Quantity { get; set; }

        [Required]
        public IFormFile File { get; set; } = default!;
    }
}