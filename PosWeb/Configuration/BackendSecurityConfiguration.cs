using Microsoft.Extensions.Configuration;

namespace PosWeb.Configuration;

public static class BackendSecurityConfiguration
{
    public const string JwtKeyPath = "Jwt:Key";
    public const string CorsAllowedOriginsPath = "Cors:AllowedOrigins";

    public static string GetRequiredJwtKey(IConfiguration configuration)
    {
        var key = configuration[JwtKeyPath];
        if (string.IsNullOrWhiteSpace(key))
        {
            throw new InvalidOperationException("Falta la configuración obligatoria 'Jwt:Key'. Configurá Jwt__Key en producción.");
        }

        return key;
    }

    public static string[] GetRequiredCorsAllowedOrigins(IConfiguration configuration)
    {
        var origins = configuration.GetSection(CorsAllowedOriginsPath).Get<string[]>() ?? Array.Empty<string>();
        if (origins.Length == 0 || origins.Any(origin => string.IsNullOrWhiteSpace(origin) || origin == "*"))
        {
            throw new InvalidOperationException("Falta la configuración obligatoria 'Cors:AllowedOrigins'. Configurá orígenes explícitos con Cors__AllowedOrigins__0, Cors__AllowedOrigins__1, etc.");
        }

        return origins;
    }
}
