using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public class DelayReasonService : IDelayReasonService
{
    private readonly IDbConnectionFactory _db;

    public DelayReasonService(IDbConnectionFactory db)
    {
        _db = db;
    }

    public async Task<IEnumerable<DelayReason>> GetAllAsync(CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        var result = await cn.QueryAsync<DelayReason>(
            "[exp].[SP_DELAY_REASONS_T]",
            new { Type = "RETRIEVE_ALL", ID = (int?)null },
            commandType: CommandType.StoredProcedure
        );
        return result;
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
}