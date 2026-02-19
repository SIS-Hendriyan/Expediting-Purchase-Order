using System.Security.Claims;

namespace EXPOAPI.Services
{
    public interface IInternalUserService
    {
        Task<Dictionary<string, object?>> CreateUserAsync(Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> UpdateUserAsync(int userId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);
        Task<Dictionary<string, object?>> DeleteUserAsync(int userId, Dictionary<string, object?> payload, ClaimsPrincipal? user, CancellationToken ct = default);

        Task<Dictionary<string, object?>> ListUsersAsync(CancellationToken ct = default);
        Task<Dictionary<string, object?>?> GetUserDetailAsync(int userId, CancellationToken ct = default);
    }
}
