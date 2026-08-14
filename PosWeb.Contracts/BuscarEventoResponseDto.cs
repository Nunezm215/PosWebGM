namespace PosWeb.Contracts;

public class BuscarEventoResponseDto
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public string ReservadoPor { get; set; } = string.Empty;
    public DateOnly Fecha { get; set; }
    public TimeOnly HoraInicio { get; set; }
    public TimeOnly HoraFin { get; set; }
    public string TipoEvento { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public int CantidadInvitados { get; set; }
}
