using Dapper;
using EXPOAPI.Models;
using System.Data;

namespace EXPOAPI.Services
{
    public class DbEmailSettingProvider : IEmailSettingProvider
    {
        private readonly IDbConnectionFactory _db;

        public DbEmailSettingProvider(IDbConnectionFactory db)
        {
            _db = db;
        }

        public async Task<EmailSetting?> GetSettingAsync(CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            // SP: exp.MST_SETTING_EMAIL_SP
            // Karena kita gak tahu nama kolom pasti, kita ambil dynamic row lalu mapping sendiri.
            var row = await cn.QuerySingleOrDefaultAsync<dynamic>(
                new CommandDefinition("exp.MST_SETTING_EMAIL_SP", commandType: CommandType.StoredProcedure, cancellationToken: ct)
            );

            if (row is null) return null;

            // DapperRow -> IDictionary<string, object>
            var dict = (IDictionary<string, object>)row;
            string Get(params string[] names)
            {
                foreach (var n in names)
                {
                    if (dict.TryGetValue(n, out var v) && v != null) return v.ToString() ?? "";
                    // coba case-insensitive
                    var hit = dict.FirstOrDefault(k => string.Equals(k.Key, n, StringComparison.OrdinalIgnoreCase));
                    if (!string.IsNullOrEmpty(hit.Key) && hit.Value != null) return hit.Value.ToString() ?? "";
                }
                return "";
            }

            var fromEmail = Get("from", "emailfrom", "mailfrom", "FromEmail", "EmailFrom", "MailFrom");
            var mailboxName = Get("mailboxname", "displayname", "MailboxName", "DisplayName");
            var smtpHost = Get("smtp", "smtphost", "SmtpHost", "SMTPHost");
            var password = Get("password", "smtppassword", "SmtpPassword", "SMTPPassword");
            var portRaw = Get("port", "smtpport", "SmtpPort", "SMTPPort");
            var sslRaw = Get("isssl", "enable_ssl", "UseSsl", "IsSsl", "EnableSsl");
            var bccRaw = Get("bccx", "bcc", "Bcc", "BCC");

            _ = int.TryParse(portRaw, out var smtpPort);

            var useSsl = (sslRaw ?? "").Trim();
            var useSslBool = useSsl.Equals("1") ||
                             useSsl.Equals("true", StringComparison.OrdinalIgnoreCase);

            var bcc = new List<string>();
            if (!string.IsNullOrWhiteSpace(bccRaw))
            {
                var sep = bccRaw.Contains(';') ? ';' : ',';
                bcc = bccRaw.Split(sep, StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim())
                            .Where(x => x.Length > 0)
                            .ToList();
            }

            return new EmailSetting
            {
                FromEmail = fromEmail,
                MailboxName = mailboxName,
                SmtpHost = smtpHost,
                SmtpPort = smtpPort == 0 ? 25 : smtpPort,
                Password = password,
                UseSsl = useSslBool,
                Bcc = bcc
            };
        }
    }
}
