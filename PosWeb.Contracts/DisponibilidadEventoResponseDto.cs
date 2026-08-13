namespace PosWeb.Contracts;

public class DisponibilidadEventoResponseDto
{
    public bool Disponible { get; set; }
    public TimeOnly? ProximaHoraDisponible { get; set; }
}
