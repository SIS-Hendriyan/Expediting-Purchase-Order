using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{

    public interface IEmailSender
    {
        Task<bool> SendAsync(
            string toAddress,
            string subject,
            string htmlBody,
            IEnumerable<string>? attachments = null,
            CancellationToken ct = default
        );
    }
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IEmailSettingProvider _settings;

        public SmtpEmailSender(IEmailSettingProvider settings)
        {
            _settings = settings;
        }

        public async Task<bool> SendAsync(
            string toAddress,
            string subject,
            string htmlBody,
            IEnumerable<string>? attachments = null,
            CancellationToken ct = default
        )
        {
            var setting = await _settings.GetSettingAsync(ct);
            if (setting == null) return false;

            if (string.IsNullOrWhiteSpace(setting.FromEmail) || string.IsNullOrWhiteSpace(setting.SmtpHost))
                return false;

            var msg = new MimeMessage();
            msg.Subject = subject ?? "";

            msg.From.Add(new MailboxAddress(setting.MailboxName ?? "", setting.FromEmail));
            msg.To.Add(MailboxAddress.Parse(toAddress));

            foreach (var bcc in setting.Bcc ?? new List<string>())
            {
                if (!string.IsNullOrWhiteSpace(bcc))
                    msg.Bcc.Add(MailboxAddress.Parse(bcc));
            }

            var builder = new BodyBuilder { HtmlBody = htmlBody ?? "" };

            if (attachments != null)
            {
                foreach (var path in attachments)
                {
                    if (string.IsNullOrWhiteSpace(path)) continue;
                    if (!File.Exists(path)) continue;
                    builder.Attachments.Add(path);
                }
            }

            msg.Body = builder.ToMessageBody();

            try
            {
                using var smtp = new SmtpClient();

                // Python kamu: use_ssl True -> starttls()
                // Jadi di MailKit: StartTls kalau UseSsl true, kalau false -> None
                var secure = setting.UseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None;

                await smtp.ConnectAsync(setting.SmtpHost, setting.SmtpPort, secure, ct);

                // Login
                await smtp.AuthenticateAsync(setting.FromEmail, setting.Password, ct);

                await smtp.SendAsync(msg, ct);
                await smtp.DisconnectAsync(true, ct);

                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
