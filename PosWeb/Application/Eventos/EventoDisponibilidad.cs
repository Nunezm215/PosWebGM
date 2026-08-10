using PosWeb.Domain;

namespace PosWeb.Application.Eventos;

public static class EventoDisponibilidad
{
    private static readonly TimeSpan Margen = TimeSpan.FromMinutes(30);

    public static bool EstaDisponible(Evento candidato, IEnumerable<Evento> eventosExistentes, int? excluirEventoId = null)
    {
        foreach (var existente in eventosExistentes)
        {
            if (existente.ESTADO == EventoEstados.Cancelado)
                continue;

            if (excluirEventoId.HasValue && existente.ID_EVENTO == excluirEventoId.Value)
                continue;

            if (HayConflicto(candidato, existente))
                return false;
        }

        return true;
    }

    public static bool HayConflicto(Evento nuevo, Evento existente)
    {
        if (existente.FECHA != nuevo.FECHA || existente.ID_SUCURSAL != nuevo.ID_SUCURSAL)
            return false;

        var nuevoInicio = nuevo.FECHA.ToDateTime(nuevo.HORA_INICIO);
        var nuevoFin = nuevo.FECHA.ToDateTime(nuevo.HORA_FIN);
        var existenteInicio = existente.FECHA.ToDateTime(existente.HORA_INICIO);
        var existenteFin = existente.FECHA.ToDateTime(existente.HORA_FIN);

        return nuevoInicio < existenteFin.Add(Margen)
            && nuevoFin > existenteInicio.Subtract(Margen);
    }
}
