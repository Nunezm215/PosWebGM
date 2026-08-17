using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Eventos;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Cajas;

public class CajaDiariaService(PosDbContextLocal context, TimeProvider? timeProvider = null) : ICajaDiariaService
{
    public async Task<CajaDiariaDto> ObtenerAsync(DateOnly fecha, CancellationToken ct = default)
    {
        var sucursal = await ObtenerSucursalActivaAsync(ct);
        var medios = await context.MedioPago.ToListAsync(ct);
        var eventos = await context.Evento.Include(e => e.Cliente).Where(e => e.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);
        var pagos = await context.PagoEvento.Where(p => !p.ANULADO && p.ID_EVENTO > 0).ToListAsync(ct);
        var gastos = await context.Gasto.Where(g => !g.ANULADO && g.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);

        var mediosPorId = medios.ToDictionary(m => m.ID_MEDIO_PAGO, m => m.DESC_MEDIO_PAGO);
        var ingresos = pagos.Join(eventos, p => p.ID_EVENTO, e => e.ID_EVENTO, (p, e) => new { p, e })
            .Where(x => FechaContableArgentina.DesdeUtc(x.p.FECHA_REGISTRO) == fecha)
            .Select(x => new IngresoCajaDiariaDto
            {
                IdPagoEvento = x.p.ID_PAGO_EVENTO,
                FechaRegistro = x.p.FECHA_REGISTRO,
                EventoId = x.e.ID_EVENTO,
                TipoEvento = x.e.TIPO_EVENTO,
                ClienteId = x.e.ID_CLIENTE,
                NombreCliente = x.e.Cliente.NOMBRE,
                MedioPagoId = x.p.ID_MEDIO_PAGO,
                MedioPago = mediosPorId.GetValueOrDefault(x.p.ID_MEDIO_PAGO, string.Empty),
                Monto = x.p.MONTO,
                Observacion = x.p.OBSERVACION,
                ReferenciaExterna = x.p.REFERENCIA_EXTERNA,
            })
            .OrderBy(x => x.FechaRegistro)
            .ToList();

        var egresos = gastos
            .Where(g => FechaContableArgentina.DesdeUtc(g.FECHA_GASTO) == fecha)
            .Select(g => new EgresoCajaDiariaDto
            {
                IdGasto = g.ID_GASTO,
                Fecha = g.FECHA_GASTO,
                Detalle = g.DETALLE,
                Monto = g.MONTO,
                UsuarioId = g.ID_USUARIO,
            })
            .OrderBy(x => x.Fecha)
            .ToList();

        var eventosRealizados = eventos
            .Where(e => e.FECHA == fecha && e.ESTADO != EventoEstados.Cancelado)
            .Select(e => new EventoRealizadoCajaDto
            {
                EventoId = e.ID_EVENTO,
                Fecha = e.FECHA,
                HoraInicio = e.HORA_INICIO,
                TipoEvento = e.TIPO_EVENTO,
                ClienteId = e.ID_CLIENTE,
                NombreCliente = e.Cliente.NOMBRE,
                Estado = e.ESTADO,
            })
            .OrderBy(x => x.HoraInicio)
            .ToList();

        return new CajaDiariaDto
        {
            Fecha = fecha,
            Ingresos = ingresos,
            Egresos = egresos,
            EventosRealizados = eventosRealizados,
            CantidadEventosRealizados = eventosRealizados.Count,
            TotalIngresos = ingresos.Sum(i => i.Monto),
            TotalEgresos = egresos.Sum(g => g.Monto),
            Resultado = ingresos.Sum(i => i.Monto) - egresos.Sum(g => g.Monto),
            DesgloseMediosPago = ingresos
                .GroupBy(i => new { i.MedioPagoId, i.MedioPago })
                .Select(g => new MedioPagoCajaDto
                {
                    MedioPagoId = g.Key.MedioPagoId,
                    Descripcion = g.Key.MedioPago,
                    Total = g.Sum(x => x.Monto),
                    CantidadPagos = g.Count(),
                })
                .ToList(),
        };
    }

    public async Task<IReadOnlyList<CajaDiariaResumenDto>> ObtenerHistorialAsync(DateOnly desde, DateOnly hasta, CancellationToken ct = default)
    {
        if (desde > hasta) throw new ArgumentException("La fecha desde no puede ser posterior a hasta.");
        if (hasta.DayNumber - desde.DayNumber > 365) throw new ArgumentException("El rango máximo es de 366 días.");

        var sucursal = await ObtenerSucursalActivaAsync(ct);
        var eventos = await context.Evento.Where(e => e.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);
        var ids = eventos.Select(e => e.ID_EVENTO).ToList();
        var pagos = await context.PagoEvento.Where(p => !p.ANULADO && ids.Contains(p.ID_EVENTO)).ToListAsync(ct);
        var gastos = await context.Gasto.Where(g => !g.ANULADO && g.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);

        var ingresos = pagos.GroupBy(p => FechaContableArgentina.DesdeUtc(p.FECHA_REGISTRO)).ToDictionary(g => g.Key, g => g.Sum(x => x.MONTO));
        var egresos = gastos.GroupBy(g => FechaContableArgentina.DesdeUtc(g.FECHA_GASTO)).ToDictionary(g => g.Key, g => g.Sum(x => x.MONTO));
        var realizados = eventos.Where(e => e.ESTADO != EventoEstados.Cancelado && e.FECHA >= desde && e.FECHA <= hasta).GroupBy(e => e.FECHA).ToDictionary(g => g.Key, g => g.Count());

        var resultado = new List<CajaDiariaResumenDto>();
        for (var dia = desde; dia <= hasta; dia = dia.AddDays(1))
        {
            ingresos.TryGetValue(dia, out var i);
            egresos.TryGetValue(dia, out var e);
            realizados.TryGetValue(dia, out var c);
            resultado.Add(new CajaDiariaResumenDto { Fecha = dia, TotalIngresos = i, TotalEgresos = e, Resultado = i - e, CantidadEventosRealizados = c });
        }

        return resultado;
    }

    public async Task<CajaMensualDto> ObtenerMensualAsync(int anio, int mes, CancellationToken ct = default)
    {
        if (mes < 1 || mes > 12) throw new ArgumentException("El mes debe estar entre 1 y 12.");

        var hoy = FechaContableArgentina.DesdeUtc((timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime);
        var desde = new DateOnly(anio, mes, 1);
        if (desde > hoy) throw new ArgumentException("No se puede consultar un mes futuro.");

        var hasta = anio == hoy.Year && mes == hoy.Month
            ? hoy
            : new DateOnly(anio, mes, DateTime.DaysInMonth(anio, mes));

        var sucursal = await ObtenerSucursalActivaAsync(ct);
        var eventos = await context.Evento.Include(e => e.Cliente).Where(e => e.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);
        var medios = await context.MedioPago.ToListAsync(ct);
        var mediosPorId = medios.ToDictionary(m => m.ID_MEDIO_PAGO, m => m.DESC_MEDIO_PAGO);
        var pagos = await context.PagoEvento.Where(p => !p.ANULADO && p.ID_EVENTO > 0).ToListAsync(ct);
        var gastos = await context.Gasto.Where(g => !g.ANULADO && g.ID_SUCURSAL == sucursal.ID_SUCURSAL).ToListAsync(ct);

        var ingresos = pagos.Join(eventos, p => p.ID_EVENTO, e => e.ID_EVENTO, (p, e) => new { p, e })
            .Select(x => new
            {
                Dia = FechaContableArgentina.DesdeUtc(x.p.FECHA_REGISTRO),
                Detalle = new IngresoCajaDiariaDto
                {
                    IdPagoEvento = x.p.ID_PAGO_EVENTO,
                    FechaRegistro = x.p.FECHA_REGISTRO,
                    EventoId = x.e.ID_EVENTO,
                    TipoEvento = x.e.TIPO_EVENTO,
                    ClienteId = x.e.ID_CLIENTE,
                    NombreCliente = x.e.Cliente.NOMBRE,
                    MedioPagoId = x.p.ID_MEDIO_PAGO,
                    MedioPago = mediosPorId.GetValueOrDefault(x.p.ID_MEDIO_PAGO, string.Empty),
                    Monto = x.p.MONTO,
                    Observacion = x.p.OBSERVACION,
                    ReferenciaExterna = x.p.REFERENCIA_EXTERNA,
                }
            })
            .Where(x => x.Dia >= desde && x.Dia <= hasta)
            .OrderBy(x => x.Detalle.FechaRegistro)
            .ToList();

        var egresos = gastos
            .Select(g => new
            {
                Dia = FechaContableArgentina.DesdeUtc(g.FECHA_GASTO),
                Detalle = new EgresoCajaDiariaDto
                {
                    IdGasto = g.ID_GASTO,
                    Fecha = g.FECHA_GASTO,
                    Detalle = g.DETALLE,
                    Monto = g.MONTO,
                    UsuarioId = g.ID_USUARIO,
                }
            })
            .Where(x => x.Dia >= desde && x.Dia <= hasta)
            .OrderBy(x => x.Detalle.Fecha)
            .ToList();

        var realizados = eventos
            .Where(e => e.ESTADO != EventoEstados.Cancelado && e.FECHA >= desde && e.FECHA <= hasta)
            .Select(e => new EventoRealizadoCajaDto
            {
                EventoId = e.ID_EVENTO,
                Fecha = e.FECHA,
                HoraInicio = e.HORA_INICIO,
                TipoEvento = e.TIPO_EVENTO,
                ClienteId = e.ID_CLIENTE,
                NombreCliente = e.Cliente.NOMBRE,
                Estado = e.ESTADO,
            })
            .OrderBy(x => x.Fecha)
            .ThenBy(x => x.HoraInicio)
            .ToList();

        var ingresosPorDia = ingresos.GroupBy(x => x.Dia).ToDictionary(g => g.Key, g => g.Select(x => x.Detalle).ToList());
        var egresosPorDia = egresos.GroupBy(x => x.Dia).ToDictionary(g => g.Key, g => g.Select(x => x.Detalle).ToList());
        var eventosPorDia = realizados.GroupBy(x => x.Fecha).ToDictionary(g => g.Key, g => g.ToList());
        var ingresosPorMedio = ingresos.Select(x => x.Detalle).GroupBy(i => new { i.MedioPagoId, i.MedioPago }).Select(g => new MedioPagoCajaDto { MedioPagoId = g.Key.MedioPagoId, Descripcion = g.Key.MedioPago, Total = g.Sum(x => x.Monto), CantidadPagos = g.Count() }).ToList();

        var dias = new List<CajaDiariaResumenDto>();
        var actividad = new List<CajaMensualActividadDiaDto>();

        for (var dia = desde; dia <= hasta; dia = dia.AddDays(1))
        {
            ingresosPorDia.TryGetValue(dia, out var ingresosDia);
            egresosPorDia.TryGetValue(dia, out var egresosDia);
            eventosPorDia.TryGetValue(dia, out var eventosDia);

            ingresosDia ??= [];
            egresosDia ??= [];
            eventosDia ??= [];

            var totalIngresos = ingresosDia.Sum(x => x.Monto);
            var totalEgresos = egresosDia.Sum(x => x.Monto);
            var cantidadEventos = eventosDia.Count;

            dias.Add(new CajaDiariaResumenDto
            {
                Fecha = dia,
                TotalIngresos = totalIngresos,
                TotalEgresos = totalEgresos,
                Resultado = totalIngresos - totalEgresos,
                CantidadEventosRealizados = cantidadEventos,
            });

            if (totalIngresos != 0 || totalEgresos != 0 || cantidadEventos != 0)
            {
                actividad.Add(new CajaMensualActividadDiaDto
                {
                    Fecha = dia,
                    TotalIngresos = totalIngresos,
                    TotalEgresos = totalEgresos,
                    Resultado = totalIngresos - totalEgresos,
                    CantidadEventosRealizados = cantidadEventos,
                    Ingresos = ingresosDia,
                    Egresos = egresosDia,
                    Eventos = eventosDia,
                });
            }
        }

        return new CajaMensualDto
        {
            Anio = anio,
            Mes = mes,
            Desde = desde,
            Hasta = hasta,
            Dias = dias,
            DiasActividad = actividad,
            TotalIngresos = dias.Sum(d => d.TotalIngresos),
            TotalEgresos = dias.Sum(d => d.TotalEgresos),
            Resultado = dias.Sum(d => d.Resultado),
            EventosRealizados = dias.Sum(d => d.CantidadEventosRealizados),
            IngresosPorMedio = ingresosPorMedio,
        };
    }

    private async Task<Sucursal> ObtenerSucursalActivaAsync(CancellationToken ct)
    {
        var sucursales = await context.Sucursal.Where(s => s.ACTIVO).ToListAsync(ct);
        if (sucursales.Count != 1) throw new InvalidOperationException("Se esperaba una única sucursal activa.");
        return sucursales[0];
    }
}
