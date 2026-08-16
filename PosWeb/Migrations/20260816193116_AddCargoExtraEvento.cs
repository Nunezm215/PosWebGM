using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations
{
    /// <inheritdoc />
    public partial class AddCargoExtraEvento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CARGO_EXTRA_EVENTO",
                columns: table => new
                {
                    ID_CARGO_EXTRA_EVENTO = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ID_EVENTO = table.Column<int>(type: "int", nullable: false),
                    DESCRIPCION = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MONTO = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FECHA_REGISTRO = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ID_USUARIO_REGISTRA = table.Column<int>(type: "int", nullable: false),
                    ANULADO = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    FECHA_ANULACION = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ID_USUARIO_ANULA = table.Column<int>(type: "int", nullable: true),
                    MOTIVO_ANULACION = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CARGO_EXTRA_EVENTO", x => x.ID_CARGO_EXTRA_EVENTO);
                    table.ForeignKey(
                        name: "FK_CARGO_EXTRA_EVENTO_EVENTO_ID_EVENTO",
                        column: x => x.ID_EVENTO,
                        principalTable: "EVENTO",
                        principalColumn: "ID_EVENTO",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CARGO_EXTRA_EVENTO_USUARIO_ID_USUARIO_ANULA",
                        column: x => x.ID_USUARIO_ANULA,
                        principalTable: "USUARIO",
                        principalColumn: "ID_USUARIO",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CARGO_EXTRA_EVENTO_USUARIO_ID_USUARIO_REGISTRA",
                        column: x => x.ID_USUARIO_REGISTRA,
                        principalTable: "USUARIO",
                        principalColumn: "ID_USUARIO",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_CARGO_EXTRA_EVENTO_ID_EVENTO",
                table: "CARGO_EXTRA_EVENTO",
                column: "ID_EVENTO");

            migrationBuilder.CreateIndex(
                name: "IX_CARGO_EXTRA_EVENTO_ID_USUARIO_ANULA",
                table: "CARGO_EXTRA_EVENTO",
                column: "ID_USUARIO_ANULA");

            migrationBuilder.CreateIndex(
                name: "IX_CARGO_EXTRA_EVENTO_ID_USUARIO_REGISTRA",
                table: "CARGO_EXTRA_EVENTO",
                column: "ID_USUARIO_REGISTRA");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CARGO_EXTRA_EVENTO");
        }
    }
}
