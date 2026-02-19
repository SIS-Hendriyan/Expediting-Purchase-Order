using EXPOAPI.Helpers;

namespace EXPOAPI.Services
{
    public class VendorOtpEmailSender : IVendorOtpEmailSender
    {
        private readonly IEmailSender _email;

        public VendorOtpEmailSender(IEmailSender email)
        {
            _email = email;
        }

        public async Task SendVendorOtpEmailAsync(string email, string otp, CancellationToken ct = default)
        {
            var html = EmailTemplateRenderer.RenderVendorOtpBody(email, otp);
            var subject = "Your One-Time Password";

            // kalau gagal, kamu bisa log di sini
            await _email.SendAsync(email, subject, html, attachments: null, ct: ct);
        }
    }
}
