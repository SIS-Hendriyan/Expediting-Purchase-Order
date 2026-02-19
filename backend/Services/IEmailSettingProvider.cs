using EXPOAPI.Models;

namespace EXPOAPI.Services
{

    public interface IEmailSettingProvider
    {
        Task<EmailSetting?> GetSettingAsync(CancellationToken ct = default);
    }
}
