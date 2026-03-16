using System.Security.Claims;

namespace EXPOAPI.Services
{
    public interface IVendorService
    {
        Task<Dictionary<string, object?>> ListVendorsAsync(string? email = null, CancellationToken ct = default);
        Task<Dictionary<string, object?>?> GetVendorDetailAsync(int vendorId, CancellationToken ct = default);

        Task<Dictionary<string, object?>?> GetVendorByEmailAsync(string email, CancellationToken ct = default);

        Task<Dictionary<string, object?>> CreateVendorAsync(Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> UpdateVendorAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);

        Task<Dictionary<string, object?>> UpdateVendorOtpAsync(
            int vendorId,
            string otp,
            DateTime otpExpiresAt,
            string updatedBy,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> UpdateVendorAccessAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> DeleteVendorAsync(int vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
    }
}