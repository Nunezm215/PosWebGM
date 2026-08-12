using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Exceptions;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;

namespace PosWeb.Application.Clientes;

public class ClienteService
{
    private readonly PosDbContextLocal _context;

    public ClienteService(PosDbContextLocal context)
    {
        _context = context;
    }

    public PagedResult<ClienteDto> Listar(string? q, int page, int pageSize)
    {
        IQueryable<Cliente> query = _context.Cliente;

        if (!string.IsNullOrWhiteSpace(q))
        {
            q = q.Trim();
            query = query.Where(c =>
                EF.Functions.Like(c.NOMBRE, $"%{q}%") ||
                EF.Functions.Like(c.NRO_DOCUMENTO ?? string.Empty, $"%{q}%")
            );
        }

        var totalCount = query.Count();

        var items = query
            .OrderBy(c => c.NOMBRE)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new ClienteDto
            {
                Id = c.ID_CLIENTE,
                Nombre = c.NOMBRE,
                FechaNacimiento = c.FECHA_NACIMIENTO,
                TipoDocumento = c.TIPO_DOCUMENTO,
                NumeroDocumento = c.NRO_DOCUMENTO,
                IvaCondicion = c.IVA_CONDICION,
                Telefono = c.TELEFONO,
                Domicilio = c.DOMICILIO,
                Activo = c.ACTIVO
            })
            .ToList();

        return new PagedResult<ClienteDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public ClienteDto? Obtener(int id)
    {
        Cliente? cliente = _context.Cliente.Find(id);
        if (cliente == null) return null;

        return MapToDto(cliente);
    }

    public ClienteDto Crear(ClienteDto dto)
    {
        var nombre = Requerido(dto.Nombre, "El nombre es requerido");
        var fechaNacimiento = RequeridoFechaNacimiento(dto.FechaNacimiento);
        var telefono = Requerido(dto.Telefono, "El teléfono es requerido");
        var mail = Requerido(dto.Mail, "El mail es requerido");
        var tipoDocumento = string.IsNullOrWhiteSpace(dto.TipoDocumento) ? "ConsumidorFinal" : dto.TipoDocumento.Trim();
        var numeroDocumento = NormalizarOpcional(dto.NumeroDocumento);
        var domicilio = NormalizarOpcional(dto.Domicilio);
        var codCliente = NormalizarOpcional(dto.CodCliente);

        // Find-or-create para clientes ocasionales (ConsumidorFinal + s/nro)
        // El nombre es la UK: mismo nombre → mismo registro
        if (tipoDocumento == "ConsumidorFinal" && string.IsNullOrEmpty(numeroDocumento))
        {
            var existente = _context.Cliente
                .FirstOrDefault(c =>
                    c.NOMBRE == nombre
                    && c.TIPO_DOCUMENTO == "ConsumidorFinal"
                    && (c.NRO_DOCUMENTO == null || c.NRO_DOCUMENTO == "0")
                    && c.ACTIVO);
            if (existente != null)
            {
                return MapToDto(existente);
            }
        }

        // Check duplicate document
        if (!string.IsNullOrEmpty(numeroDocumento))
        {
            bool duplicado = _context.Cliente
                .Any(c => c.TIPO_DOCUMENTO == tipoDocumento
                          && c.NRO_DOCUMENTO == numeroDocumento
                          && c.ACTIVO);

            if (duplicado)
            {
                throw new ClienteDuplicadoException(tipoDocumento, numeroDocumento);
            }
        }

        var cliente = new Cliente(
            nombre,
            tipoDocumento,
            numeroDocumento,
            fechaNacimiento,
            codCliente,
            telefono,
            domicilio,
            mail,
            dto.IvaCondicion
        );

        _context.Cliente.Add(cliente);
        _context.SaveChanges();

        return MapToDto(cliente);
    }

    public ClienteDto Actualizar(int id, ClienteDto dto)
    {
        Cliente? cliente = _context.Cliente.Find(id);
        if (cliente == null)
        {
            throw new ClienteNoEncontradoException(id);
        }

        var nombre = Requerido(dto.Nombre, "El nombre es requerido");
        var fechaNacimiento = RequeridoFechaNacimiento(dto.FechaNacimiento);
        var telefono = Requerido(dto.Telefono, "El teléfono es requerido");
        var mail = Requerido(dto.Mail, "El mail es requerido");
        var tipoDocumento = string.IsNullOrWhiteSpace(dto.TipoDocumento) ? "ConsumidorFinal" : dto.TipoDocumento.Trim();
        var numeroDocumento = NormalizarOpcional(dto.NumeroDocumento);
        var domicilio = NormalizarOpcional(dto.Domicilio);

        // Check duplicate document excluding self
        if (!string.IsNullOrEmpty(numeroDocumento))
        {
            bool duplicado = _context.Cliente
                .Any(c => c.TIPO_DOCUMENTO == tipoDocumento
                          && c.NRO_DOCUMENTO == numeroDocumento
                          && c.ID_CLIENTE != id
                          && c.ACTIVO);

            if (duplicado)
            {
                throw new ClienteDuplicadoException(tipoDocumento, numeroDocumento);
            }
        }

        cliente.CambiarNombre(nombre);
        cliente.CambiarFechaNacimiento(fechaNacimiento);
        cliente.CambiarTipoDocumento(tipoDocumento, numeroDocumento);
        cliente.CambiarTelefono(telefono);
        cliente.CambiarDomicilio(domicilio);
        cliente.SetMail(mail);
        cliente.SetIvaCondicion(dto.IvaCondicion);

        _context.SaveChanges();

        return MapToDto(cliente);
    }

    public void Desactivar(int id)
    {
        Cliente? cliente = _context.Cliente.Find(id);
        if (cliente == null || !cliente.ACTIVO)
            throw new ClienteNoEncontradoException(id);

        cliente.Desactivar();
        _context.SaveChanges();
    }

    private static ClienteDto MapToDto(Cliente cliente)
    {
        return new ClienteDto
        {
            Id = cliente.ID_CLIENTE,
            Nombre = cliente.NOMBRE,
            FechaNacimiento = cliente.FECHA_NACIMIENTO,
            TipoDocumento = cliente.TIPO_DOCUMENTO,
            NumeroDocumento = cliente.NRO_DOCUMENTO,
            IvaCondicion = cliente.IVA_CONDICION,
            Telefono = cliente.TELEFONO,
            Domicilio = cliente.DOMICILIO,
            CodCliente = cliente.COD_CLIENTE,
            Mail = cliente.MAIL,
            Activo = cliente.ACTIVO
        };
    }

    private static string Requerido(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(message);
        }

        return value.Trim();
    }

    private static DateOnly RequeridoFechaNacimiento(DateOnly? value)
    {
        if (!value.HasValue)
        {
            throw new ArgumentException("La fecha de nacimiento es requerida");
        }

        var hoy = DateOnly.FromDateTime(DateTime.Today);
        if (value.Value > hoy)
        {
            throw new ArgumentException("La fecha de nacimiento no puede ser futura");
        }

        return value.Value;
    }

    private static string? NormalizarOpcional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
