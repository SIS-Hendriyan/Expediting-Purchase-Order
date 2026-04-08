using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public interface IDelayReasonService
{
    Task<IEnumerable<DelayReason>> GetAllAsync(CancellationToken ct = default);
    Task<DelayReason?> GetByIdAsync(int id, CancellationToken ct = default);
}