using System.Collections.Generic;
using System.Data;
using System.Threading;
using System.Threading.Tasks;
using Dapper;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public class EmployeeService : IEmployeeService
{
    private readonly IDbConnectionFactory _db;

    public EmployeeService(IDbConnectionFactory db)
    {
        _db = db;
    }

    public async Task<IEnumerable<Ordinate>> GetAllAsync(CancellationToken ct = default)
    {
        using var cn = _db.CreateMain();
        return await cn.QueryAsync<Ordinate>(
            "SELECT Department FROM [EMPLOYEE_DB].[rsg].[ORDINATE_V] group by Department",
            commandType: CommandType.Text
        );
    }
}