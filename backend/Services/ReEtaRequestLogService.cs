using Dapper;
using Microsoft.Data.SqlClient;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace EXPOAPI.Services
{
    public sealed class ReEtaRequestLogService : IReEtaRequestLogService
    {
        private readonly IDbConnectionFactory _db;
        private const string SP_LOG_LIST = "[exp].[PO_RE_ETA_REQUEST_LOG_LIST_SP]";

        public ReEtaRequestLogService(IDbConnectionFactory db)
        {
            _db = db ?? throw new ArgumentNullException(nameof(db));
        }

        public async Task<List<Dictionary<string, object?>>> ListByRequestIdAsync(long requestId, CancellationToken ct = default)
        {
            using var cn = _db.CreateMain();

            try
            {
                var rows = (await cn.QueryAsync<dynamic>(new CommandDefinition(
                    SP_LOG_LIST,
                    new { REQUEST_ID = requestId },
                    commandType: CommandType.StoredProcedure,
                    cancellationToken: ct
                ))).ToList();

                return rows.Select(ToDict).ToList();
            }
            catch (OperationCanceledException) { throw; }
            catch (SqlException ex)
            {
                throw new InvalidOperationException($"DB error executing {SP_LOG_LIST}: {ex.Message}", ex);
            }
        }

        private static Dictionary<string, object?> ToDict(dynamic row)
        {
            var dict = (IDictionary<string, object>)row;
            return dict.ToDictionary(k => k.Key, v => (object?)v.Value);
        }
    }
}