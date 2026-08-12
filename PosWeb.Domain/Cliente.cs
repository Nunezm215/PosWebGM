using PosWeb.Domain.Exceptions;
using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class Cliente
{
    [Key]
    public int ID_CLIENTE { get; private set; }

    public string NOMBRE { get; private set; } = null!;

    public DateOnly? FECHA_NACIMIENTO { get; private set; }

    public string TIPO_DOCUMENTO { get; private set; } = null!;

    public string? NRO_DOCUMENTO { get; private set; }

    public string? COD_CLIENTE { get; private set; }

    public string? TELEFONO { get; private set; }

    public string? DOMICILIO { get; private set; }

    public string? MAIL { get; private set; }

    public string IVA_CONDICION { get; private set; } = "ConsumidorFinal";

    public bool ACTIVO { get; private set; }

    private static readonly string[] TiposDocumentoValidos = { "DNI", "CUIT", "CUIL", "ConsumidorFinal" };

    public Cliente(string nombre, string tipoDocumento, string? nroDocumento,
                   DateOnly? fechaNacimiento = null,
                   string? codCliente = null, string? telefono = null, string? domicilio = null, string? mail = null,
                   string? ivaCondicion = null)
    {
        CambiarNombre(nombre);
        CambiarFechaNacimiento(fechaNacimiento);
        CambiarTipoDocumento(tipoDocumento, nroDocumento);
        COD_CLIENTE = codCliente;
        CambiarTelefono(telefono);
        CambiarDomicilio(domicilio);
        SetMail(mail);
        SetIvaCondicion(ivaCondicion);
        ACTIVO = true;
    }

    protected Cliente()
    {
    }

    public void CambiarNombre(string nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre) || nombre.Length > 200)
        {
            throw new ArgumentException("El nombre es requerido y debe tener hasta 200 caracteres");
        }

        NOMBRE = nombre.Trim();
    }

    public void CambiarFechaNacimiento(DateOnly? fechaNacimiento)
    {
        if (fechaNacimiento.HasValue && fechaNacimiento.Value > DateOnly.FromDateTime(DateTime.Today))
        {
            throw new ArgumentException("La fecha de nacimiento no puede ser futura");
        }

        FECHA_NACIMIENTO = fechaNacimiento;
    }

    public void CambiarTipoDocumento(string? tipoDocumento, string? numeroDocumento)
    {
        var tipoNormalizado = string.IsNullOrWhiteSpace(tipoDocumento) ? "ConsumidorFinal" : tipoDocumento.Trim();

        if (!TiposDocumentoValidos.Contains(tipoNormalizado))
        {
            throw new DocumentoInvalidoException(tipoNormalizado, "Tipo de documento inválido");
        }

        var numeroNormalizado = string.IsNullOrWhiteSpace(numeroDocumento) ? null : numeroDocumento.Trim();

        if (numeroNormalizado == null)
        {
            TIPO_DOCUMENTO = tipoNormalizado;
            NRO_DOCUMENTO = null;
            return;
        }

        if (tipoNormalizado == "ConsumidorFinal")
        {
            TIPO_DOCUMENTO = tipoNormalizado;
            NRO_DOCUMENTO = numeroNormalizado;
            return;
        }

        if (tipoNormalizado == "CUIT" && numeroNormalizado.Length != 11)
        {
            throw new DocumentoInvalidoException(tipoNormalizado, "CUIT debe tener 11 dígitos");
        }

        if (tipoNormalizado == "CUIL" && numeroNormalizado.Length != 11)
        {
            throw new DocumentoInvalidoException(tipoNormalizado, "CUIL debe tener 11 dígitos");
        }

        if (tipoNormalizado == "DNI" && (numeroNormalizado.Length < 7 || numeroNormalizado.Length > 8))
        {
            throw new DocumentoInvalidoException(tipoNormalizado, "DNI debe tener entre 7 y 8 dígitos");
        }

        if (!numeroNormalizado.All(char.IsDigit))
        {
            throw new DocumentoInvalidoException(tipoNormalizado, "El número de documento debe ser numérico");
        }

        TIPO_DOCUMENTO = tipoNormalizado;
        NRO_DOCUMENTO = numeroNormalizado;
    }

    public void CambiarCodCliente(string? codCliente)
    {
        COD_CLIENTE = string.IsNullOrWhiteSpace(codCliente) ? null : codCliente.Trim();
    }

    public void SetIvaCondicion(string? ivaCondicion)
    {
        IVA_CONDICION = !string.IsNullOrWhiteSpace(ivaCondicion)
            ? ivaCondicion.Trim()
            : "ConsumidorFinal";
    }

    public void SetMail(string? mail)
    {
        if (string.IsNullOrWhiteSpace(mail))
        {
            throw new ArgumentException("El mail es requerido");
        }

        try
        {
            _ = new System.Net.Mail.MailAddress(mail);
        }
        catch
        {
            throw new ArgumentException("Mail inválido");
        }

        MAIL = mail.Trim();
    }

    public void CambiarTelefono(string? telefono)
    {
        if (string.IsNullOrWhiteSpace(telefono))
        {
            throw new ArgumentException("El teléfono es requerido");
        }

        TELEFONO = telefono.Trim();
    }

    public void CambiarDomicilio(string? domicilio)
    {
        DOMICILIO = string.IsNullOrWhiteSpace(domicilio) ? null : domicilio.Trim();
    }

    public void Activar()
    {
        ACTIVO = true;
    }

    public void Desactivar()
    {
        ACTIVO = false;
    }
}
