using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class CargoExtraEvento
{
    [Key]
    public int ID_CARGO_EXTRA_EVENTO { get; private set; }

    public int ID_EVENTO { get; private set; }

    public string DESCRIPCION { get; private set; } = null!;

    public decimal MONTO { get; private set; }

    public DateTime FECHA_REGISTRO { get; private set; }

    public int ID_USUARIO_REGISTRA { get; private set; }

    public bool ANULADO { get; private set; }

    public DateTime? FECHA_ANULACION { get; private set; }

    public int? ID_USUARIO_ANULA { get; private set; }

    public string? MOTIVO_ANULACION { get; private set; }

    protected CargoExtraEvento()
    {
    }

    public CargoExtraEvento(int eventoId, string descripcion, decimal monto, int usuarioRegistraId, DateTime? fechaRegistro = null)
    {
        ID_EVENTO = eventoId;
        DESCRIPCION = descripcion;
        MONTO = monto;
        ID_USUARIO_REGISTRA = usuarioRegistraId;
        FECHA_REGISTRO = fechaRegistro ?? DateTime.UtcNow;
    }
}
