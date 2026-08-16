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
