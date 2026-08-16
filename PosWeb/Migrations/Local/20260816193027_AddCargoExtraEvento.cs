using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
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
                    ID_CARGO_EXTRA_EVENTO = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ID_EVENTO = table.Column<int>(type: "INTEGER", nullable: false),
                    DESCRIPCION = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    MONTO = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FECHA_REGISTRO = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ID_USUARIO_REGISTRA = table.Column<int>(type: "INTEGER", nullable: false),
                    ANULADO = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    FECHA_ANULACION = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ID_USUARIO_ANULA = table.Column<int>(type: "INTEGER", nullable: true),
                    MOTIVO_ANULACION = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
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
                });

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
