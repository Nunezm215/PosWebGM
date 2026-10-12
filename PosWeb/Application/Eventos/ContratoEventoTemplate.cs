namespace PosWeb.Application.Eventos;

public static class ContratoEventoTemplate
{
    public const string Titulo = "CONTRATO DE RESERVA DE EVENTO";

    public static readonly string[] CondicionesReservaYPago =
    {
        "La reserva de la fecha quedará confirmada únicamente mediante el pago del 50% del valor total del evento en concepto de seña.",
        "La seña no será reintegrable en caso de cancelación por parte del cliente.",
        "El 50% restante deberá abonarse en su totalidad como máximo 15 días antes de la fecha del evento. Para la realización del evento, el valor total contratado deberá encontrarse completamente abonado.",
        "Cualquier servicio o adicional contratado posteriormente se incorporará al valor total del evento y deberá ser abonado conforme a las condiciones acordadas."
    };

    public static readonly string[] CondicionesGenerales =
    {
        "La reserva corresponde exclusivamente a la fecha y horario indicados en este contrato. Cualquier modificación estará sujeta a disponibilidad y podrá implicar una modificación del valor contratado.",
        "La cantidad de invitados deberá respetar lo informado en la reserva.",
        "El cliente será responsable por los daños ocasionados a las instalaciones, mobiliario o equipamiento del salón por él o sus invitados durante el evento.",
        "Con su firma, el cliente declara haber revisado los datos del evento y aceptar las condiciones del presente contrato."
    };
}
