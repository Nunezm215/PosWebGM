namespace PosWeb.Contracts;

public class EditarEventoRequestDto
{
    public int ClienteId { get; set; }
    public DateOnly Fecha { get; set; }
    public TimeOnly HoraInicio { get; set; }
    public TimeOnly HoraFin { get; set; }
    public string TipoEvento { get; set; } = string.Empty;
    public int CantidadInvitados { get; set; }
    public decimal MontoTotal { get; set; }
    public string? Observaciones { get; set; }
}
