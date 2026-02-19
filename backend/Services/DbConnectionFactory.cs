using Microsoft.AspNetCore.Connections;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Data;

namespace EXPOAPI.Services;

public sealed class DbConnectionFactory : IDbConnectionFactory
{
    private readonly IConfiguration _config;

    public DbConnectionFactory(IConfiguration config)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
    }

    public IDbConnection CreateMain() => Create("DBMain");
    public IDbConnection CreateVendor() => Create("DBVendor");

    private IDbConnection Create(string name)
    {
        var cs = _config.GetConnectionString(name);
        if (string.IsNullOrWhiteSpace(cs))
            throw new InvalidOperationException($"Connection string '{name}' not found in ConnectionStrings.");

        return new SqlConnection(cs);
    }
}
