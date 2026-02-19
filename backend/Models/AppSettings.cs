// ============================================================
// FILE: AppSettingsModels.cs
// Paste this single file into your project (e.g., /Models/AppSettingsModels.cs)
// It contains ALL appsettings models based on your config.py mapping.
// ============================================================

namespace EXPOAPI.Models
{
    // ----------------------------
    // From config.py: app.config["SECRET_KEY"], app.config["BASE_URL"]
    // appsettings.json: "App": { "SecretKey": "...", "BaseUrl": "..." }
    // ----------------------------
    public sealed class AppInfoSettings
    {
        public string SecretKey { get; set; } = "dev";
        public string BaseUrl { get; set; } = "http://127.0.0.1:5000";
    }

    // ----------------------------
    // From config.py:
    // LEGACY_HASH_ALGO, LEGACY_HASH_FORMAT
    // + Identity v3 iteration count (used by PasswordHasher)
    // appsettings.json: "Security": { ... }
    // ----------------------------
    public sealed class SecuritySettings
    {
        public string LegacyHashAlgo { get; set; } = "SHA1";
        public string LegacyHashFormat { get; set; } = "HEX_LOWER";
        public int IdentityV3IterationCount { get; set; } = 100_000;
    }

    // ----------------------------
    // From config.py: JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES, JWT_REFRESH_TOKEN_EXPIRES
    // appsettings.json: "Jwt": { "KeyBase64": "...", "Issuer": "...", ... }
    // NOTE: KeyBase64 can be:
    //   - pure base64: "AbCd..."
    //   - with prefix: "EXPO|v1|AbCd..."
    // ----------------------------
    public sealed class JwtSettings
    {
        public string KeyBase64 { get; set; } = "";
        public string Issuer { get; set; } = "expoapi";
        public string Audience { get; set; } = "expoapi-client";
        public int AccessSeconds { get; set; } = 86400;
        public int RefreshSeconds { get; set; } = 2592000;
    }

    // ----------------------------
    // From config.py:
    // TOKEN_SALT_VERIFY, TOKEN_SALT_RESET, TOKEN_EXPIRES_VERIFY, TOKEN_EXPIRES_RESET
    // appsettings.json: "Token": { ... }
    // ----------------------------
    public sealed class TokenSettings
    {
        public string SaltVerify { get; set; } = "verify-email";
        public string SaltReset { get; set; } = "reset-password";
        public int ExpiresVerifySeconds { get; set; } = 86400;
        public int ExpiresResetSeconds { get; set; } = 3600;
    }

    // ----------------------------
    // From config.py: CORS_ORIGINS
    // appsettings.json: "Cors": { "Origins": ["*"] }
    // ----------------------------
    public sealed class CorsSettings
    {
        public string[] Origins { get; set; } = new[] { "*" };
    }

    // ----------------------------
    // From config.py:
    // SSO_SOAP_CODE, SSO_SOAP_KEY, SSO_ENDPOINT
    // appsettings.json: "SSO": { ... }
    // ----------------------------
    public sealed class SsoSettings
    {
        public string SOAPHEADERCode { get; set; } = "WSA";
        public string SOAPHEADERKey { get; set; } = "";
        public string AddressWebService { get; set; } = "";
    }

    // ----------------------------
    // OPTIONAL: helper to decode JwtSettings.KeyBase64
    // Put this in the same file for convenience.
    // ----------------------------
    public static class JwtKeyHelper
    {
        public static byte[] DecodeKeyBase64(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                throw new System.InvalidOperationException("Jwt:KeyBase64 is empty");

            // Support "EXPO|v1|<base64>"
            var base64 = raw.Contains('|')
                ? raw.Split('|')[^1]
                : raw;

            try
            {
                return System.Convert.FromBase64String(base64);
            }
            catch
            {
                throw new System.InvalidOperationException("Jwt:KeyBase64 must be valid Base64 (or EXPO|v1|<Base64>)");
            }
        }
    }

    // ----------------------------
    // OPTIONAL: one-liner registration helper
    // Usage in Program.cs:
    //   builder.Services.AddExpoAppSettings(builder.Configuration);
    // ----------------------------
    public static class ExpoAppSettingsRegistration
    {
        public static Microsoft.Extensions.DependencyInjection.IServiceCollection AddExpoAppSettings(
            this Microsoft.Extensions.DependencyInjection.IServiceCollection services,
            Microsoft.Extensions.Configuration.IConfiguration config)
        {
            services.Configure<AppInfoSettings>(config.GetSection("App"));
            services.Configure<SecuritySettings>(config.GetSection("Security"));
            services.Configure<JwtSettings>(config.GetSection("Jwt"));
            services.Configure<TokenSettings>(config.GetSection("Token"));
            services.Configure<CorsSettings>(config.GetSection("Cors"));
            services.Configure<SsoSettings>(config.GetSection("SSO"));
            return services;
        }
    }
}
