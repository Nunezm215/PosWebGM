namespace PosWeb.Contracts;

public class ProximoCumpleaniosResponseDto
{
    public int PersonaId { get; set; }
    public string TipoPersona { get; set; } = string.Empty;
    public string NombrePersona { get; set; } = string.Empty;
    public DateOnly FechaNacimiento { get; set; }
    public DateOnly ProximoCumpleanios { get; set; }
    public int DiasFaltantes { get; set; }
    public int ClienteId { get; set; }
    public string NombreCliente { get; set; } = string.Empty;
    public string? TelefonoCliente { get; set; }
}
