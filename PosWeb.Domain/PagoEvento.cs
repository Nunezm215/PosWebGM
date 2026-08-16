using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class PagoEvento
{
    [Key]
    public int ID_PAGO_EVENTO { get; private set; }
    public int ID_EVENTO { get; private set; }
    public int ID_MEDIO_PAGO { get; private set; }
    public decimal MONTO { get; private set; }
    public DateTime FECHA_REGISTRO { get; private set; }
    public int ID_USUARIO_REGISTRA { get; private set; }
    public bool ANULADO { get; private set; }
    public DateTime? FECHA_ANULACION { get; private set; }
    public int? ID_USUARIO_ANULA { get; private set; }
    public string? MOTIVO_ANULACION { get; private set; }
    public string? OBSERVACION { get; private set; }
    public string? CLAVE_IDEMPOTENCIA { get; private set; }
    public string? REFERENCIA_EXTERNA { get; private set; }

    protected PagoEvento()
    {
    }

    public PagoEvento(int eventoId, int medioPagoId, decimal monto, int usuarioRegistraId, DateTime? fechaRegistro = null,
        string? observacion = null, string? claveIdempotencia = null, string? referenciaExterna = null)
    {
        ID_EVENTO = eventoId;
        ID_MEDIO_PAGO = medioPagoId;
        MONTO = monto;
        ID_USUARIO_REGISTRA = usuarioRegistraId;
        FECHA_REGISTRO = fechaRegistro ?? DateTime.UtcNow;
        OBSERVACION = observacion;
        CLAVE_IDEMPOTENCIA = claveIdempotencia;
        REFERENCIA_EXTERNA = referenciaExterna;
    }
}
