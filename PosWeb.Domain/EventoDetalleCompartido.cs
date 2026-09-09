using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class EventoDetalleCompartido
{
    [Key]
    public int ID_EVENTO_DETALLE_COMPARTIDO { get; private set; }

    public int ID_EVENTO { get; private set; }

    public string TOKEN_HASH { get; private set; } = null!;

    public DateTime CREADO_EN_UTC { get; private set; }

    public DateTime VENCE_EN_UTC { get; private set; }

    public DateTime? REVOCADO_EN_UTC { get; private set; }

    protected EventoDetalleCompartido()
    {
    }

    public EventoDetalleCompartido(int eventoId, string tokenHash, DateTime creadoEnUtc, DateTime venceEnUtc)
    {
        if (eventoId <= 0) throw new ArgumentException("eventoId debe ser mayor a 0", nameof(eventoId));
        if (string.IsNullOrWhiteSpace(tokenHash)) throw new ArgumentException("tokenHash es requerido", nameof(tokenHash));
        if (venceEnUtc <= creadoEnUtc) throw new ArgumentException("La vigencia debe ser posterior a la creación", nameof(venceEnUtc));

        ID_EVENTO = eventoId;
        TOKEN_HASH = tokenHash.Trim();
        CREADO_EN_UTC = DateTime.SpecifyKind(creadoEnUtc, DateTimeKind.Utc);
        VENCE_EN_UTC = DateTime.SpecifyKind(venceEnUtc, DateTimeKind.Utc);
    }

    public void AsignarId(int id)
    {
        if (id <= 0) throw new ArgumentException("El ID debe ser mayor a 0", nameof(id));
        ID_EVENTO_DETALLE_COMPARTIDO = id;
    }

    public void Revocar(DateTime? revocadoEnUtc = null)
    {
        if (REVOCADO_EN_UTC.HasValue) return;
        REVOCADO_EN_UTC = DateTime.SpecifyKind(revocadoEnUtc ?? DateTime.UtcNow, DateTimeKind.Utc);
    }

    public bool EstaActivo(DateTime utcNow)
        => !REVOCADO_EN_UTC.HasValue && VENCE_EN_UTC > DateTime.SpecifyKind(utcNow, DateTimeKind.Utc);
}
