namespace PosWeb.Contracts;

public class MarcarOportunidadCumpleaniosAtendidaRequestDto
{
    public string TipoPersona { get; set; } = string.Empty;
    public int PersonaId { get; set; }
    public DateOnly ProximoCumpleanios { get; set; }
}
