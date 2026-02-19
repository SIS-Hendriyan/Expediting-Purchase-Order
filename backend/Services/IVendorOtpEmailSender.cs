namespace EXPOAPI.Services
{
    public interface IVendorOtpEmailSender
    {
        Task SendVendorOtpEmailAsync(string email, string otp, CancellationToken ct = default);
    }
}
