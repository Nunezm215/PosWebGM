namespace PosWeb.Contracts;

public class BuscarEventosFiltroDto
{
    public string? Q { get; set; }
    public string? Estado { get; set; }
    public DateOnly? Desde { get; set; }
    public DateOnly? Hasta { get; set; }
    public int Page { get; set; } = 1;
}
