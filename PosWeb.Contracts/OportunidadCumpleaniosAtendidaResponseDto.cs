namespace PosWeb.Contracts;

public class OportunidadCumpleaniosAtendidaResponseDto
{
    public string TipoPersona { get; set; } = string.Empty;
    public int PersonaId { get; set; }
    public string NombrePersona { get; set; } = string.Empty;
    public int ClienteId { get; set; }
    public string NombreCliente { get; set; } = string.Empty;
    public string? TelefonoCliente { get; set; }
    public DateOnly ProximoCumpleanios { get; set; }
    public DateTime FechaAtendido { get; set; }
}
