using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Application.Clientes;
using PosWeb.Contracts;
using PosWeb.Controllers;
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

    private static ClienteDto CrearDtoCumple(string nombre, DateOnly fechaNacimiento, string numeroDocumento, string telefono = "11111111", List<FamiliarClienteDto>? familiares = null)
        => CrearDto(nombre, fechaNacimiento, telefono, $"{nombre.Replace(" ", "").ToLowerInvariant()}@correo.com", numeroDocumento: numeroDocumento, familiares: familiares);

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

    [Fact]
    public void Proximos_cumpleanios_incluye_hoy_manana_y_limite_de_90_dias()
    {
        using var context = CrearContexto();
        var service = CrearService(context);
        var hoy = new DateOnly(2026, 8, 16);

        var cumpleHoy = service.Crear(CrearDtoCumple("Hoy", new DateOnly(1990, 8, 16), "10000001"));
        var cumpleManana = service.Crear(CrearDtoCumple("Manana", new DateOnly(1990, 8, 17), "10000002"));
        var cumple90 = service.Crear(CrearDtoCumple("Limite", new DateOnly(1990, 11, 14), "10000003"));
        var cumple91 = service.Crear(CrearDtoCumple("Fuera", new DateOnly(1990, 11, 15), "10000004"));
        var pasado = service.Crear(CrearDtoCumple("Pasado", new DateOnly(1990, 8, 15), "10000005"));
        context.Cliente.Add(new Cliente("Historico", "DNI", "10000006", telefono: "11111111", mail: "historico@correo.com"));
        context.SaveChanges();

        var resultados = service.ListarProximosCumpleanios(90, hoy);

        Assert.Contains(resultados, r => r.PersonaId == cumpleHoy.Id && r.DiasFaltantes == 0);
        Assert.Contains(resultados, r => r.PersonaId == cumpleManana.Id && r.DiasFaltantes == 1);
        Assert.Contains(resultados, r => r.PersonaId == cumple90.Id && r.DiasFaltantes == 90);
        Assert.DoesNotContain(resultados, r => r.PersonaId == cumple91.Id);
        Assert.DoesNotContain(resultados, r => r.PersonaId == pasado.Id);
        Assert.DoesNotContain(resultados, r => r.NombrePersona == "Historico");
        Assert.Equal(resultados.OrderBy(r => r.DiasFaltantes).ThenBy(r => r.NombrePersona).Select(r => r.PersonaId), resultados.Select(r => r.PersonaId));
    }

    [Fact]
    public void Proximos_cumpleanios_incluye_familiar_y_usa_datos_del_titular()
    {
        using var context = CrearContexto();
        var service = CrearService(context);
        var hoy = new DateOnly(2026, 12, 15);
        var cliente = service.Crear(CrearDtoCumple(
            "Titular",
            new DateOnly(1990, 6, 1),
            "10000007",
            "5491112345678",
            new List<FamiliarClienteDto> { new() { Nombre = "Sofia", FechaNacimiento = new DateOnly(2015, 1, 10) } }));

        var resultado = Assert.Single(service.ListarProximosCumpleanios(90, hoy));

        Assert.Equal("Familiar", resultado.TipoPersona);
        Assert.Equal("Sofia", resultado.NombrePersona);
        Assert.Equal(new DateOnly(2027, 1, 10), resultado.ProximoCumpleanios);
        Assert.Equal(cliente.Id, resultado.ClienteId);
        Assert.Equal("Titular", resultado.NombreCliente);
        Assert.Equal("5491112345678", resultado.TelefonoCliente);
    }

    [Fact]
    public void Proximos_cumpleanios_aplica_regla_de_29_de_febrero_e_ignora_inactivos()
    {
        using var context = CrearContexto();
        var service = CrearService(context);
        var leap = service.Crear(CrearDtoCumple("Leap", new DateOnly(2000, 2, 29), "10000008"));
        var inactivo = service.Crear(CrearDtoCumple("Inactivo", new DateOnly(1990, 1, 2), "10000009"));
        service.Desactivar(inactivo.Id);

        var noBisiesto = Assert.Single(service.ListarProximosCumpleanios(90, new DateOnly(2027, 1, 1)));
        Assert.Equal(leap.Id, noBisiesto.PersonaId);
        Assert.Equal(new DateOnly(2027, 2, 28), noBisiesto.ProximoCumpleanios);

        var bisiesto = Assert.Single(service.ListarProximosCumpleanios(90, new DateOnly(2028, 1, 1)));
        Assert.Equal(new DateOnly(2028, 2, 29), bisiesto.ProximoCumpleanios);
        Assert.DoesNotContain(service.ListarProximosCumpleanios(365, new DateOnly(2027, 1, 1)), r => r.PersonaId == inactivo.Id);
    }

    [Fact]
    public void Proximos_cumpleanios_controller_usa_default_valida_dias_y_devuelve_dto()
    {
        using var context = CrearContexto();
        var service = CrearService(context);
        service.Crear(CrearDtoCumple("Hoy", DateOnly.FromDateTime(DateTime.Today), "10000010"));
        var controller = new ClientesController(service);

        var ok = Assert.IsType<OkObjectResult>(controller.ListarProximosCumpleanios().Result);
        Assert.IsAssignableFrom<IReadOnlyList<ProximoCumpleaniosResponseDto>>(ok.Value);
        Assert.IsType<BadRequestObjectResult>(controller.ListarProximosCumpleanios(-1).Result);
        Assert.IsType<BadRequestObjectResult>(controller.ListarProximosCumpleanios(366).Result);
    }
}
