using System;
using System.Data;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EXPOAPI.Models;
using Microsoft.IdentityModel.JsonWebTokens;

namespace EXPOAPI.Services;

public class JobsiteService : IJobsiteService
{
    private readonly IDbConnectionFactory _db;

    public JobsiteService(IDbConnectionFactory db)
    {
        _db = db;
    }

    public async Task<JobsitePagedResult> GetAllPagedAsync(
        int pageNumber, int pageSize, string? search, CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        using var multi = await cn.QueryMultipleAsync(
            "[exp].[JOBSITE_T_SP]",
            new
            {
                Type = "RETRIEVE_ALL",
                PageNumber = pageNumber,
                PageSize = pageSize,
                Search = search
            },
            commandType: CommandType.StoredProcedure);

        var items = (await multi.ReadAsync<Jobsite>()).ToList();
        var totalRows = await multi.ReadFirstOrDefaultAsync<int?>() ?? 0;

        return new JobsitePagedResult
        {
            Items = items,
            TotalRows = totalRows,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }

    public async Task<Jobsite?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        return await cn.QueryFirstOrDefaultAsync<Jobsite>(
            "[exp].[JOBSITE_T_SP]",
            new { Type = "RETRIEVE", ID = id },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> CreateAsync(
        JobsiteCreateRequest request,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        var newId = await cn.ExecuteScalarAsync<int>(
            "[exp].[JOBSITE_T_SP]",
            new
            {
                Type = "INSERT",
                ID = (int?)null,
                Code = request.Code,
                Name = request.Name,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );

        return newId;
    }

    public async Task UpdateAsync(
        int id,
        JobsiteUpdateRequest request,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        await cn.ExecuteAsync(
            "[exp].[JOBSITE_T_SP]",
            new
            {
                Type = "UPDATE",
                ID = id,
                Code = request.Code,
                Name = request.Name,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task DeleteAsync(
        int id,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        await cn.ExecuteAsync(
            "[exp].[JOBSITE_T_SP]",
            new
            {
                Type = "DELETE",
                ID = id,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );
    }

    private static int ResolveActionBy(ClaimsPrincipal? user)
    {
        if (user is null)
            throw new UnauthorizedAccessException("User principal is not available.");

        var raw = user.FindFirstValue("identity")
               ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub)
               ?? user.FindFirstValue(ClaimTypes.Name);

        if (int.TryParse(raw, out var id))
            return id;

        throw new UnauthorizedAccessException(
            "Could not resolve a numeric user ID from the token claims.");
    }
}