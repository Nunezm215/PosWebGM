using Microsoft.Data.Sqlite;

const string confirmation = "RESET-POSWEB-DELIVERY";
var options = ParseArguments(args);

if (options.ContainsKey("inspect"))
{
    var database = Required(options, "database");
    Inspect(database);
    return;
}

var databasePath = Required(options, "database");
var backupPath = Required(options, "backup");
var companyId = ParseId(options, "company-id");
var branchId = ParseId(options, "sucursal-id");
var subscriptionId = ParseId(options, "suscripcion-id");

if (Required(options, "confirm") != confirmation)
    throw new InvalidOperationException($"Se requiere --confirm {confirmation}.");
if (!options.ContainsKey("service-stopped"))
    throw new InvalidOperationException("Detené posweb.service y confirmalo con --service-stopped antes de ejecutar el reseteo.");
if (!File.Exists(databasePath))
    throw new FileNotFoundException("No se encontró la base de datos indicada.", databasePath);
if (File.Exists(backupPath))
    throw new InvalidOperationException("El archivo de backup ya existe. Nunca se sobrescribe un backup.");
if (Path.GetFullPath(databasePath) == Path.GetFullPath(backupPath))
    throw new InvalidOperationException("El backup no puede apuntar a la misma base de datos.");

Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(backupPath))!);
Console.WriteLine("Validando la base de datos de origen...");
using (var source = Open(databasePath, SqliteOpenMode.ReadOnly))
{
    AssertIntegrity(source);
    ValidateCanonicalOrganization(source, companyId, branchId, subscriptionId);
    Console.WriteLine("Creando backup SQLite consistente...");
    using var backup = Open(backupPath, SqliteOpenMode.ReadWriteCreate);
    source.BackupDatabase(backup);
}

using (var backup = Open(backupPath, SqliteOpenMode.ReadOnly))
    AssertIntegrity(backup);
Console.WriteLine($"Backup verificado: {backupPath}");

using var connection = Open(databasePath, SqliteOpenMode.ReadWrite);
Execute(connection, null, "PRAGMA foreign_keys = ON;");
Execute(connection, null, "PRAGMA busy_timeout = 5000;");
AssertIntegrity(connection);

var passwordHash = BCrypt.Net.BCrypt.HashPassword("0000");
using var transaction = connection.BeginTransaction();
try
{
    ValidateCanonicalOrganization(connection, companyId, branchId, subscriptionId, transaction);
    DeleteOperationalData(connection, transaction);
    NormalizeOrganization(connection, transaction, companyId, branchId, subscriptionId, passwordHash);
    ResetRequiredSeeds(connection, transaction);
    VerifyReset(connection, transaction, companyId, branchId, subscriptionId, passwordHash);
    transaction.Commit();
}
catch
{
    transaction.Rollback();
    throw;
}

AssertIntegrity(connection);
Console.WriteLine("Reseteo completado y verificado. El backup no fue modificado.");

static void Inspect(string databasePath)
{
    if (!File.Exists(databasePath)) throw new FileNotFoundException("No se encontró la base de datos indicada.", databasePath);
    using var connection = Open(databasePath, SqliteOpenMode.ReadOnly);
    AssertIntegrity(connection);
    using var command = connection.CreateCommand();
    command.CommandText = """
        SELECT e.ID_EMPRESA, e.NOMBRE, s.ID_SUCURSAL, s.COD_SUCURSAL, s.DESC_SUCURSAL,
               sub.ID_SUSCRIPCION, sub.ESTADO, u.ID_USUARIO, u.NOMBRE_USUARIO
        FROM EMPRESA e
        JOIN SUCURSAL s ON s.ID_EMPRESA = e.ID_EMPRESA
        JOIN SUSCRIPCION sub ON sub.ID_SUSCRIPCION = e.ID_SUSCRIPCION
        LEFT JOIN USUARIO u ON u.ID_USUARIO = sub.ID_USUARIO_TITULAR
        ORDER BY e.ID_EMPRESA, s.ID_SUCURSAL;
        """;
    using var reader = command.ExecuteReader();
    Console.WriteLine("Empresa | Sucursal | Suscripción | Titular");
    while (reader.Read())
        Console.WriteLine($"{reader.GetInt32(0)}:{reader.GetString(1)} | {reader.GetInt32(2)}:{reader.GetString(3)} - {reader.GetString(4)} | {reader.GetInt32(5)}:{reader.GetString(6)} | {(reader.IsDBNull(7) ? "sin titular" : $"{reader.GetInt32(7)}:{reader.GetString(8)}")}");
}

static void DeleteOperationalData(SqliteConnection connection, SqliteTransaction transaction)
{
    var tables = new[]
    {
        "OPORTUNIDAD_CUMPLEANIOS_ATENDIDA", "PAGO_EVENTO", "CARGO_EXTRA_EVENTO", "EVENTO", "FAMILIAR_CLIENTE",
        "PAGO_DEUDA", "DEUDA", "PAGO", "RENGLON_VENTA", "VENTA", "RENGLON_COMPRA", "COMPRA",
        "RENGLON_PEDIDO", "PEDIDO", "GASTO", "CAJA", "STOCK_SUCURSAL", "OFERTA", "COMBO_ITEM",
        "COMBO", "PRODUCTO", "CLIENTE", "PROVEEDOR", "CATEGORIA", "CATEGORIA_GASTO"
    };

    foreach (var table in tables)
    {
        Execute(connection, transaction, $"DELETE FROM {table};");
        Console.WriteLine($"Vaciada {table}.");
    }
}

static void NormalizeOrganization(SqliteConnection connection, SqliteTransaction transaction, int companyId, int branchId, int subscriptionId, string passwordHash)
{
    Execute(connection, transaction, "UPDATE USUARIO SET ID_USUARIO_RESP = NULL, ID_USUARIO_RESPONSABLE = NULL, ID_EMPRESA = NULL, ID_SUCURSAL_DEFAULT = NULL;");
    Execute(connection, transaction, "DELETE FROM SUCURSAL WHERE ID_SUCURSAL <> $branchId;", ("$branchId", branchId));
    Execute(connection, transaction, "DELETE FROM EMPRESA WHERE ID_EMPRESA <> $companyId;", ("$companyId", companyId));
    Execute(connection, transaction, "DELETE FROM SUSCRIPCION WHERE ID_SUSCRIPCION <> $subscriptionId;", ("$subscriptionId", subscriptionId));

    var finalUserId = ScalarInt(connection, transaction, "SELECT ID_USUARIO FROM USUARIO WHERE NOMBRE_USUARIO = 'administrador' LIMIT 1;");
    if (finalUserId is null)
    {
        Execute(connection, transaction, """
            INSERT INTO USUARIO (NOMBRE_USUARIO, PASSWORD_HASH, PIN_HASH, MAIL, ROL, ACTIVO, SUSCRIPCION_ACTIVA, ID_SUCURSAL_DEFAULT, ID_USUARIO_RESP, ID_EMPRESA, ID_USUARIO_RESPONSABLE)
            VALUES ('administrador', $passwordHash, NULL, NULL, 'Admin', 1, 1, NULL, NULL, NULL, NULL);
            """, ("$passwordHash", passwordHash));
        finalUserId = ScalarRequiredInt(connection, transaction, "SELECT ID_USUARIO FROM USUARIO WHERE NOMBRE_USUARIO = 'administrador';");
    }

    Execute(connection, transaction, "UPDATE SUSCRIPCION SET ID_USUARIO_TITULAR = $userId WHERE ID_SUSCRIPCION = $subscriptionId;", ("$userId", finalUserId.Value), ("$subscriptionId", subscriptionId));
    Execute(connection, transaction, "DELETE FROM USUARIO WHERE ID_USUARIO <> $userId;", ("$userId", finalUserId.Value));
    Execute(connection, transaction, """
        UPDATE USUARIO
        SET NOMBRE_USUARIO = 'administrador', PASSWORD_HASH = $passwordHash, PIN_HASH = NULL, MAIL = NULL,
            ROL = 'Admin', ACTIVO = 1, SUSCRIPCION_ACTIVA = 1, ID_SUCURSAL_DEFAULT = $branchId,
            ID_USUARIO_RESP = NULL, ID_EMPRESA = $companyId, ID_USUARIO_RESPONSABLE = NULL
        WHERE ID_USUARIO = $userId;
        """, ("$passwordHash", passwordHash), ("$branchId", branchId), ("$companyId", companyId), ("$userId", finalUserId.Value));
    Execute(connection, transaction, "UPDATE EMPRESA SET ID_SUSCRIPCION = $subscriptionId WHERE ID_EMPRESA = $companyId;", ("$subscriptionId", subscriptionId), ("$companyId", companyId));
    Execute(connection, transaction, "UPDATE SUCURSAL SET ID_EMPRESA = $companyId, ACTIVO = 1 WHERE ID_SUCURSAL = $branchId;", ("$companyId", companyId), ("$branchId", branchId));
    Execute(connection, transaction, """
        UPDATE SUSCRIPCION
        SET NIVEL = 'Basica', ESTADO = 'Activa', COSTO_MENSUAL = 0, MAX_SUCURSALES = 1, MAX_ADMIN = 1, MAX_USUARIOS = 1, FECHA_INICIO = CURRENT_TIMESTAMP,
            FECHA_FIN = NULL, PROXIMO_COBRO = NULL, MERCADOPAGO_PREAPPROVAL_ID = NULL, MP_ACCESS_TOKEN = NULL,
            MP_REFRESH_TOKEN = NULL, MP_USER_ID = NULL, MP_VINCULADO = 0, MP_FECHA_VINC = NULL, MP_POS_ID = NULL, MP_QR_DATA = NULL
        WHERE ID_SUSCRIPCION = $subscriptionId;
        """, ("$subscriptionId", subscriptionId));
}

static void ResetRequiredSeeds(SqliteConnection connection, SqliteTransaction transaction)
{
    Execute(connection, transaction, "DELETE FROM MEDIO_PAGO;");
    Execute(connection, transaction, """
        INSERT INTO MEDIO_PAGO (ID_MEDIO_PAGO, COD_MEDIO_PAGO, DESC_MEDIO_PAGO, ACTIVO) VALUES
        (1, 'EFECTIVO', 'Efectivo', 1), (2, 'DEBITO', 'Tarjeta Débito', 0), (3, 'CREDITO', 'Tarjeta Crédito', 0),
        (4, 'TRANSFERENCIA', 'Transferencia', 0), (5, 'QR', 'QR', 0);
        """);
    Execute(connection, transaction, "DELETE FROM UNIDAD_MEDIDA;");
    Execute(connection, transaction, """
        INSERT INTO UNIDAD_MEDIDA (ID_UNIDAD_MEDIDA, COD_UNIDAD_MEDIDA, DESC_UNIDAD_MEDIDA) VALUES
        (1, 'UNIDAD', 'Unidades'), (2, 'KILO', 'Kilogramos'), (3, 'L', 'Litros'), (4, 'ML', 'Mililitros'), (5, 'GR', 'Gramos');
        """);
}

static void VerifyReset(SqliteConnection connection, SqliteTransaction transaction, int companyId, int branchId, int subscriptionId, string passwordHash)
{
    foreach (var table in new[] { "CLIENTE", "EVENTO", "PAGO_EVENTO", "CARGO_EXTRA_EVENTO", "VENTA", "PAGO", "CAJA", "GASTO", "DEUDA", "PAGO_DEUDA", "COMPRA", "RENGLON_COMPRA", "PEDIDO", "RENGLON_PEDIDO", "PRODUCTO", "STOCK_SUCURSAL", "COMBO", "COMBO_ITEM", "OFERTA", "FAMILIAR_CLIENTE", "PROVEEDOR", "OPORTUNIDAD_CUMPLEANIOS_ATENDIDA", "CATEGORIA", "CATEGORIA_GASTO" })
        AssertCount(connection, transaction, table, 0);

    AssertCount(connection, transaction, "USUARIO", 1);
    AssertCount(connection, transaction, "EMPRESA", 1);
    AssertCount(connection, transaction, "SUCURSAL", 1);
    AssertCount(connection, transaction, "SUSCRIPCION", 1);
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM __EFMigrationsHistory;") == 0)
        throw new InvalidOperationException("__EFMigrationsHistory está vacío.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM MEDIO_PAGO;") != 5 || ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM UNIDAD_MEDIDA;") != 5)
        throw new InvalidOperationException("Los datos seed requeridos no quedaron completos.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM USUARIO WHERE NOMBRE_USUARIO = 'admin';") != 0)
        throw new InvalidOperationException("El usuario admin no fue eliminado.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM USUARIO WHERE NOMBRE_USUARIO = 'administrador' AND ROL = 'Admin' AND ACTIVO = 1 AND SUSCRIPCION_ACTIVA = 1 AND PIN_HASH IS NULL;") != 1)
        throw new InvalidOperationException("El usuario administrador no quedó con los valores esperados.");
    if (!BCrypt.Net.BCrypt.Verify("0000", ScalarRequiredString(connection, transaction, "SELECT PASSWORD_HASH FROM USUARIO WHERE NOMBRE_USUARIO = 'administrador';")))
        throw new InvalidOperationException("La contraseña final no valida con BCrypt.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM SUSCRIPCION WHERE ID_SUSCRIPCION = $subscriptionId AND ID_USUARIO_TITULAR = (SELECT ID_USUARIO FROM USUARIO WHERE NOMBRE_USUARIO = 'administrador') AND ESTADO = 'Activa' AND MERCADOPAGO_PREAPPROVAL_ID IS NULL AND MP_ACCESS_TOKEN IS NULL AND MP_REFRESH_TOKEN IS NULL AND MP_USER_ID IS NULL AND MP_VINCULADO = 0 AND MP_FECHA_VINC IS NULL AND MP_POS_ID IS NULL AND MP_QR_DATA IS NULL;", ("$subscriptionId", subscriptionId)) != 1)
        throw new InvalidOperationException("La suscripción final no quedó activa o conserva datos de Mercado Pago.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM EMPRESA WHERE ID_EMPRESA = $companyId AND ID_SUSCRIPCION = $subscriptionId;", ("$companyId", companyId), ("$subscriptionId", subscriptionId)) != 1 || ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM SUCURSAL WHERE ID_SUCURSAL = $branchId AND ID_EMPRESA = $companyId AND ACTIVO = 1;", ("$branchId", branchId), ("$companyId", companyId)) != 1)
        throw new InvalidOperationException("Empresa o sucursal final incoherente.");
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM pragma_foreign_key_check;") != 0)
        throw new InvalidOperationException("Se detectaron violaciones de claves foráneas.");
}

static void ValidateCanonicalOrganization(SqliteConnection connection, int companyId, int branchId, int subscriptionId, SqliteTransaction? transaction = null)
{
    if (ScalarRequiredInt(connection, transaction, "SELECT COUNT(*) FROM EMPRESA e JOIN SUCURSAL s ON s.ID_EMPRESA = e.ID_EMPRESA JOIN SUSCRIPCION sub ON sub.ID_SUSCRIPCION = e.ID_SUSCRIPCION WHERE e.ID_EMPRESA = $companyId AND s.ID_SUCURSAL = $branchId AND sub.ID_SUSCRIPCION = $subscriptionId;", ("$companyId", companyId), ("$branchId", branchId), ("$subscriptionId", subscriptionId)) != 1)
        throw new InvalidOperationException("Empresa, sucursal y suscripción deben existir y estar vinculadas entre sí antes del reseteo.");
}

static void AssertIntegrity(SqliteConnection connection)
{
    if (ScalarRequiredString(connection, null, "PRAGMA integrity_check;") != "ok")
        throw new InvalidOperationException("PRAGMA integrity_check falló.");
}

static void AssertCount(SqliteConnection connection, SqliteTransaction transaction, string table, int expected)
{
    if (ScalarRequiredInt(connection, transaction, $"SELECT COUNT(*) FROM {table};") != expected)
        throw new InvalidOperationException($"La tabla {table} no quedó en {expected} registros.");
}

static SqliteConnection Open(string path, SqliteOpenMode mode)
{
    var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Mode = mode, Pooling = false }.ToString());
    connection.Open();
    return connection;
}

static void Execute(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
{
    using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = sql;
    foreach (var parameter in parameters) command.Parameters.AddWithValue(parameter.Name, parameter.Value ?? DBNull.Value);
    command.ExecuteNonQuery();
}

static int? ScalarInt(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
{
    var value = Scalar(connection, transaction, sql, parameters);
    return value is null || value == DBNull.Value ? null : Convert.ToInt32(value);
}

static int ScalarRequiredInt(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
    => ScalarInt(connection, transaction, sql, parameters) ?? throw new InvalidOperationException("La consulta no devolvió un entero.");

static string ScalarRequiredString(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
    => Convert.ToString(Scalar(connection, transaction, sql, parameters)) ?? throw new InvalidOperationException("La consulta no devolvió texto.");

static object? Scalar(SqliteConnection connection, SqliteTransaction? transaction, string sql, params (string Name, object? Value)[] parameters)
{
    using var command = connection.CreateCommand();
    command.Transaction = transaction;
    command.CommandText = sql;
    foreach (var parameter in parameters) command.Parameters.AddWithValue(parameter.Name, parameter.Value ?? DBNull.Value);
    return command.ExecuteScalar();
}

static int ParseId(IReadOnlyDictionary<string, string?> options, string name)
    => int.TryParse(Required(options, name), out var value) && value > 0 ? value : throw new ArgumentException($"--{name} debe ser un entero positivo.");

static string Required(IReadOnlyDictionary<string, string?> options, string name)
    => options.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value) ? value : throw new ArgumentException($"Falta --{name}.");

static Dictionary<string, string?> ParseArguments(string[] args)
{
    var result = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i++)
    {
        if (!args[i].StartsWith("--", StringComparison.Ordinal)) throw new ArgumentException($"Argumento inválido: {args[i]}");
        var name = args[i][2..];
        result[name] = i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal) ? args[++i] : null;
    }
    return result;
}
