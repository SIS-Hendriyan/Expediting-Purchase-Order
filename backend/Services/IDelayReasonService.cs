using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public interface IDelayReasonService
{
    Task<IEnumerable<DelayReason>> GetAllAsync(CancellationToken ct = default);
    Task<DelayReason?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<int> CreateAsync(DelayReasonCreateRequest request, ClaimsPrincipal user, CancellationToken ct = default);
    Task UpdateAsync(int id, DelayReasonUpdateRequest request, ClaimsPrincipal user, CancellationToken ct = default);
    Task DeleteAsync(int id, ClaimsPrincipal user, CancellationToken ct = default);
}
