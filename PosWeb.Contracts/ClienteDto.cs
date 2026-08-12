namespace PosWeb.Contracts;

public class ClienteDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public DateOnly? FechaNacimiento { get; set; }
    public string TipoDocumento { get; set; } = "DNI";
    public string? NumeroDocumento { get; set; }
    public string IvaCondicion { get; set; } = "ConsumidorFinal";
    public string? Telefono { get; set; }
    public string? Domicilio { get; set; }
    public string? CodCliente { get; set; }
    public string? Mail { get; set; }
    public List<FamiliarClienteDto> Familiares { get; set; } = new();
    public bool Activo { get; set; } = true;
}
