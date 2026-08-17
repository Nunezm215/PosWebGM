using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PosWeb.Contracts;
using PosWeb.Controllers;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Testing;

namespace PosWeb.Application.Test;

public class UsuariosControllerTests
{
    private static PosDbContextLocal Contexto(string nombre) => new(new DbContextOptionsBuilder<PosDbContextLocal>().UseInMemoryDatabase(nombre).Options);
    private static Usuario Usuario(PosDbContextLocal context, int id, string nombre, string rol)
    {
        var usuario = new Usuario(nombre, BCrypt.Net.BCrypt.HashPassword("123456"), rol, "test@mail.com");
        TestHelpers.SetId(usuario, id, "ID_USUARIO"); context.Usuario.Add(usuario); context.SaveChanges(); return usuario;
    }
    private static UsuariosController Controller(PosDbContextLocal context, int? userId = null)
    {
        var controller = new UsuariosController(context);
        if (userId.HasValue) controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.Value.ToString())], "test")) } };
        return controller;
    }

    [Fact]
    public void Crear_HasheaPasswordYPin_YNoLosExpone()
    {
        var context = Contexto(nameof(Crear_HasheaPasswordYPin_YNoLosExpone));
        var result = Controller(context, 1).Crear(new CrearUsuarioRequestDto { Usuario = "nuevo", Password = "secreto", Pin = "1234", Rol = Roles.UsuarioComun });
        var created = Assert.IsType<CreatedAtActionResult>(result);
        var usuario = Assert.Single(context.Usuario);
        Assert.True(BCrypt.Net.BCrypt.Verify("secreto", usuario.PASSWORD_HASH));
        Assert.True(BCrypt.Net.BCrypt.Verify("1234", usuario.PIN_HASH));
        Assert.DoesNotContain(created.Value!.GetType().GetProperties(), property => property.Name.Contains("HASH", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Crear_RechazaRolInvalidoYDuplicado()
    {
        var context = Contexto(nameof(Crear_RechazaRolInvalidoYDuplicado)); Usuario(context, 1, "existente", Roles.Admin);
        var controller = Controller(context, 1);
        Assert.IsType<BadRequestObjectResult>(controller.Crear(new CrearUsuarioRequestDto { Usuario = "nuevo", Password = "123456", Rol = "Otro" }));
        Assert.IsType<ConflictObjectResult>(controller.Crear(new CrearUsuarioRequestDto { Usuario = "existente", Password = "123456", Rol = Roles.UsuarioComun }));
    }

    [Fact]
    public void Editar_ConservaCredencialesVacias_YActualizaDatos()
    {
        var context = Contexto(nameof(Editar_ConservaCredencialesVacias_YActualizaDatos)); var usuario = Usuario(context, 1, "anterior", Roles.Admin);
        var hash = usuario.PASSWORD_HASH;
        var result = Controller(context, 2).Editar(1, new EditarUsuarioRequestDto { Usuario = "nuevo", Mail = "nuevo@mail.com", Rol = Roles.Admin });
        Assert.IsType<OkObjectResult>(result); Assert.Equal("nuevo", usuario.NOMBRE_USUARIO); Assert.Equal(hash, usuario.PASSWORD_HASH);
    }

    [Fact]
    public void Desactivar_BloqueaAutoDesactivacionYUltimoAdmin()
    {
        var context = Contexto(nameof(Desactivar_BloqueaAutoDesactivacionYUltimoAdmin)); Usuario(context, 1, "admin", Roles.Admin);
        Assert.IsType<BadRequestObjectResult>(Controller(context, 1).Desactivar(1));
        Assert.IsType<BadRequestObjectResult>(Controller(context, 2).Desactivar(1));
    }

    [Fact]
    public void Desactivar_PermiteOtroAdminCuandoQuedaUnoActivo()
    {
        var context = Contexto(nameof(Desactivar_PermiteOtroAdminCuandoQuedaUnoActivo)); Usuario(context, 1, "admin1", Roles.Admin); var segundo = Usuario(context, 2, "admin2", Roles.SuperAdmin);
        Assert.IsType<NoContentResult>(Controller(context, 1).Desactivar(2)); Assert.False(segundo.ACTIVO);
    }
}
