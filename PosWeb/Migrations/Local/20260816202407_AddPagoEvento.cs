using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PosWeb.Migrations.Local
{
    /// <inheritdoc />
    public partial class AddPagoEvento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PAGO_EVENTO",
                columns: table => new
                {
                    ID_PAGO_EVENTO = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ID_EVENTO = table.Column<int>(type: "INTEGER", nullable: false),
                    ID_MEDIO_PAGO = table.Column<int>(type: "INTEGER", nullable: false),
                    MONTO = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    FECHA_REGISTRO = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ID_USUARIO_REGISTRA = table.Column<int>(type: "INTEGER", nullable: false),
                    ANULADO = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    FECHA_ANULACION = table.Column<DateTime>(type: "TEXT", nullable: true),
                    ID_USUARIO_ANULA = table.Column<int>(type: "INTEGER", nullable: true),
                    MOTIVO_ANULACION = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    OBSERVACION = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CLAVE_IDEMPOTENCIA = table.Column<string>(type: "TEXT", maxLength: 150, nullable: true),
                    REFERENCIA_EXTERNA = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PAGO_EVENTO", x => x.ID_PAGO_EVENTO);
                    table.ForeignKey(
                        name: "FK_PAGO_EVENTO_EVENTO_ID_EVENTO",
                        column: x => x.ID_EVENTO,
                        principalTable: "EVENTO",
                        principalColumn: "ID_EVENTO",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PAGO_EVENTO_MEDIO_PAGO_ID_MEDIO_PAGO",
                        column: x => x.ID_MEDIO_PAGO,
                        principalTable: "MEDIO_PAGO",
                        principalColumn: "ID_MEDIO_PAGO",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PAGO_EVENTO_USUARIO_ID_USUARIO_ANULA",
                        column: x => x.ID_USUARIO_ANULA,
                        principalTable: "USUARIO",
                        principalColumn: "ID_USUARIO",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PAGO_EVENTO_USUARIO_ID_USUARIO_REGISTRA",
                        column: x => x.ID_USUARIO_REGISTRA,
                        principalTable: "USUARIO",
                        principalColumn: "ID_USUARIO",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_CLAVE_IDEMPOTENCIA",
                table: "PAGO_EVENTO",
                column: "CLAVE_IDEMPOTENCIA",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_FECHA_REGISTRO",
                table: "PAGO_EVENTO",
                column: "FECHA_REGISTRO");

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_ID_EVENTO",
                table: "PAGO_EVENTO",
                column: "ID_EVENTO");

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_ID_MEDIO_PAGO",
                table: "PAGO_EVENTO",
                column: "ID_MEDIO_PAGO");

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_ID_USUARIO_ANULA",
                table: "PAGO_EVENTO",
                column: "ID_USUARIO_ANULA");

            migrationBuilder.CreateIndex(
                name: "IX_PAGO_EVENTO_ID_USUARIO_REGISTRA",
                table: "PAGO_EVENTO",
                column: "ID_USUARIO_REGISTRA");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PAGO_EVENTO");
        }
    }
}
