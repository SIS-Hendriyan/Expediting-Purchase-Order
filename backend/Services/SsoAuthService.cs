using EXPOAPI.Models;
using EXPOAPI.SsoReference;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{
    public interface ISsoAuthService
    {
        Task<SsoLoginResult> LoginAsync(string username, string password, CancellationToken ct = default);
        Task<SsoUserDto?> GetUserAsync(string username, CancellationToken ct = default);
    }

    public sealed class SsoUserDto
    {
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
    }

    public sealed class SsoLoginResult
    {
        public bool Status { get; set; }
        public string Message { get; set; } = "";
        public SsoUserDto? User { get; set; }
    }

    public  class SsoAuthService : ISsoAuthService
    {
        private readonly SsoSettings _sso;
        private readonly ILogger<SsoAuthService> _logger;

        public SsoAuthService(IOptions<SsoSettings> sso, ILogger<SsoAuthService> logger)
        {
            _sso = sso?.Value ?? throw new ArgumentNullException(nameof(sso));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<SsoLoginResult> LoginAsync(string username, string password, CancellationToken ct = default)
        {
            username = (username ?? "").Trim();
            password = password ?? "";

            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
            {
                return new SsoLoginResult { Status = false, Message = "Username dan password wajib diisi" };
            }

            var creds = BuildCredentials();
            var client = CreateClient();

            try
            {
                // 1) Authenticate
                var auth = await client.AuthenticateUserAsync(creds, username, password);
                var ok = auth?.AuthenticateUserResult == true;

                if (!ok)
                {
                    return new SsoLoginResult { Status = false, Message = "Username and/or Password is incorrect" };
                }

                // 2) Get user info
                var info = await client.GetUserInfoAsync(creds, username);
                var dto = MapToDto(info?.GetUserInfoResult);

                return new SsoLoginResult
                {
                    Status = true,
                    Message = "Login Success",
                    User = dto
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSO login failed for username={Username}", username);
                return new SsoLoginResult { Status = false, Message = "Failed login" };
            }
            finally
            {
                await SafeCloseAsync(client);
            }
        }

        public async Task<SsoUserDto?> GetUserAsync(string username, CancellationToken ct = default)
        {
            username = (username ?? "").Trim();
            if (string.IsNullOrWhiteSpace(username))
                return null;

            var creds = BuildCredentials();
            var client = CreateClient();

            try
            {
                var info = await client.GetUserInfoAsync(creds, username);
                return MapToDto(info?.GetUserInfoResult);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SSO GetUserInfo failed for username={Username}", username);
                return null;
            }
            finally
            {
                await SafeCloseAsync(client);
            }
        }

        // =========================================================
        // Helpers
        // =========================================================
        private AppCredentials BuildCredentials()
        {
            var code = (_sso.SOAPHEADERCode ?? "").Trim();
            var key = (_sso.SOAPHEADERKey ?? "").Trim();

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(key))
                throw new InvalidOperationException("SSO integration is not configured (SOAPHEADERCode/SOAPHEADERKey).");

            return new AppCredentials { AppCode = code, AppKey = key };
        }

        private static SSOServiceSoapClient CreateClient()
        {
            //return new SSOServiceSoapClient(SSOServiceSoapClient.EndpointConfiguration.SSOServiceSoap);
            var binding = new System.ServiceModel.BasicHttpBinding(System.ServiceModel.BasicHttpSecurityMode.Transport);
            var address = new System.ServiceModel.EndpointAddress(
                "https://app-saptaindra.msappproxy.net/SSO_TEST/SSOService.asmx"
            );

            return new SSOServiceSoapClient(binding, address);
        }

        /// <summary>
        /// Close WCF client safely. Works whether it supports CloseAsync/Abort or IDisposable.
        /// </summary>
        private static async Task SafeCloseAsync(SSOServiceSoapClient client)
        {
            if (client == null) return;

            try
            {
                // Many generated WCF clients have CloseAsync()
                var closeAsync = client.GetType().GetMethod("CloseAsync", Type.EmptyTypes);
                if (closeAsync != null)
                {
                    var taskObj = closeAsync.Invoke(client, null);
                    if (taskObj is Task t) await t;
                    return;
                }

                // Some have Close()
                var close = client.GetType().GetMethod("Close", Type.EmptyTypes);
                if (close != null)
                {
                    close.Invoke(client, null);
                    return;
                }
            }
            catch
            {
                // If close fails, try abort
                try
                {
                    var abort = client.GetType().GetMethod("Abort", Type.EmptyTypes);
                    abort?.Invoke(client, null);
                }
                catch { }
            }

            // If the client actually implements IDisposable, dispose it
            if (client is IDisposable d)
                d.Dispose();
        }

        private static SsoUserDto? MapToDto(object? getUserInfoResult)
        {
            if (getUserInfoResult == null)
                return null;

            var fullName = GetStringProp(getUserInfoResult, "FullName")
                        ?? GetStringProp(getUserInfoResult, "Name")
                        ?? "";

            var email = GetStringProp(getUserInfoResult, "UserEmail")
                     ?? GetStringProp(getUserInfoResult, "Email")
                     ?? "";

            if (string.IsNullOrWhiteSpace(fullName) && string.IsNullOrWhiteSpace(email))
                return null;

            return new SsoUserDto { FullName = fullName, Email = email };
        }

        private static string? GetStringProp(object obj, string propName)
        {
            var p = obj.GetType().GetProperty(propName, BindingFlags.Public | BindingFlags.Instance | BindingFlags.IgnoreCase);
            if (p == null) return null;

            var v = p.GetValue(obj);
            var s = v?.ToString()?.Trim();
            return string.IsNullOrWhiteSpace(s) ? null : s;
        }
    }
}
