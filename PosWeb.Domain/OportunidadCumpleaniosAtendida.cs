using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class OportunidadCumpleaniosAtendida
{
    [Key]
    public int ID_OPORTUNIDAD_CUMPLEANIOS_ATENDIDA { get; private set; }

    public TipoPersonaOportunidad TIPO_PERSONA { get; private set; }

    public int ID_PERSONA { get; private set; }

    public DateOnly PROXIMO_CUMPLEANIOS { get; private set; }

    public DateTime FECHA_ATENDIDO { get; private set; }

    private OportunidadCumpleaniosAtendida()
    {
    }

    public OportunidadCumpleaniosAtendida(TipoPersonaOportunidad tipoPersona, int personaId, DateOnly proximoCumpleanios, DateTime fechaAtendido)
    {
        TIPO_PERSONA = tipoPersona;
        ID_PERSONA = personaId;
        PROXIMO_CUMPLEANIOS = proximoCumpleanios;
        FECHA_ATENDIDO = fechaAtendido;
    }
}
