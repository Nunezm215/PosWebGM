namespace PosWeb.Application.Eventos;

internal static class FechaContableArgentina
{
    private static readonly TimeZoneInfo Zona = ObtenerZona();

    internal static DateOnly DesdeUtc(DateTime fechaUtc)
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(fechaUtc, DateTimeKind.Utc), Zona));

    internal static DateOnly Actual(TimeProvider timeProvider) => DesdeUtc(timeProvider.GetUtcNow().UtcDateTime);

    private static TimeZoneInfo ObtenerZona()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Argentina/Buenos_Aires"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Argentina Standard Time"); }
    }
}
