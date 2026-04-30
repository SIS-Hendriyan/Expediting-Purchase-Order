using System;
using Microsoft.AspNetCore.Http;

namespace EXPOAPI.Models
{
    // =========================================================
    // Multipart Form-Data DTOs for Re-ETA endpoints
    // =========================================================

    public sealed class ReEtaCreateMultipartRequest
    {
        // Form fields
        public string? IdPoItem { get; set; }
        public string? PoNumber { get; set; }
        public string? PoItemNo { get; set; }
        public string? VendorCode { get; set; }
        public string? VendorName { get; set; }
        public DateTime? CurrentEta { get; set; }

        public int? ProposedEtaDays { get; set; }
        public string Reason { get; set; } = "";
        public int? DelayReasonId { get; set; }

        // File (optional for create)
        public IFormFile? EvidenceFile { get; set; }
    }

    public sealed class ReEtaApproveMultipartRequest
    {
        public string Feedback { get; set; } = "";

        // File (optional for approve)
        public IFormFile? AttachmentFile { get; set; }
    }

    public sealed class ReEtaRejectMultipartRequest
    {
        public string Feedback { get; set; } = "";

        // File (required for reject)
        public IFormFile AttachmentFile { get; set; } = null!;
    }

    public sealed class ReEtaVendorResponseMultipartRequest
    {
        // File (required for vendor response)
        public IFormFile ResponseFile { get; set; } = null!;
    }
}
