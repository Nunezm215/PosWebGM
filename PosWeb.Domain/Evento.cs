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

    public Cliente Cliente { get; private set; } = null!;

    public int ID_USUARIO_CREADOR { get; private set; }

    public Usuario UsuarioCreador { get; private set; } = null!;

    public int ID_SUCURSAL { get; private set; }

    public Sucursal Sucursal { get; private set; } = null!;

    public DateOnly FECHA { get; private set; }

    public TimeOnly HORA_INICIO { get; private set; }

    public TimeOnly HORA_FIN { get; private set; }

    public string TIPO_EVENTO { get; private set; } = null!;

    public int CANTIDAD_INVITADOS { get; private set; }

    public int CANTIDAD_MAYORES { get; private set; }

    public int CANTIDAD_MENORES { get; private set; }

    public decimal MONTO_TOTAL { get; private set; }

    public string? OBSERVACIONES { get; private set; }

    public string ESTADO { get; private set; } = EventoEstados.Reservado;

    public DateTime FECHA_CREACION { get; private set; }

    private readonly List<CargoExtraEvento> _CARGOS_EXTRA = new();
    public IReadOnlyCollection<CargoExtraEvento> CARGOS_EXTRA => _CARGOS_EXTRA;
    private readonly List<PagoEvento> _PAGOS = new();
    public IReadOnlyCollection<PagoEvento> PAGOS => _PAGOS;

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
        DateTime? fechaCreacion = null,
        int? cantidadMayores = null,
        int? cantidadMenores = null)
    {
        ValidarBasico(clienteId, usuarioCreadorId, sucursalId, fecha, horaInicio, horaFin, tipoEvento, montoTotal);

        ID_CLIENTE = clienteId;
        ID_USUARIO_CREADOR = usuarioCreadorId;
        ID_SUCURSAL = sucursalId;
        FECHA = fecha;
        HORA_INICIO = horaInicio;
        HORA_FIN = horaFin;
        TIPO_EVENTO = tipoEvento.Trim();
        AsignarCantidades(cantidadInvitados, cantidadMayores, cantidadMenores);
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
        string? observaciones = null,
        int? cantidadMayores = null,
        int? cantidadMenores = null)
    {
        ValidarBasico(clienteId, ID_USUARIO_CREADOR, ID_SUCURSAL, fecha, horaInicio, horaFin, tipoEvento, montoTotal);

        ID_CLIENTE = clienteId;
        FECHA = fecha;
        HORA_INICIO = horaInicio;
        HORA_FIN = horaFin;
        TIPO_EVENTO = tipoEvento.Trim();
        AsignarCantidades(cantidadInvitados, cantidadMayores, cantidadMenores);
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

    public void MarcarReservado()
    {
        ESTADO = EventoEstados.Reservado;
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

        if (montoTotal < 0)
            throw new ArgumentException("montoTotal no puede ser negativo", nameof(montoTotal));
    }

    private void AsignarCantidades(int cantidadInvitados, int? cantidadMayores, int? cantidadMenores)
    {
        if (!cantidadMayores.HasValue && !cantidadMenores.HasValue)
        {
            if (cantidadInvitados < 0)
                throw new ArgumentException("cantidadInvitados no puede ser negativa", nameof(cantidadInvitados));

            CANTIDAD_MAYORES = cantidadInvitados;
            CANTIDAD_MENORES = 0;
            CANTIDAD_INVITADOS = cantidadInvitados;
            return;
        }

        if (!cantidadMayores.HasValue || !cantidadMenores.HasValue)
            throw new ArgumentException("cantidadMayores y cantidadMenores deben informarse juntos");
        if (cantidadMayores.Value < 0 || cantidadMenores.Value < 0)
            throw new ArgumentException("Las cantidades de invitados no pueden ser negativas");

        CANTIDAD_MAYORES = cantidadMayores.Value;
        CANTIDAD_MENORES = cantidadMenores.Value;
        CANTIDAD_INVITADOS = checked(CANTIDAD_MAYORES + CANTIDAD_MENORES);
    }
}
