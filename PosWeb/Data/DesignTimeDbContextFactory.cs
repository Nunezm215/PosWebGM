using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace PosWeb.Data;

public sealed class PosDbContextDesignTimeFactory : IDesignTimeDbContextFactory<PosDbContext>
{
    public PosDbContext CreateDbContext(string[] args)
    {
        var configuration = BuildConfiguration();
        var options = new DbContextOptionsBuilder<PosDbContext>();
        var connectionString = configuration.GetConnectionString("DefaultConnection") ?? "Server=localhost;Database=posweb;User=root;Password=280590;";

        options.UseMySql(connectionString, ServerVersion.Parse("8.0.36-mysql"));
        return new PosDbContext(options.Options);
    }

    private static IConfigurationRoot BuildConfiguration()
        => new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .Build();
}
