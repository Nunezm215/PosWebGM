using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Cajas;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Test.Cajas;

public class CajaDiariaServiceTests
{
    private static async Task<PosDbContextLocal> CrearContextoAsync(SqliteConnection connection)
    {
        var context = new PosDbContextLocal(new DbContextOptionsBuilder<PosDbContextLocal>().UseSqlite(connection).Options);
        await context.Database.MigrateAsync();
        var usuario = await context.Usuario.FirstAsync();
        var suscripcion = Suscripcion.CrearBasica(usuario.ID_USUARIO); context.Suscripcion.Add(suscripcion); await context.SaveChangesAsync();
        var empresa = new Empresa("Empresa", "30-00000000-9", suscripcion.ID_SUSCRIPCION); context.Empresa.Add(empresa); await context.SaveChangesAsync();
        context.Sucursal.Add(new Sucursal("CD", "Caja diaria", empresa.ID_EMPRESA)); await context.SaveChangesAsync();
        return context;
    }
    [Fact]
    public async Task Dia_vacio_devuelve_totales_y_listas_vacias()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = await CrearContextoAsync(connection);

        var resultado = await new CajaDiariaService(context).ObtenerAsync(new DateOnly(2026, 8, 16));

        Assert.Equal(0m, resultado.TotalIngresos); Assert.Equal(0m, resultado.TotalEgresos); Assert.Equal(0m, resultado.Resultado);
        Assert.Equal(0, resultado.CantidadEventosRealizados); Assert.Empty(resultado.Ingresos); Assert.Empty(resultado.Egresos); Assert.Empty(resultado.EventosRealizados);
    }

    private sealed class RelojFijo(DateTimeOffset ahora) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => ahora;
    }

    [Fact]
    public async Task ObtenerMensualAsync_MesActualHastaHoy_UsaRangoArgentinaCorrecto()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = await CrearContextoAsync(connection);
        var ahora = new DateTimeOffset(2026, 8, 17, 18, 0, 0, TimeSpan.Zero);
        var service = new CajaDiariaService(context, new RelojFijo(ahora));

        var resultado = await service.ObtenerMensualAsync(2026, 8);

        Assert.Equal(new DateOnly(2026, 8, 1), resultado.Desde);
        Assert.Equal(new DateOnly(2026, 8, 17), resultado.Hasta);
        Assert.Equal(17, resultado.Dias.Count);
        Assert.Equal(new DateOnly(2026, 8, 1), resultado.Dias.First().Fecha);
        Assert.Equal(new DateOnly(2026, 8, 17), resultado.Dias.Last().Fecha);
        Assert.DoesNotContain(resultado.Dias, d => d.Fecha == new DateOnly(2026, 8, 18));
    }

    [Fact]
    public async Task ObtenerMensualAsync_MesAnterior_DevuelveMesCompleto()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = await CrearContextoAsync(connection);
        var ahora = new DateTimeOffset(2026, 8, 17, 18, 0, 0, TimeSpan.Zero);
        var service = new CajaDiariaService(context, new RelojFijo(ahora));

        var resultado = await service.ObtenerMensualAsync(2026, 7);

        Assert.Equal(new DateOnly(2026, 7, 1), resultado.Desde);
        Assert.Equal(new DateOnly(2026, 7, 31), resultado.Hasta);
        Assert.Equal(31, resultado.Dias.Count);
        Assert.Equal(new DateOnly(2026, 7, 1), resultado.Dias.First().Fecha);
        Assert.Equal(new DateOnly(2026, 7, 31), resultado.Dias.Last().Fecha);
        Assert.Contains(resultado.Dias, d => d.Fecha == new DateOnly(2026, 7, 31));
        Assert.DoesNotContain(resultado.Dias, d => d.Fecha == new DateOnly(2026, 8, 1));
    }

    [Fact]
    public async Task ObtenerMensualAsync_MesFuturo_RechazaConsulta()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = await CrearContextoAsync(connection);
        var ahora = new DateTimeOffset(2026, 8, 17, 18, 0, 0, TimeSpan.Zero);
        var service = new CajaDiariaService(context, new RelojFijo(ahora));

        var error = await Assert.ThrowsAsync<ArgumentException>(() => service.ObtenerMensualAsync(2026, 9));

        Assert.Equal("No se puede consultar un mes futuro.", error.Message);
    }

    [Fact]
    public async Task ObtenerMensualAsync_SumaActivosYExcluyeAnulados()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = await CrearContextoAsync(connection);
        var ahora = new DateTimeOffset(2026, 8, 17, 18, 0, 0, TimeSpan.Zero);
        var service = new CajaDiariaService(context, new RelojFijo(ahora));
        var sucursalId = await context.Sucursal.Select(s => s.ID_SUCURSAL).SingleAsync();
        var usuarioId = await context.Usuario.Select(u => u.ID_USUARIO).FirstAsync();
        var cliente = new Cliente("Cliente Test", "DNI", "12345678", null, null, "1122334455", "Domicilio Test", "cliente@test.com");
        context.Cliente.Add(cliente);
        await context.SaveChangesAsync();
        var eventoActivo1 = new Evento(cliente.ID_CLIENTE, usuarioId, sucursalId, new DateOnly(2026, 8, 17), new TimeOnly(18, 0), new TimeOnly(21, 0), "Cumpleanos", 10, 100000m);
        var eventoActivo2 = new Evento(cliente.ID_CLIENTE, usuarioId, sucursalId, new DateOnly(2026, 8, 17), new TimeOnly(21, 0), new TimeOnly(23, 0), "Cumpleanos", 10, 250000m);
        var eventoAnulado = new Evento(cliente.ID_CLIENTE, usuarioId, sucursalId, new DateOnly(2026, 8, 17), new TimeOnly(23, 0), new TimeOnly(23, 59), "Cumpleanos", 10, 900000m);
        eventoAnulado.Cancelar();
        context.Evento.AddRange(eventoActivo1, eventoActivo2, eventoAnulado);
        await context.SaveChangesAsync();

        var pagoActivo1 = new PagoEvento(eventoActivo1.ID_EVENTO, 1, 100000m, usuarioId, fechaRegistro: ahora.UtcDateTime);
        var pagoActivo2 = new PagoEvento(eventoActivo2.ID_EVENTO, 1, 250000m, usuarioId, fechaRegistro: ahora.UtcDateTime);
        var pagoAnulado = new PagoEvento(eventoAnulado.ID_EVENTO, 1, 900000m, usuarioId, fechaRegistro: ahora.UtcDateTime);
        pagoAnulado.Anular(usuarioId, "Sin efecto");
        context.PagoEvento.AddRange(pagoActivo1, pagoActivo2, pagoAnulado);

        var gastoActivo = Gasto.CrearSimple(sucursalId, 50000m, "Gasto activo", usuarioId, ahora.UtcDateTime);
        var gastoAnulado = Gasto.CrearSimple(sucursalId, 700000m, "Gasto anulado", usuarioId, ahora.UtcDateTime);
        gastoAnulado.Anular();
        context.Gasto.AddRange(gastoActivo, gastoAnulado);
        await context.SaveChangesAsync();

        var resultado = await service.ObtenerMensualAsync(2026, 8);

        Assert.Equal(350000m, resultado.TotalIngresos);
        Assert.Equal(50000m, resultado.TotalEgresos);
        Assert.Equal(300000m, resultado.Resultado);
        Assert.Single(resultado.IngresosPorMedio);
        Assert.Equal(1, resultado.IngresosPorMedio[0].MedioPagoId);
        Assert.Equal(2, resultado.IngresosPorMedio[0].CantidadPagos);
        Assert.Equal(350000m, resultado.IngresosPorMedio[0].Total);
        Assert.DoesNotContain(resultado.IngresosPorMedio, x => x.Total == 900000m);
        Assert.DoesNotContain(resultado.IngresosPorMedio, x => x.Total == 700000m);
    }

    [Fact]
    public async Task Historial_vacio_incluye_todos_los_dias_en_orden_y_valida_rango()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:"); await connection.OpenAsync();
        var service = new CajaDiariaService(await CrearContextoAsync(connection));
        var items = await service.ObtenerHistorialAsync(new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 3));
        Assert.Equal(new[] { new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 2), new DateOnly(2026, 8, 3) }, items.Select(x => x.Fecha));
        Assert.All(items, x => { Assert.Equal(0m, x.TotalIngresos); Assert.Equal(0m, x.TotalEgresos); Assert.Equal(0m, x.Resultado); });
        await Assert.ThrowsAsync<ArgumentException>(() => service.ObtenerHistorialAsync(new DateOnly(2026, 8, 3), new DateOnly(2026, 8, 1)));
        await Assert.ThrowsAsync<ArgumentException>(() => service.ObtenerHistorialAsync(new DateOnly(2026, 1, 1), new DateOnly(2027, 1, 2)));
    }
}
