using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using System.Security.Claims;

namespace PosWeb.Controllers;

[ApiController]
[Route("api/usuarios")]
[Authorize(Roles = $"{Roles.SuperAdmin},{Roles.Admin}")]
public class UsuariosController : ControllerBase
{
    private readonly PosDbContextLocal _context;

    public UsuariosController(PosDbContextLocal context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult Listar()
    {
        var usuariosPorId = _context.Usuario
            .ToDictionary(u => u.ID_USUARIO);

        var responsables = usuariosPorId
            .ToDictionary(u => u.Key, u => u.Value.NOMBRE_USUARIO);

        var suscripcionesPorTitular = _context.Suscripcion
            .ToDictionary(s => s.ID_USUARIO_TITULAR, s => s);

        var usuarios = _context.Usuario
            .OrderBy(u => u.NOMBRE_USUARIO)
            .AsEnumerable()
            .Select(u => new UsuarioDto
            {
                Id = u.ID_USUARIO,
                NombreUsuario = u.NOMBRE_USUARIO,
                Mail = u.MAIL,
                Rol = u.ROL,
                UsuarioResponsableId = u.ID_USUARIO_RESP,
                UsuarioResponsableNombre = u.ID_USUARIO_RESP.HasValue && responsables.TryGetValue(u.ID_USUARIO_RESP.Value, out var nombreResponsable)
                    ? nombreResponsable
                    : null,
                Activo = u.ACTIVO,
                EmpresaId = u.ID_EMPRESA,
                SuscripcionActiva = TieneSuscripcionActiva(u, usuariosPorId, suscripcionesPorTitular),
                AccesoHabilitado = TieneAccesoHabilitado(u, usuariosPorId, suscripcionesPorTitular),
                SuscripcionNivel = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.NIVEL,
                SuscripcionEstado = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.ESTADO,
                CostoMensual = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.COSTO_MENSUAL,
                MaxSucursales = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.MAX_SUCURSALES,
                MaxAdmins = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.MAX_ADMIN,
                MaxUsuarios = ObtenerSuscripcion(u, usuariosPorId, suscripcionesPorTitular)?.MAX_USUARIOS,
                PinConfigurado = u.PIN_HASH != null && u.PIN_HASH != string.Empty
            })
            .ToList();

        return Ok(usuarios);
    }

    [HttpGet("{id:int}")]
    public IActionResult Obtener(int id)
    {
        var usuario = _context.Usuario.FirstOrDefault(u => u.ID_USUARIO == id);
        return usuario == null ? NotFound() : Ok(CrearDto(usuario));
    }

    [HttpPost]
    public IActionResult Crear([FromBody] CrearUsuarioRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            return BadRequest("Password requerido (mínimo 6 caracteres)");
        if (!Roles.Todos.Contains(request.Rol)) return BadRequest("Rol inválido");

        var nombreUsuario = request.Usuario.Trim();
        if (_context.Usuario.Any(u => u.NOMBRE_USUARIO == nombreUsuario)) return Conflict("El usuario ya existe");

        try
        {
            var responsableId = request.Rol == Roles.UsuarioComun ? UsuarioActualId() : null;
            var usuario = new Usuario(nombreUsuario, BCrypt.Net.BCrypt.HashPassword(request.Password), request.Rol, request.Mail, usuarioResponsableId: responsableId);
            if (!string.IsNullOrWhiteSpace(request.Pin)) usuario.SetPin(request.Pin);
            _context.Usuario.Add(usuario);
            _context.SaveChanges();
            if (request.Rol == Roles.Admin)
            {
                _context.Suscripcion.Add(Suscripcion.CrearBasica(usuario.ID_USUARIO));
                _context.SaveChanges();
            }
            return CreatedAtAction(nameof(Obtener), new { id = usuario.ID_USUARIO }, CrearDto(usuario));
        }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }
    }

    [HttpPut("{id:int}")]
    public IActionResult Editar(int id, [FromBody] EditarUsuarioRequestDto request)
    {
        var usuario = _context.Usuario.FirstOrDefault(u => u.ID_USUARIO == id);
        if (usuario == null) return NotFound();
        if (!Roles.Todos.Contains(request.Rol)) return BadRequest("Rol inválido");
        if (usuario.ACTIVO && EsRolGestion(usuario.ROL) && !EsRolGestion(request.Rol) && !HayOtroUsuarioGestionableActivo(id))
            return BadRequest("Debe permanecer al menos un Admin o SuperAdmin activo");
        if (_context.Usuario.Any(u => u.ID_USUARIO != id && u.NOMBRE_USUARIO == request.Usuario.Trim())) return Conflict("El usuario ya existe");

        try
        {
            usuario.CambiarNombreUsuario(request.Usuario.Trim());
            usuario.SetMail(request.Mail);
            usuario.CambiarRol(request.Rol);
            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                if (request.Password.Length < 6) return BadRequest("Password requerido (mínimo 6 caracteres)");
                usuario.SetPasswordHash(BCrypt.Net.BCrypt.HashPassword(request.Password));
            }
            if (!string.IsNullOrWhiteSpace(request.Pin)) usuario.SetPin(request.Pin);
            _context.SaveChanges();
            return Ok(CrearDto(usuario));
        }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }
    }

    [HttpPut("{id:int}/suscripcion")]
    public IActionResult CambiarSuscripcion(int id, [FromBody] CambiarSuscripcionRequest request)
    {
        var usuario = _context.Usuario.FirstOrDefault(u => u.ID_USUARIO == id);
        if (usuario == null)
        {
            return NotFound($"El usuario con ID {id} no existe");
        }

        if (usuario.ROL != Roles.Admin)
        {
            return BadRequest("La suscripción solo se gestiona sobre usuarios admin");
        }

        var suscripcion = _context.Suscripcion.FirstOrDefault(s => s.ID_USUARIO_TITULAR == usuario.ID_USUARIO);
        if (suscripcion == null)
        {
            suscripcion = Suscripcion.CrearBasica(usuario.ID_USUARIO);
            _context.Suscripcion.Add(suscripcion);
        }

        if (request.Activa)
        {
            suscripcion.Activar();
            usuario.ActivarSuscripcion();
        }
        else
        {
            suscripcion.Suspender();
            usuario.SuspenderSuscripcion();
        }

        _context.SaveChanges();

        return Ok(new
        {
            id = usuario.ID_USUARIO,
            suscripcionActiva = suscripcion.EstaActiva(),
            nivel = suscripcion.NIVEL
        });
    }

    [HttpDelete("{id:int}")]
    public IActionResult Desactivar(int id)
    {
        var usuario = _context.Usuario.FirstOrDefault(u => u.ID_USUARIO == id);
        if (usuario == null)
        {
            return NotFound($"El usuario con ID {id} no existe");
        }

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdValue, out var currentUserId) && currentUserId == usuario.ID_USUARIO)
        {
            return BadRequest("No podés darte de baja a vos mismo");
        }

        if (!usuario.ACTIVO)
        {
            return NoContent();
        }

        if (EsRolGestion(usuario.ROL) && !HayOtroUsuarioGestionableActivo(id))
        {
            return BadRequest("Debe permanecer al menos un Admin o SuperAdmin activo");
        }

        usuario.Desactivar();
        _context.SaveChanges();

        return NoContent();
    }

    private int? UsuarioActualId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private bool HayOtroUsuarioGestionableActivo(int id) => _context.Usuario.Any(u => u.ID_USUARIO != id && u.ACTIVO && EsRolGestion(u.ROL));
    private static bool EsRolGestion(string rol) => rol == Roles.Admin || rol == Roles.SuperAdmin;
    private static UsuarioDto CrearDto(Usuario usuario) => new()
    {
        Id = usuario.ID_USUARIO, NombreUsuario = usuario.NOMBRE_USUARIO, Mail = usuario.MAIL, Rol = usuario.ROL,
        UsuarioResponsableId = usuario.ID_USUARIO_RESP, Activo = usuario.ACTIVO, PinConfigurado = usuario.TienePin()
    };

    private static bool TieneAccesoHabilitado(
        Usuario usuario,
        Dictionary<int, Usuario> usuariosPorId,
        Dictionary<int, Suscripcion> suscripcionesPorTitular)
    {
        if (!usuario.ACTIVO)
        {
            return false;
        }

        return TieneSuscripcionActiva(usuario, usuariosPorId, suscripcionesPorTitular);
    }

    private static bool TieneSuscripcionActiva(
        Usuario usuario,
        Dictionary<int, Usuario> usuariosPorId,
        Dictionary<int, Suscripcion> suscripcionesPorTitular)
    {
        var titular = ObtenerTitular(usuario, usuariosPorId);

        if (titular == null)
        {
            return usuario.SUSCRIPCION_ACTIVA;
        }

        if (suscripcionesPorTitular.TryGetValue(titular.ID_USUARIO, out var suscripcion))
        {
            return suscripcion.EstaActiva();
        }

        return titular.SUSCRIPCION_ACTIVA;
    }

    private static Suscripcion? ObtenerSuscripcion(
        Usuario usuario,
        Dictionary<int, Usuario> usuariosPorId,
        Dictionary<int, Suscripcion> suscripcionesPorTitular)
    {
        var titular = ObtenerTitular(usuario, usuariosPorId);
        if (titular == null)
        {
            return null;
        }

        suscripcionesPorTitular.TryGetValue(titular.ID_USUARIO, out var suscripcion);
        return suscripcion;
    }

    private static Usuario? ObtenerTitular(
        Usuario usuario,
        Dictionary<int, Usuario> usuariosPorId)
    {
        return usuario.ID_USUARIO_RESPONSABLE.HasValue
            ? usuariosPorId.GetValueOrDefault(usuario.ID_USUARIO_RESPONSABLE.Value)
            : usuario;
    }
}

public record CambiarSuscripcionRequest(bool Activa);
