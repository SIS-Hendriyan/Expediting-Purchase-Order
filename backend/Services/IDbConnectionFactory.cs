using System.Data;

namespace EXPOAPI.Services;

public interface IDbConnectionFactory
{
    IDbConnection CreateMain();
    IDbConnection CreateVendor();
}
