using System.Security.Claims;

namespace EXPOAPI.Services
{
    public interface IVendorService
    {
        Task<Dictionary<string, object?>> ListVendorsAsync(string? email = null, CancellationToken ct = default);
        Task<Dictionary<string, object?>?> GetVendorDetailAsync(string vendorId, CancellationToken ct = default);

        Task<Dictionary<string, object?>?> GetVendorByEmailAsync(string email, CancellationToken ct = default);

        Task<Dictionary<string, object?>> CreateVendorAsync(Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> UpdateVendorAsync(string vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);

        Task<Dictionary<string, object?>> UpdateVendorOtpAsync(
            string vendorId,
            string otp,
            DateTime otpExpiresAt,
            string updatedBy,
            CancellationToken ct = default);

        Task<Dictionary<string, object?>> UpdateVendorAccessAsync(string vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> DeleteVendorAsync(string vendorId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
    }
}