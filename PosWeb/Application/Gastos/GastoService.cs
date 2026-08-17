using System.Globalization;
using Microsoft.EntityFrameworkCore;
using PosWeb.Application.Exceptions;
using PosWeb.Contracts;
using PosWeb.Data;
using PosWeb.Domain;
using PosWeb.Application.Eventos;

namespace PosWeb.Application.Gastos;

public class GastoService
{
    private readonly PosDbContextLocal _context;
    private readonly TimeProvider _timeProvider;

    public GastoService(PosDbContextLocal context, TimeProvider? timeProvider = null)
    {
        _context = context;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public GastoDto CrearSimple(decimal monto, string detalle, int userId)
    {
        if (monto <= 0) throw new ArgumentException("El monto debe ser positivo", nameof(monto));
        if (string.IsNullOrWhiteSpace(detalle) || detalle.Trim().Length > 200) throw new ArgumentException("El detalle es requerido y no puede superar los 200 caracteres", nameof(detalle));
        var sucursales = _context.Sucursal.Where(s => s.ACTIVO).ToList();
        if (sucursales.Count != 1) throw new InvalidOperationException("Se esperaba una única sucursal activa.");
        var gasto = Gasto.CrearSimple(sucursales[0].ID_SUCURSAL, monto, detalle, userId, _timeProvider.GetUtcNow().UtcDateTime);
        _context.Gasto.Add(gasto); _context.SaveChanges();
        return MapToDto(gasto, GetUsuarioNombre(userId));
    }

    public GastoDto Crear(decimal monto, string detalle, int userId, string? fuentePago = null, decimal? montoPagadoCaja = null)
    {
        if (monto <= 0)
            throw new ArgumentException("El monto debe ser positivo", nameof(monto));

        if (string.IsNullOrWhiteSpace(detalle))
            throw new ArgumentException("El detalle es requerido", nameof(detalle));

        if (detalle.Length > 500)
            throw new ArgumentException("El detalle no puede superar los 500 caracteres", nameof(detalle));

        bool esAhorro = string.Equals(fuentePago, "ahorro", StringComparison.OrdinalIgnoreCase);
        bool esDividir = string.Equals(fuentePago, "dividir", StringComparison.OrdinalIgnoreCase);

        // Find active caja for this user (required for "caja" and "dividir")
        Caja? cajaActiva = null;
        if (!esAhorro)
        {
            cajaActiva = _context.Caja
                .FirstOrDefault(c => c.ID_USUARIO_APERTURA == userId && c.ESTADO == "Abierta");

            if (cajaActiva == null)
                throw new GastoSinCajaActivaException();
        }

        if (esDividir && cajaActiva != null)
        {
            // Split: create Gasto for caja portion + Gasto for ahorro portion
            decimal montoCaja = montoPagadoCaja ?? 0;
            decimal montoAhorro = monto - montoCaja;

            if (montoCaja > 0)
            {
                var gastoCaja = new Gasto(cajaActiva.ID_CAJA, montoCaja, $"{detalle} (Caja)", userId);
                _context.Gasto.Add(gastoCaja);
            }
            if (montoAhorro > 0)
            {
                var gastoAhorro = new Gasto(null, montoAhorro, $"{detalle} (Ahorro)", userId);
                _context.Gasto.Add(gastoAhorro);
            }
            _context.SaveChanges();
            return new GastoDto { Id = 0, CajaId = cajaActiva.ID_CAJA, Monto = monto, Detalle = detalle, Fecha = DateTime.Now };
        }

        int? idCaja = esAhorro ? null : cajaActiva?.ID_CAJA;
        var gasto = new Gasto(idCaja, monto, detalle, userId);
        _context.Gasto.Add(gasto);
        _context.SaveChanges();

        return MapToDto(gasto, GetUsuarioNombre(userId));
    }

    public List<GastoDto> ObtenerPorCaja(int cajaId)
    {
        var gastos = _context.Gasto
            .Where(g => g.ID_CAJA == cajaId)
            .OrderByDescending(g => g.FECHA_GASTO)
            .ToList();

        var usuarioIds = gastos.Select(g => g.ID_USUARIO).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var usuarios = _context.Usuario
            .Where(u => usuarioIds.Contains(u.ID_USUARIO))
            .ToDictionary(u => u.ID_USUARIO, u => u.NOMBRE_USUARIO);

        return gastos.Select(g => MapToDto(g, g.ID_USUARIO.HasValue && usuarios.TryGetValue(g.ID_USUARIO.Value, out var nombre) ? nombre : "")).ToList();
    }

    public List<GastoDto> ObtenerHistorial(
        int? excluirCajaId = null,
        DateTime? fechaDesde = null,
        DateTime? fechaHasta = null,
        string? texto = null,
        string? estado = null,
        string? q = null)
    {
        IQueryable<Gasto> query = _context.Gasto.AsNoTracking();

        if (excluirCajaId.HasValue)
            query = query.Where(g => g.ID_CAJA != excluirCajaId.Value);

        if (fechaDesde.HasValue)
        {
            var desde = fechaDesde.Value.Date;
            query = query.Where(g => g.FECHA_GASTO >= desde);
        }

        if (fechaHasta.HasValue)
        {
            var hasta = fechaHasta.Value.Date.AddDays(1);
            query = query.Where(g => g.FECHA_GASTO < hasta);
        }

        var estadoNormalizado = estado?.Trim().ToLowerInvariant();
        if (estadoNormalizado == "activos")
        {
            query = query.Where(g => !g.ANULADO);
        }
        else if (estadoNormalizado == "anulados")
        {
            query = query.Where(g => g.ANULADO);
        }

        var gastos = query
            .OrderByDescending(g => g.FECHA_GASTO)
            .ThenByDescending(g => g.ID_GASTO)
            .ToList();

        var usuarioIds = gastos.Select(g => g.ID_USUARIO).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var usuarios = _context.Usuario
            .Where(u => usuarioIds.Contains(u.ID_USUARIO))
            .ToDictionary(u => u.ID_USUARIO, u => u.NOMBRE_USUARIO);

        var resultados = gastos
            .Select(g => MapToDto(g, g.ID_USUARIO.HasValue && usuarios.TryGetValue(g.ID_USUARIO.Value, out var nombre) ? nombre : ""))
            .ToList();

        var busqueda = string.IsNullOrWhiteSpace(q) ? texto : q;
        if (!string.IsNullOrWhiteSpace(busqueda))
        {
            resultados = resultados.Where(g => CoincideBusquedaGlobal(g, busqueda)).ToList();
        }

        return resultados;
    }

    public void Anular(int gastoId)
    {
        Gasto? gasto = _context.Gasto.Find(gastoId);
        if (gasto == null)
            throw new ArgumentException("Gasto no encontrado");

        gasto.Anular();
        _context.SaveChanges();
    }

    public void Anular(int gastoId, int usuarioId, string motivo)
    {
        var gasto = _context.Gasto.Find(gastoId) ?? throw new ArgumentException("Gasto no encontrado");
        if (string.IsNullOrWhiteSpace(motivo) || motivo.Trim().Length > 500) throw new ArgumentException("El motivo de anulación es requerido y no puede superar los 500 caracteres");
        if (FechaContableArgentina.DesdeUtc(gasto.FECHA_GASTO) != FechaContableArgentina.Actual(_timeProvider)) throw new InvalidOperationException("El gasto solo puede anularse el mismo día en que fue registrado.");
        gasto.Anular(usuarioId, motivo.Trim(), _timeProvider.GetUtcNow().UtcDateTime); _context.SaveChanges();
    }

    private static GastoDto MapToDto(Gasto gasto, string usuarioNombre = "")
    {
        return new GastoDto
        {
            Id = gasto.ID_GASTO,
            CajaId = gasto.ID_CAJA,
            Monto = gasto.MONTO,
            Detalle = gasto.DETALLE,
            Fecha = gasto.FECHA_GASTO,
            Anulado = gasto.ANULADO,
            UsuarioNombre = usuarioNombre,
        };
    }

    private string GetUsuarioNombre(int userId)
    {
        return _context.Usuario
            .Where(u => u.ID_USUARIO == userId)
            .Select(u => u.NOMBRE_USUARIO)
            .FirstOrDefault() ?? "";
    }

    private static bool CoincideBusquedaGlobal(GastoDto gasto, string q)
    {
        var consulta = q.Trim();
        if (consulta.Length == 0)
        {
            return true;
        }

        var consultaLower = consulta.ToLowerInvariant();

        if (gasto.Detalle.Contains(consulta, StringComparison.OrdinalIgnoreCase))
            return true;

        if (!string.IsNullOrWhiteSpace(gasto.UsuarioNombre) && gasto.UsuarioNombre.Contains(consulta, StringComparison.OrdinalIgnoreCase))
            return true;

        if (EsEstadoSolicitado(consultaLower, gasto.Anulado))
            return true;

        if (TryParseMonto(consulta, out var monto) && gasto.Monto == monto)
            return true;

        if (TryParseFechaExacta(consulta, out var fechaExacta) && DateOnly.FromDateTime(gasto.Fecha).Equals(fechaExacta))
            return true;

        if (TryParseDiaMes(consulta, out var dia, out var mes))
        {
            var fecha = DateOnly.FromDateTime(gasto.Fecha);
            if (fecha.Day == dia && fecha.Month == mes)
                return true;
        }

        var fechaTexto = gasto.Fecha.ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("es-AR"));
        if (fechaTexto.Contains(consulta, StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static bool EsEstadoSolicitado(string consultaLower, bool anulado)
    {
        return (consultaLower is "activo" or "activos") && !anulado
            || (consultaLower is "anulado" or "anulados") && anulado;
    }

    private static bool TryParseMonto(string consulta, out decimal monto)
    {
        var cultura = CultureInfo.GetCultureInfo("es-AR");
        return decimal.TryParse(consulta, NumberStyles.Number, cultura, out monto);
    }

    private static bool TryParseFechaExacta(string consulta, out DateOnly fecha)
    {
        var cultura = CultureInfo.GetCultureInfo("es-AR");
        var formatos = new[] { "dd/MM/yyyy", "d/M/yyyy", "dd/MM/yy", "d/M/yy" };
        if (DateOnly.TryParseExact(consulta, formatos, cultura, DateTimeStyles.None, out fecha))
            return true;

        fecha = default;
        return false;
    }

    private static bool TryParseDiaMes(string consulta, out int dia, out int mes)
    {
        var cultura = CultureInfo.GetCultureInfo("es-AR");
        if (DateOnly.TryParseExact(consulta, new[] { "dd/MM", "d/M" }, cultura, DateTimeStyles.None, out var fecha))
        {
            dia = fecha.Day;
            mes = fecha.Month;
            return true;
        }

        dia = 0;
        mes = 0;
        return false;
    }
}
