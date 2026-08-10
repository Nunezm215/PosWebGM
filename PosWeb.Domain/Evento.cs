using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public static class EventoEstados
{
    public const string Reservado = "Reservado";
    public const string Señado = "Señado";
    public const string Pagado = "Pagado";
    public const string Cancelado = "Cancelado";

    public static readonly string[] Todos = { Reservado, Señado, Pagado, Cancelado };
}

public class Evento
{
    [Key]
    public int ID_EVENTO { get; private set; }

    public int ID_CLIENTE { get; private set; }

    public int ID_USUARIO_CREADOR { get; private set; }

    public int ID_SUCURSAL { get; private set; }

    public DateOnly FECHA { get; private set; }

    public TimeOnly HORA_INICIO { get; private set; }

    public TimeOnly HORA_FIN { get; private set; }

    public string TIPO_EVENTO { get; private set; } = null!;

    public int CANTIDAD_INVITADOS { get; private set; }

    public decimal MONTO_TOTAL { get; private set; }

    public string? OBSERVACIONES { get; private set; }

    public string ESTADO { get; private set; } = EventoEstados.Reservado;

    public DateTime FECHA_CREACION { get; private set; }

    public Evento(
        int clienteId,
        int usuarioCreadorId,
        int sucursalId,
        DateOnly fecha,
        TimeOnly horaInicio,
        TimeOnly horaFin,
        string tipoEvento,
        int cantidadInvitados,
        decimal montoTotal,
        string? observaciones = null,
        DateTime? fechaCreacion = null)
    {
        ValidarBasico(clienteId, usuarioCreadorId, sucursalId, fecha, horaInicio, horaFin, tipoEvento, cantidadInvitados, montoTotal);

        ID_CLIENTE = clienteId;
        ID_USUARIO_CREADOR = usuarioCreadorId;
        ID_SUCURSAL = sucursalId;
        FECHA = fecha;
        HORA_INICIO = horaInicio;
        HORA_FIN = horaFin;
        TIPO_EVENTO = tipoEvento.Trim();
        CANTIDAD_INVITADOS = cantidadInvitados;
        MONTO_TOTAL = montoTotal;
        OBSERVACIONES = string.IsNullOrWhiteSpace(observaciones) ? null : observaciones.Trim();
        ESTADO = EventoEstados.Reservado;
        FECHA_CREACION = fechaCreacion ?? DateTime.UtcNow;
    }

    protected Evento()
    {
    }

    public void AsignarId(int idEvento)
    {
        if (idEvento <= 0)
            throw new ArgumentException("El ID del evento debe ser mayor a 0", nameof(idEvento));

        ID_EVENTO = idEvento;
    }

    public void Editar(
        int clienteId,
        DateOnly fecha,
        TimeOnly horaInicio,
        TimeOnly horaFin,
        string tipoEvento,
        int cantidadInvitados,
        decimal montoTotal,
        string? observaciones = null)
    {
        ValidarBasico(clienteId, ID_USUARIO_CREADOR, ID_SUCURSAL, fecha, horaInicio, horaFin, tipoEvento, cantidadInvitados, montoTotal);

        ID_CLIENTE = clienteId;
        FECHA = fecha;
        HORA_INICIO = horaInicio;
        HORA_FIN = horaFin;
        TIPO_EVENTO = tipoEvento.Trim();
        CANTIDAD_INVITADOS = cantidadInvitados;
        MONTO_TOTAL = montoTotal;
        OBSERVACIONES = string.IsNullOrWhiteSpace(observaciones) ? null : observaciones.Trim();
    }

    public void MarcarSenado()
    {
        ESTADO = EventoEstados.Señado;
    }

    public void MarcarPagado()
    {
        ESTADO = EventoEstados.Pagado;
    }

    public void Cancelar()
    {
        ESTADO = EventoEstados.Cancelado;
    }

    private static void ValidarBasico(
        int clienteId,
        int usuarioCreadorId,
        int sucursalId,
        DateOnly fecha,
        TimeOnly horaInicio,
        TimeOnly horaFin,
        string tipoEvento,
        int cantidadInvitados,
        decimal montoTotal)
    {
        if (clienteId <= 0)
            throw new ArgumentException("clienteId debe ser mayor a 0", nameof(clienteId));

        if (usuarioCreadorId <= 0)
            throw new ArgumentException("usuarioCreadorId debe ser mayor a 0", nameof(usuarioCreadorId));

        if (sucursalId <= 0)
            throw new ArgumentException("sucursalId debe ser mayor a 0", nameof(sucursalId));

        if (fecha == default)
            throw new ArgumentException("La fecha es inválida", nameof(fecha));

        if (horaFin <= horaInicio)
            throw new ArgumentException("horaFin debe ser mayor a horaInicio", nameof(horaFin));

        if (string.IsNullOrWhiteSpace(tipoEvento))
            throw new ArgumentException("tipoEvento es requerido", nameof(tipoEvento));

        if (cantidadInvitados < 0)
            throw new ArgumentException("cantidadInvitados no puede ser negativa", nameof(cantidadInvitados));

        if (montoTotal < 0)
            throw new ArgumentException("montoTotal no puede ser negativo", nameof(montoTotal));
    }
}
