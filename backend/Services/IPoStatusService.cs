using System.Security.Claims;

namespace EXPOAPI.Services
{
    public interface IPoStatusService
    {
        Task<Dictionary<string, object?>> UpsertOnDeliveryAsync(
         Dictionary<string, object?> payload,
         ClaimsPrincipal? user,
         CancellationToken ct = default);
        Task<Dictionary<string, object?>> UpsertPoStatusAsync(
            Dictionary<string, object?> payload,
            ClaimsPrincipal? user,
            CancellationToken ct = default
        );

        Task<Dictionary<string, object?>?> GetPoStatusByIdPoItemAsync(
            string idPoItem,
            CancellationToken ct = default
        );

        Task<List<Dictionary<string, object?>>> ListPoStatusesAsync(
            CancellationToken ct = default
        );
    }
}