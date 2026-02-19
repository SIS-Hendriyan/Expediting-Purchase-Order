namespace EXPOAPI.Models
{

    public  class VendorLoginResult
    {
        public VendorAccount account { get; }
        public VendorProfile? profile { get; }

        public VendorLoginResult(VendorAccount account, VendorProfile? profile)
        {
            this.account = account;
            this.profile = profile;
        }
    }
    public  class VendorProfile
    {
        public string VendorID { get; }
        public string Email { get; }
        public string VendorName { get; }
        public string CompleteName { get; }
        public string UserName { get; }

        public string OTP { get; }
        public DateTime? OtpExpiresAt { get; }
        public bool IsAccess { get; }

        public VendorProfile(
            string VendorID,
            string Email,
            string VendorName,
            string CompleteName,
            string UserName,
            string OTP,
            DateTime? OtpExpiresAt,
            bool IsAccess
        )
        {
            this.VendorID = VendorID ?? "";
            this.Email = Email ?? "";
            this.VendorName = VendorName ?? "";
            this.CompleteName = CompleteName ?? "";
            this.UserName = UserName ?? "";
            this.OTP = OTP ?? "";
            this.OtpExpiresAt = OtpExpiresAt;
            this.IsAccess = IsAccess;
        }
    }
    public  class VendorAccount
    {
        public string vendor_id { get; }
        public string complete_name { get; }
        public string email { get; }

        public VendorAccount(string vendor_id, string complete_name, string email)
        {
            this.vendor_id = vendor_id ?? "";
            this.complete_name = complete_name ?? "";
            this.email = email ?? "";
        }
    }
    public class VendorUserRow
    {
        public string? Id { get; set; }
        public string? CompleteName { get; set; }
        public string? Email { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsActive { get; set; }
    }

    public class VerifyVendorOtpRow
    {
        public string? StatusCode { get; set; }
        public string? VendorID { get; set; }
        public string? Email { get; set; }
        public string? VendorName { get; set; }
        public string? CompleteName { get; set; }
        public string? UserName { get; set; }
    }

    public  class VendorProfileRow
    {
        public string? VendorID { get; set; }
        public string? Email { get; set; }
        public string? VendorName { get; set; }
        public string? CompleteName { get; set; }
        public string? UserName { get; set; }
        public string? OTP { get; set; }
        public DateTime? OtpExpiresAt { get; set; }
        public bool? IsAccess { get; set; }
    }
}
