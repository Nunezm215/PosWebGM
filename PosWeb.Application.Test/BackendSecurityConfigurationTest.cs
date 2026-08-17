using Microsoft.Extensions.Configuration;
using PosWeb.Configuration;

namespace PosWeb.Application.Test;

public class BackendSecurityConfigurationTest
{
    [Fact]
    public void GetRequiredJwtKey_LanzaSiFaltaConfiguracion()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ex = Assert.Throws<InvalidOperationException>(() => BackendSecurityConfiguration.GetRequiredJwtKey(configuration));

        Assert.Contains("Jwt:Key", ex.Message);
    }

    [Fact]
    public void GetRequiredJwtKey_LeeClaveExplcita()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "PosWeb_TestSecret_PosWeb_TestSecret_123!"
            })
            .Build();

        var key = BackendSecurityConfiguration.GetRequiredJwtKey(configuration);

        Assert.Equal("PosWeb_TestSecret_PosWeb_TestSecret_123!", key);
    }

    [Fact]
    public void GetRequiredCorsAllowedOrigins_LanzaSiFaltaConfiguracion()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ex = Assert.Throws<InvalidOperationException>(() => BackendSecurityConfiguration.GetRequiredCorsAllowedOrigins(configuration));

        Assert.Contains("Cors:AllowedOrigins", ex.Message);
    }

    [Fact]
    public void GetRequiredCorsAllowedOrigins_LeeOrigenesExplicitos()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "http://localhost:5173"
            })
            .Build();

        var origins = BackendSecurityConfiguration.GetRequiredCorsAllowedOrigins(configuration);

        Assert.Equal(new[] { "http://localhost:5173" }, origins);
    }

    [Fact]
    public void GetRequiredCorsAllowedOrigins_RechazaWildcard()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Cors:AllowedOrigins:0"] = "*"
            })
            .Build();

        var ex = Assert.Throws<InvalidOperationException>(() => BackendSecurityConfiguration.GetRequiredCorsAllowedOrigins(configuration));

        Assert.Contains("Cors:AllowedOrigins", ex.Message);
    }
}
