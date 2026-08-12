using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Clientes;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Test.Clientes;

public class ClienteServiceTests
{
    private static PosDbContextLocal CrearContexto()
    {
        var options = new DbContextOptionsBuilder<PosDbContextLocal>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new PosDbContextLocal(options);
    }

    private static ClienteService CrearService(PosDbContextLocal context)
        => new(context);

    private static ClienteDto CrearDto(
        string nombre = "Cliente Nuevo",
        DateOnly? fechaNacimiento = null,
        string telefono = "11111111",
        string mail = "cliente@correo.com",
        string tipoDocumento = "DNI",
        string? numeroDocumento = "12345678",
        string? domicilio = "Calle 123")
    {
        return new ClienteDto
        {
            Nombre = nombre,
            FechaNacimiento = fechaNacimiento ?? DateOnly.FromDateTime(DateTime.Today.AddYears(-30)),
            TipoDocumento = tipoDocumento,
            NumeroDocumento = numeroDocumento,
            IvaCondicion = "ConsumidorFinal",
            Telefono = telefono,
            Domicilio = domicilio,
            Mail = mail,
        };
    }

    [Fact]
    public void Crear_con_datos_validos_crea_cliente()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto();

        var creado = service.Crear(dto);

        Assert.NotEqual(0, creado.Id);
        Assert.Equal(dto.Nombre, creado.Nombre);
        Assert.Equal(dto.FechaNacimiento, creado.FechaNacimiento);
        Assert.Equal(dto.Telefono, creado.Telefono);
        Assert.Equal(dto.Mail, creado.Mail);
    }

    [Fact]
    public void Crear_sin_nombre_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(nombre: " ");

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_sin_fecha_nacimiento_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto();
        dto.FechaNacimiento = null;

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_con_fecha_futura_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(fechaNacimiento: DateOnly.FromDateTime(DateTime.Today.AddDays(1)));

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_sin_telefono_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(telefono: "   ");

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_sin_mail_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(mail: "   ");

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_con_mail_invalido_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(mail: "no-es-mail");

        var ex = Assert.Throws<ArgumentException>(() => service.Crear(dto));
        Assert.Contains("Mail inválido", ex.Message);
    }

    [Fact]
    public void Crear_con_DNI_vacio_y_domicilio_vacio_permitido()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(numeroDocumento: "", domicilio: "   ");

        var creado = service.Crear(dto);

        Assert.True(string.IsNullOrEmpty(creado.NumeroDocumento));
        Assert.True(string.IsNullOrEmpty(creado.Domicilio));
    }

    [Fact]
    public void Cliente_historico_sin_fecha_nacimiento_sigue_consultable()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var cliente = new Cliente("Cliente Historico", "DNI", "12345678", telefono: "11111111", mail: "hist@correo.com");
        context.Cliente.Add(cliente);
        context.SaveChanges();

        var consultado = service.Obtener(cliente.ID_CLIENTE);

        Assert.NotNull(consultado);
        Assert.Null(consultado!.FechaNacimiento);
        Assert.Equal("Cliente Historico", consultado.Nombre);
    }

    [Fact]
    public void Editar_cliente_historico_exige_fecha_nacimiento()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var cliente = new Cliente("Cliente Historico", "DNI", "12345678", telefono: "11111111", mail: "hist@correo.com");
        context.Cliente.Add(cliente);
        context.SaveChanges();

        var dto = CrearDto();
        dto.FechaNacimiento = null;

        Assert.Throws<ArgumentException>(() => service.Actualizar(cliente.ID_CLIENTE, dto));
    }
}
