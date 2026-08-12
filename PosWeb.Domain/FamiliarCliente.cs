using System.ComponentModel.DataAnnotations;

namespace PosWeb.Domain;

public class FamiliarCliente
{
    [Key]
    public int ID_FAMILIAR_CLIENTE { get; private set; }

    public int ID_CLIENTE { get; private set; }

    public string NOMBRE { get; private set; } = null!;

    public DateOnly FECHA_NACIMIENTO { get; private set; }

    private FamiliarCliente()
    {
    }

    public FamiliarCliente(int clienteId, string nombre, DateOnly fechaNacimiento)
    {
        ID_CLIENTE = clienteId;
        CambiarNombre(nombre);
        CambiarFechaNacimiento(fechaNacimiento);
    }

    public void CambiarNombre(string nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre) || nombre.Length > 200)
        {
            throw new ArgumentException("El nombre del familiar es requerido y debe tener hasta 200 caracteres");
        }

        NOMBRE = nombre.Trim();
    }

    public void CambiarFechaNacimiento(DateOnly fechaNacimiento)
    {
        if (fechaNacimiento > DateOnly.FromDateTime(DateTime.Today))
        {
            throw new ArgumentException("La fecha de nacimiento del familiar no puede ser futura");
        }

        FECHA_NACIMIENTO = fechaNacimiento;
    }
}
