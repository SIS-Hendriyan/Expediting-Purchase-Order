using System;

namespace EXPOAPI.Models
{
    public sealed class ReEtaCreateRequestDto
    {
        public string? IdPoItem { get; set; }
        public string? PoNumber { get; set; }
        public string? PoItemNo { get; set; }
        public string? VendorCode { get; set; }
        public string? VendorName { get; set; }
        public DateTime? CurrentEta { get; set; }

        public int? ProposedEtaDays { get; set; }     // ✅ int days
        public string Reason { get; set; } = "";

        // evidence doc (base64)
        public string? EvidenceFileName { get; set; }
        public string? EvidenceContentType { get; set; }
        public long? EvidenceSize { get; set; }
        public string? EvidenceBase64 { get; set; }   // optional
    }

    public sealed class ReEtaDecisionRequestDto
    {
        public string Feedback { get; set; } = "";

        // attachment (base64). For approve: optional. For reject: required.
        public string? FileName { get; set; }
        public string? ContentType { get; set; }
        public long? FileSize { get; set; }
        public string? Base64 { get; set; }
    }

    public sealed class ReEtaVendorResponseDto
    {
        public string FileName { get; set; } = "vendor_response.pdf";
        public string? ContentType { get; set; }
        public long? FileSize { get; set; }
        public string Base64 { get; set; } = "";
    }
}