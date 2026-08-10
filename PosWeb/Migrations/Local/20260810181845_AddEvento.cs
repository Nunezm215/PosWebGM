using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddEvento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EVENTO",
                columns: table => new
                {
                    ID_EVENTO = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ID_CLIENTE = table.Column<int>(type: "INTEGER", nullable: false),
                    ID_USUARIO_CREADOR = table.Column<int>(type: "INTEGER", nullable: false),
                    ID_SUCURSAL = table.Column<int>(type: "INTEGER", nullable: false),
                    FECHA = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    HORA_INICIO = table.Column<TimeOnly>(type: "TEXT", nullable: false),
                    HORA_FIN = table.Column<TimeOnly>(type: "TEXT", nullable: false),
                    TIPO_EVENTO = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    CANTIDAD_INVITADOS = table.Column<int>(type: "INTEGER", nullable: false),
                    MONTO_TOTAL = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OBSERVACIONES = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ESTADO = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false, defaultValue: "Reservado"),
                    FECHA_CREACION = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EVENTO", x => x.ID_EVENTO);
                    table.ForeignKey(
                        name: "FK_EVENTO_CLIENTE_ID_CLIENTE",
                        column: x => x.ID_CLIENTE,
                        principalTable: "CLIENTE",
                        principalColumn: "ID_CLIENTE",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EVENTO_SUCURSAL_ID_SUCURSAL",
                        column: x => x.ID_SUCURSAL,
                        principalTable: "SUCURSAL",
                        principalColumn: "ID_SUCURSAL",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EVENTO_USUARIO_ID_USUARIO_CREADOR",
                        column: x => x.ID_USUARIO_CREADOR,
                        principalTable: "USUARIO",
                        principalColumn: "ID_USUARIO",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EVENTO_ID_CLIENTE",
                table: "EVENTO",
                column: "ID_CLIENTE");

            migrationBuilder.CreateIndex(
                name: "IX_EVENTO_ID_SUCURSAL_FECHA",
                table: "EVENTO",
                columns: new[] { "ID_SUCURSAL", "FECHA" });

            migrationBuilder.CreateIndex(
                name: "IX_EVENTO_ID_USUARIO_CREADOR",
                table: "EVENTO",
                column: "ID_USUARIO_CREADOR");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EVENTO");
        }
    }
}
