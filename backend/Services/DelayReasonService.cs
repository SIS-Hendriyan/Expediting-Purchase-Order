using System;
using System.Collections.Generic;
using System.Data;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EXPOAPI.Models;
using Microsoft.IdentityModel.JsonWebTokens;

namespace EXPOAPI.Services;

public class DelayReasonService : IDelayReasonService
{
    private readonly IDbConnectionFactory _db;

    public DelayReasonService(IDbConnectionFactory db)
    {
        _db = db;
    }

    // ─────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────

    public async Task<IEnumerable<DelayReason>> GetAllAsync(CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        return await cn.QueryAsync<DelayReason>(
            "[exp].[SP_DELAY_REASONS_T]",
            new { Type = "RETRIEVE_ALL", ID = (int?)null },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<DelayReason?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        return await cn.QueryFirstOrDefaultAsync<DelayReason>(
            "[exp].[SP_DELAY_REASONS_T]",
            new { Type = "RETRIEVE", ID = id },
            commandType: CommandType.StoredProcedure
        );
    }

    // ─────────────────────────────────────────────
    // CREATE  →  returns the new record's ID
    // ─────────────────────────────────────────────

    public async Task<int> CreateAsync(
        DelayReasonCreateRequest request,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        var newId = await cn.ExecuteScalarAsync<int>(
            "[exp].[SP_DELAY_REASONS_T]",
            new
            {
                Type     = "INSERT",
                ID       = (int?)null,
                Title    = request.Title,
                Describe = request.Describe,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );

        return newId;
    }

    // ─────────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────────

    public async Task UpdateAsync(
        int id,
        DelayReasonUpdateRequest request,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        await cn.ExecuteAsync(
            "[exp].[SP_DELAY_REASONS_T]",
            new
            {
                Type     = "UPDATE",
                ID       = id,
                Title    = request.Title,
                Describe = request.Describe,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );
    }

    // ─────────────────────────────────────────────
    // DELETE  (soft-delete: sets DELETED_AT / DELETED_BY)
    // ─────────────────────────────────────────────

    public async Task DeleteAsync(
        int id,
        ClaimsPrincipal user,
        CancellationToken ct = default)
    {
        var actionBy = ResolveActionBy(user);

        using var cn = _db.CreateMain();
        await cn.ExecuteAsync(
            "[exp].[SP_DELAY_REASONS_T]",
            new
            {
                Type     = "DELETE",
                ID       = id,
                ActionBy = actionBy
            },
            commandType: CommandType.StoredProcedure
        );
    }

    // ─────────────────────────────────────────────
    // Helper: extract numeric user-id from JWT claims
    // ─────────────────────────────────────────────

    private static int ResolveActionBy(ClaimsPrincipal? user)
    {
        if (user is null)
            throw new UnauthorizedAccessException("User principal is not available.");

        // Try the custom "identity" claim first, then standard fallbacks
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
