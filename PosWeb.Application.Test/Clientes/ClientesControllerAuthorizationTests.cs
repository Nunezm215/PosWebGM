using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using PosWeb.Controllers;
using PosWeb.Domain;

namespace PosWeb.Application.Test.Clientes;

public class ClientesControllerAuthorizationTests
{
    [Theory]
    [InlineData(nameof(ClientesController.Listar), true)]
    [InlineData(nameof(ClientesController.Obtener), true)]
    [InlineData(nameof(ClientesController.Crear), true)]
    [InlineData(nameof(ClientesController.Actualizar), false)]
    [InlineData(nameof(ClientesController.Desactivar), false)]
    public void PermisosDeCliente_SonExplicitos(string accion, bool permiteUsuarioComun)
    {
        var method = typeof(ClientesController).GetMethods(BindingFlags.Public | BindingFlags.Instance).Single(m => m.Name == accion);
        var roles = method.GetCustomAttribute<AuthorizeAttribute>()?.Roles;
        Assert.NotNull(roles);
        Assert.Contains(Roles.Admin, roles);
        Assert.Contains(Roles.SuperAdmin, roles);
        Assert.Equal(permiteUsuarioComun, roles.Contains(Roles.UsuarioComun));
    }
}
