using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using PosWeb.Controllers;

namespace PosWeb.Application.Test.Gastos;

public class GastosControllerTests
{
    private static AuthorizeAttribute ObtenerAuthorize(string methodName)
    {
        var method = typeof(GastosController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public)!;
        return method.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true).Cast<AuthorizeAttribute>().Single();
    }

    [Fact]
    public void ObtenerHistorial_RequiereAdminYSuperAdmin()
    {
        var attr = ObtenerAuthorize(nameof(GastosController.ObtenerHistorial));

        Assert.Equal("Admin,SuperAdmin", attr.Roles);
    }

    [Fact]
    public void ObtenerPorCaja_RequiereAdminYSuperAdmin()
    {
        var attr = ObtenerAuthorize(nameof(GastosController.ObtenerPorCaja));

        Assert.Equal("Admin,SuperAdmin", attr.Roles);
    }
}
