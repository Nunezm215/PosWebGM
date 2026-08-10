using Microsoft.EntityFrameworkCore;
using PosWeb.Domain;

namespace PosWeb.Data;

public partial class PosDbContext
{
    internal static void ConfigureEvento(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Evento>(entity =>
        {
            entity.ToTable("EVENTO");

            entity.HasKey(e => e.ID_EVENTO);

            entity.Property(e => e.ID_EVENTO)
                .HasColumnName("ID_EVENTO");

            entity.Property(e => e.ID_CLIENTE)
                .HasColumnName("ID_CLIENTE");

            entity.Property(e => e.ID_USUARIO_CREADOR)
                .HasColumnName("ID_USUARIO_CREADOR");

            entity.Property(e => e.ID_SUCURSAL)
                .HasColumnName("ID_SUCURSAL");

            entity.Property(e => e.FECHA)
                .HasColumnName("FECHA");

            entity.Property(e => e.HORA_INICIO)
                .HasColumnName("HORA_INICIO");

            entity.Property(e => e.HORA_FIN)
                .HasColumnName("HORA_FIN");

            entity.Property(e => e.TIPO_EVENTO)
                .HasColumnName("TIPO_EVENTO")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(e => e.CANTIDAD_INVITADOS)
                .HasColumnName("CANTIDAD_INVITADOS");

            entity.Property(e => e.MONTO_TOTAL)
                .HasColumnName("MONTO_TOTAL")
                .HasColumnType("decimal(18,2)");

            entity.Property(e => e.OBSERVACIONES)
                .HasColumnName("OBSERVACIONES")
                .HasMaxLength(500);

            entity.Property(e => e.ESTADO)
                .HasColumnName("ESTADO")
                .HasMaxLength(20)
                .IsRequired()
                .HasDefaultValue(EventoEstados.Reservado);

            entity.Property(e => e.FECHA_CREACION)
                .HasColumnName("FECHA_CREACION");

            entity.HasIndex(e => new { e.ID_SUCURSAL, e.FECHA });
            entity.HasIndex(e => e.ID_CLIENTE);
            entity.HasIndex(e => e.ID_USUARIO_CREADOR);

            entity.HasOne(e => e.Cliente)
                .WithMany()
                .HasForeignKey(e => e.ID_CLIENTE)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.UsuarioCreador)
                .WithMany()
                .HasForeignKey(e => e.ID_USUARIO_CREADOR)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Sucursal)
                .WithMany()
                .HasForeignKey(e => e.ID_SUCURSAL)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
