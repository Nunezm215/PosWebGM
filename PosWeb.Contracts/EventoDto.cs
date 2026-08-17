namespace PosWeb.Contracts;

public class EventoDto
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public int UsuarioCreadorId { get; set; }
    public string? UsuarioCreadorNombre { get; set; }
    public int SucursalId { get; set; }
    public DateOnly Fecha { get; set; }
    public TimeOnly HoraInicio { get; set; }
    public TimeOnly HoraFin { get; set; }
    public string TipoEvento { get; set; } = string.Empty;
    public int CantidadInvitados { get; set; }
    public decimal MontoTotal { get; set; }
    public string? Observaciones { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
}
