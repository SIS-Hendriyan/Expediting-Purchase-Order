using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public interface IJobsiteService
{
    Task<JobsitePagedResult> GetAllPagedAsync(int pageNumber, int pageSize, string? search, CancellationToken ct = default);
    Task<Jobsite?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<int> CreateAsync(JobsiteCreateRequest request, ClaimsPrincipal user, CancellationToken ct = default);
    Task UpdateAsync(int id, JobsiteUpdateRequest request, ClaimsPrincipal user, CancellationToken ct = default);
    Task DeleteAsync(int id, ClaimsPrincipal user, CancellationToken ct = default);
}