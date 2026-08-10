using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations
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
                    ID_EVENTO = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ID_CLIENTE = table.Column<int>(type: "int", nullable: false),
                    ID_USUARIO_CREADOR = table.Column<int>(type: "int", nullable: false),
                    ID_SUCURSAL = table.Column<int>(type: "int", nullable: false),
                    FECHA = table.Column<DateOnly>(type: "date", nullable: false),
                    HORA_INICIO = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    HORA_FIN = table.Column<TimeOnly>(type: "time(6)", nullable: false),
                    TIPO_EVENTO = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CANTIDAD_INVITADOS = table.Column<int>(type: "int", nullable: false),
                    MONTO_TOTAL = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    OBSERVACIONES = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ESTADO = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "Reservado")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FECHA_CREACION = table.Column<DateTime>(type: "datetime(6)", nullable: false)
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
                })
                .Annotation("MySql:CharSet", "utf8mb4");

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
