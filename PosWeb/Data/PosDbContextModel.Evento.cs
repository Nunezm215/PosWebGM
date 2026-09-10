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

    internal static void ConfigureCargoExtraEvento(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CargoExtraEvento>(entity =>
        {
            entity.ToTable("CARGO_EXTRA_EVENTO");

            entity.HasKey(c => c.ID_CARGO_EXTRA_EVENTO);

            entity.Property(c => c.ID_CARGO_EXTRA_EVENTO)
                .HasColumnName("ID_CARGO_EXTRA_EVENTO");

            entity.Property(c => c.ID_EVENTO)
                .HasColumnName("ID_EVENTO");

            entity.Property(c => c.DESCRIPCION)
                .HasColumnName("DESCRIPCION")
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(c => c.MONTO)
                .HasColumnName("MONTO")
                .HasColumnType("decimal(18,2)");

            entity.Property(c => c.FECHA_REGISTRO)
                .HasColumnName("FECHA_REGISTRO");

            entity.Property(c => c.ID_USUARIO_REGISTRA)
                .HasColumnName("ID_USUARIO_REGISTRA");

            entity.Property(c => c.ANULADO)
                .HasColumnName("ANULADO")
                .HasDefaultValue(false);

            entity.Property(c => c.FECHA_ANULACION)
                .HasColumnName("FECHA_ANULACION");

            entity.Property(c => c.ID_USUARIO_ANULA)
                .HasColumnName("ID_USUARIO_ANULA");

            entity.Property(c => c.MOTIVO_ANULACION)
                .HasColumnName("MOTIVO_ANULACION")
                .HasMaxLength(500);

            entity.HasIndex(c => c.ID_EVENTO);

            entity.HasOne<Evento>()
                .WithMany(e => e.CARGOS_EXTRA)
                .HasForeignKey(c => c.ID_EVENTO)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Usuario>()
                .WithMany()
                .HasForeignKey(c => c.ID_USUARIO_REGISTRA)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<Usuario>()
                .WithMany()
                .HasForeignKey(c => c.ID_USUARIO_ANULA)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    internal static void ConfigurePagoEvento(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PagoEvento>(entity =>
        {
            entity.ToTable("PAGO_EVENTO");
            entity.HasKey(p => p.ID_PAGO_EVENTO);
            entity.Property(p => p.ID_PAGO_EVENTO).HasColumnName("ID_PAGO_EVENTO");
            entity.Property(p => p.ID_EVENTO).HasColumnName("ID_EVENTO");
            entity.Property(p => p.ID_MEDIO_PAGO).HasColumnName("ID_MEDIO_PAGO");
            entity.Property(p => p.MONTO).HasColumnName("MONTO").HasColumnType("decimal(18,2)");
            entity.Property(p => p.FECHA_REGISTRO).HasColumnName("FECHA_REGISTRO");
            entity.Property(p => p.ID_USUARIO_REGISTRA).HasColumnName("ID_USUARIO_REGISTRA");
            entity.Property(p => p.ANULADO).HasColumnName("ANULADO").HasDefaultValue(false);
            entity.Property(p => p.FECHA_ANULACION).HasColumnName("FECHA_ANULACION");
            entity.Property(p => p.ID_USUARIO_ANULA).HasColumnName("ID_USUARIO_ANULA");
            entity.Property(p => p.MOTIVO_ANULACION).HasColumnName("MOTIVO_ANULACION").HasMaxLength(500);
            entity.Property(p => p.OBSERVACION).HasColumnName("OBSERVACION").HasMaxLength(500);
            entity.Property(p => p.CLAVE_IDEMPOTENCIA).HasColumnName("CLAVE_IDEMPOTENCIA").HasMaxLength(150);
            entity.Property(p => p.REFERENCIA_EXTERNA).HasColumnName("REFERENCIA_EXTERNA").HasMaxLength(200);

            entity.HasIndex(p => p.ID_EVENTO);
            entity.HasIndex(p => p.ID_MEDIO_PAGO);
            entity.HasIndex(p => p.FECHA_REGISTRO);
            entity.HasIndex(p => p.ID_USUARIO_REGISTRA);
            entity.HasIndex(p => p.ID_USUARIO_ANULA);
            entity.HasIndex(p => p.CLAVE_IDEMPOTENCIA).IsUnique();

            entity.HasOne<Evento>().WithMany(e => e.PAGOS).HasForeignKey(p => p.ID_EVENTO).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<MedioPago>().WithMany().HasForeignKey(p => p.ID_MEDIO_PAGO).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Usuario>().WithMany().HasForeignKey(p => p.ID_USUARIO_REGISTRA).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Usuario>().WithMany().HasForeignKey(p => p.ID_USUARIO_ANULA).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
