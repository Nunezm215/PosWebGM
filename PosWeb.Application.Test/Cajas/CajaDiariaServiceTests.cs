using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Cajas;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Test.Cajas;

public class CajaDiariaServiceTests
{
    [Fact]
    public async Task Dia_vacio_devuelve_totales_y_listas_vacias()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        var context = new PosDbContextLocal(new DbContextOptionsBuilder<PosDbContextLocal>().UseSqlite(connection).Options);
        await context.Database.MigrateAsync();
        var usuario = await context.Usuario.FirstAsync();
        var suscripcion = Suscripcion.CrearBasica(usuario.ID_USUARIO);
        context.Suscripcion.Add(suscripcion); await context.SaveChangesAsync();
        var empresa = new Empresa("Empresa", "30-00000000-9", suscripcion.ID_SUSCRIPCION);
        context.Empresa.Add(empresa); await context.SaveChangesAsync();
        context.Sucursal.Add(new Sucursal("CD", "Caja diaria", empresa.ID_EMPRESA)); await context.SaveChangesAsync();

        var resultado = await new CajaDiariaService(context).ObtenerAsync(new DateOnly(2026, 8, 16));

        Assert.Equal(0m, resultado.TotalIngresos); Assert.Equal(0m, resultado.TotalEgresos); Assert.Equal(0m, resultado.Resultado);
        Assert.Equal(0, resultado.CantidadEventosRealizados); Assert.Empty(resultado.Ingresos); Assert.Empty(resultado.Egresos); Assert.Empty(resultado.EventosRealizados);
    }
}
