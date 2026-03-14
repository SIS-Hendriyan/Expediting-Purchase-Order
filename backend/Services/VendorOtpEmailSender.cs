using System.Text;
using EXPOAPI.Helpers;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace EXPOAPI.Services
{
    public class VendorOtpEmailSender : IVendorOtpEmailSender
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<VendorOtpEmailSender> _logger;
        private readonly IConfiguration _config;

        public VendorOtpEmailSender(
            HttpClient httpClient,
            ILogger<VendorOtpEmailSender> logger,
            IConfiguration config)
        {
            _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        public async Task SendVendorOtpEmailAsync(string email, string otp, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email is required.", nameof(email));

            if (string.IsNullOrWhiteSpace(otp))
                throw new ArgumentException("OTP is required.", nameof(otp));

            var traceId = Guid.NewGuid().ToString("N");

            var emailApiUri = _config["EmailApi:ApiUri"]?.Trim();
            if (string.IsNullOrWhiteSpace(emailApiUri))
                throw new InvalidOperationException("EmailApi:Uri configuration is missing.");

            var emailPayload = new
            {
                from = "Expo.system@saptaindra.co.id",
                to = email.Trim(),
                bcc = "",
                subject = "ONE TIME PASSWORD EXPO",
                bodyMessage =  EmailTemplateRenderer.RenderVendorOtpBody(email, otp),
                emailPort = "25",
                emailHost = "smtp.saptaindra.co.id",
                judul = "",
                attachmentFileName = "",
                attachmentBase64 = "",
            };

            var json = JsonConvert.SerializeObject(emailPayload);
            using var emailContent = new StringContent(json, Encoding.UTF8, "application/json");

            try
            {
                _logger.LogInformation(
                    "Email send attempt. TraceId={TraceId} To={To} Host={Host} Port={Port} Uri={Uri}",
                    traceId,
                    email,
                    emailPayload.emailHost,
                    emailPayload.emailPort,
                    emailApiUri
                );

                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                linkedCts.CancelAfter(TimeSpan.FromSeconds(30));

                using var emailResponse = await _httpClient.PostAsync(emailApiUri, emailContent, linkedCts.Token);
                var respBody = await emailResponse.Content.ReadAsStringAsync(linkedCts.Token);

                if (!emailResponse.IsSuccessStatusCode)
                {
                    _logger.LogError(
                        "Email API failed. TraceId={TraceId} Status={Status} Body={Body}",
                        traceId,
                        (int)emailResponse.StatusCode,
                        Truncate(respBody, 1500)
                    );

                    throw new InvalidOperationException(
                        $"Failed to send email. Status={(int)emailResponse.StatusCode}. Body={Truncate(respBody, 300)}"
                    );
                }

                _logger.LogInformation(
                    "Email API success. TraceId={TraceId} Status={Status} Body={Body}",
                    traceId,
                    (int)emailResponse.StatusCode,
                    Truncate(respBody, 500)
                );
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                _logger.LogError(ex, "Email API timeout. TraceId={TraceId} Uri={Uri}", traceId, emailApiUri);
                throw new TimeoutException("Failed to send email: request timeout.", ex);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Email API HttpRequestException. TraceId={TraceId} Uri={Uri}", traceId, emailApiUri);
                throw new InvalidOperationException($"Failed to send email: network error ({ex.Message}).", ex);
            }
            catch (Exception ex) when (ex is not TimeoutException)
            {
                _logger.LogError(ex, "Email API unexpected error. TraceId={TraceId} Uri={Uri}", traceId, emailApiUri);
                throw;
            }
        }

        private static string Truncate(string? value, int maxLength)
        {
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            return value.Length <= maxLength
                ? value
                : value.Substring(0, maxLength) + "...";
        }
    }
}