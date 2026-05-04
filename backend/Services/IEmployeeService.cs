using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using EXPOAPI.Models;

namespace EXPOAPI.Services;

public interface IEmployeeService
{
    Task<IEnumerable<Ordinate>> GetAllAsync(CancellationToken ct = default);
}