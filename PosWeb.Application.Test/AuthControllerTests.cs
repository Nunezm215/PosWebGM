using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using PosWeb.Controllers;

namespace PosWeb.Application.Test;

public class AuthControllerTests
{
    [Fact]
    public void Register_RequiereAdminOSuperAdmin()
    {
        var method = typeof(AuthController).GetMethod(nameof(AuthController.Register), BindingFlags.Instance | BindingFlags.Public)!;
        var authorize = method.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true).Cast<AuthorizeAttribute>().Single();

        Assert.Equal("SuperAdmin,Admin", authorize.Roles);
    }
}
