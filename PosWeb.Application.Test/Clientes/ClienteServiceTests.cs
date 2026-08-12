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
        string? domicilio = "Calle 123",
        List<FamiliarClienteDto>? familiares = null)
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
            Familiares = familiares ?? new List<FamiliarClienteDto>(),
        };
    }

    private static FamiliarClienteDto CrearFamiliarDto(int? id = null, string nombre = "Familiar Uno", DateOnly? fechaNacimiento = null)
        => new()
        {
            Id = id,
            Nombre = nombre,
            FechaNacimiento = fechaNacimiento ?? DateOnly.FromDateTime(DateTime.Today.AddYears(-5)),
        };

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
        Assert.Empty(creado.Familiares);
    }

    [Fact]
    public void Crear_con_un_familiar_crea_cliente_y_familiar()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(familiares: new List<FamiliarClienteDto> { CrearFamiliarDto() });

        var creado = service.Crear(dto);

        Assert.Single(creado.Familiares);
        Assert.Equal("Familiar Uno", creado.Familiares[0].Nombre);
    }

    [Fact]
    public void Crear_con_varios_familiares_crea_todos()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(familiares: new List<FamiliarClienteDto>
        {
            CrearFamiliarDto(nombre: "Familiar Uno"),
            CrearFamiliarDto(nombre: "Familiar Dos"),
        });

        var creado = service.Crear(dto);

        Assert.Equal(2, creado.Familiares.Count);
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
    public void Crear_familiar_con_nombre_vacio_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(familiares: new List<FamiliarClienteDto>
        {
            CrearFamiliarDto(nombre: "   ")
        });

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_familiar_sin_fecha_nacimiento_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(familiares: new List<FamiliarClienteDto>
        {
            new FamiliarClienteDto { Nombre = "Familiar Uno" }
        });

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
    }

    [Fact]
    public void Crear_familiar_con_fecha_futura_rechaza()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var dto = CrearDto(familiares: new List<FamiliarClienteDto>
        {
            CrearFamiliarDto(fechaNacimiento: DateOnly.FromDateTime(DateTime.Today.AddDays(1)))
        });

        Assert.Throws<ArgumentException>(() => service.Crear(dto));
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
        Assert.Empty(consultado.Familiares);
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

    [Fact]
    public void Editar_agrega_modifica_y_elimina_familiares()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var creado = service.Crear(CrearDto(familiares: new List<FamiliarClienteDto>
        {
            CrearFamiliarDto(nombre: "Familiar Uno"),
        }));

        var existente = creado.Familiares.Single();
        var actualizado = service.Actualizar(creado.Id, CrearDto(
            nombre: creado.Nombre,
            fechaNacimiento: creado.FechaNacimiento,
            telefono: creado.Telefono!,
            mail: creado.Mail!,
            numeroDocumento: creado.NumeroDocumento,
            domicilio: creado.Domicilio,
            familiares: new List<FamiliarClienteDto>
            {
                new() { Id = existente.Id, Nombre = "Familiar Uno Editado", FechaNacimiento = existente.FechaNacimiento },
                CrearFamiliarDto(nombre: "Familiar Dos"),
            }));

        Assert.Equal(2, actualizado.Familiares.Count);
        Assert.Contains(actualizado.Familiares, f => f.Nombre == "Familiar Uno Editado");
        Assert.Contains(actualizado.Familiares, f => f.Nombre == "Familiar Dos");

        var sinUno = service.Actualizar(creado.Id, CrearDto(
            nombre: creado.Nombre,
            fechaNacimiento: creado.FechaNacimiento,
            telefono: creado.Telefono!,
            mail: creado.Mail!,
            numeroDocumento: creado.NumeroDocumento,
            domicilio: creado.Domicilio,
            familiares: new List<FamiliarClienteDto>
            {
                new() { Id = existente.Id, Nombre = "Familiar Uno Editado", FechaNacimiento = existente.FechaNacimiento },
            }));

        Assert.Single(sinUno.Familiares);
        Assert.Equal("Familiar Uno Editado", sinUno.Familiares[0].Nombre);
    }

    [Fact]
    public void Borrar_cliente_preserva_delete_behavior_y_cascada_es_coherente()
    {
        using var context = CrearContexto();
        var service = CrearService(context);

        var cliente = service.Crear(CrearDto(familiares: new List<FamiliarClienteDto>
        {
            CrearFamiliarDto(),
        }));

        var familiarAntes = context.Set<FamiliarCliente>().Count();
        Assert.Equal(1, familiarAntes);

        context.Cliente.Remove(context.Cliente.Find(cliente.Id)!);
        context.SaveChanges();

        Assert.Equal(0, context.Set<FamiliarCliente>().Count());
    }
}
