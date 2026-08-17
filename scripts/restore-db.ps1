[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$SqlFile,
    [Parameter(Mandatory)] [string]$TargetDatabase,
    [string]$Server = $(if ($env:POSWEB_DB_HOST) { $env:POSWEB_DB_HOST } else { 'localhost' }),
    [int]$Port = $(if ($env:POSWEB_DB_PORT) { [int]$env:POSWEB_DB_PORT } else { 3306 }),
    [string]$User = $(if ($env:POSWEB_DB_USER) { $env:POSWEB_DB_USER } else { 'root' }),
    [string]$Password = $env:POSWEB_DB_PASSWORD,
    [string]$CompareSourceDatabase = $(if ($env:POSWEB_DB_NAME) { $env:POSWEB_DB_NAME } else { 'posweb' }),
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Resolve-MySqlCommand {
    param([Parameter(Mandatory)] [string]$CommandName)

    $cmd = Get-Command $CommandName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        Get-ChildItem -Path 'C:\Program Files\MySQL' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' }
        Get-ChildItem -Path 'C:\Program Files (x86)\MySQL' -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' }
    )

    foreach ($bin in $candidates) {
        $candidate = Join-Path $bin ($CommandName + '.exe')
        if (Test-Path $candidate) { return $candidate }
    }

    throw "No se encontró '$CommandName'. Instalá MySQL o agregá la carpeta bin al PATH."
}

function Assert-SafeRestoreTarget {
    param([Parameter(Mandatory)] [string]$Database)

    if ($Database -notmatch '(_test|_restore|_backupcheck)$') {
        throw "Restore bloqueado: '$Database' no es un destino de prueba permitido. Usá un nombre que termine en _test, _restore o _backupcheck."
    }
}

function Invoke-MySqlScalar {
    param(
        [Parameter(Mandatory)] [string]$MysqlExe,
        [Parameter(Mandatory)] [string[]]$Args,
        [Parameter(Mandatory)] [string]$Query
    )

    $result = & $MysqlExe @Args -N -B -e $Query
    if ($LASTEXITCODE -ne 0) {
        throw "mysql falló al ejecutar: $Query"
    }

    return ($result | Select-Object -First 1)
}

Assert-SafeRestoreTarget -Database $TargetDatabase

if (-not (Test-Path -LiteralPath $SqlFile)) {
    throw "No existe el archivo SQL: $SqlFile"
}

if ([System.IO.Path]::GetExtension($SqlFile) -ne '.sql') {
    throw 'El archivo de restore debe terminar en .sql.'
}

$sqlFullPath = [System.IO.Path]::GetFullPath($SqlFile)

Write-Host '========================================'
Write-Host 'PosWeb - Restore de prueba'
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Origen SQL: $sqlFullPath"
Write-Host "Destino: $TargetDatabase"
Write-Host '========================================'

if ($DryRun) {
    Write-Host 'DryRun activo: no se ejecuta importación.'
    return
}

if ([string]::IsNullOrWhiteSpace($TargetDatabase)) {
    throw 'El destino del restore es obligatorio.'
}

$mysql = Resolve-MySqlCommand -CommandName 'mysql'

$env:MYSQL_PWD = $Password
try {
    $baseArgs = @('--host', $Server, '--port', $Port, '--user', $User)

    Write-Host 'Inicio restore...'
    & $mysql @baseArgs -e "CREATE DATABASE IF NOT EXISTS `$TargetDatabase` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo crear la base destino.'
    }

    $existingTables = Invoke-MySqlScalar -MysqlExe $mysql -Args $baseArgs -Query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$TargetDatabase';"
    if ([int]$existingTables -gt 0) {
        throw "La base '$TargetDatabase' no está vacía. Abortando restore."
    }

    $importArgs = @('--host', $Server, '--port', $Port, '--user', $User, '--database', $TargetDatabase)
    $process = Start-Process -FilePath $mysql -ArgumentList $importArgs -RedirectStandardInput $sqlFullPath -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "mysql falló durante el restore con código $($process.ExitCode)."
    }

    $tablesToCheck = @('__EFMigrationsHistory', 'USUARIO', 'CLIENTE', 'EVENTO', 'PAGO_EVENTO', 'GASTO')
    foreach ($table in $tablesToCheck) {
        $exists = Invoke-MySqlScalar -MysqlExe $mysql -Args $baseArgs -Query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$TargetDatabase' AND table_name = '$table';"
        if ([int]$exists -eq 0) {
            throw "Falta la tabla requerida '$table' en '$TargetDatabase'."
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($CompareSourceDatabase)) {
        $tablesForCounts = @('USUARIO', 'CLIENTE', 'EVENTO', 'PAGO_EVENTO', 'GASTO')
        foreach ($table in $tablesForCounts) {
            $sourceCount = Invoke-MySqlScalar -MysqlExe $mysql -Args $baseArgs -Query "SELECT COUNT(*) FROM `$CompareSourceDatabase`.`$table`;"
            $targetCount = Invoke-MySqlScalar -MysqlExe $mysql -Args $baseArgs -Query "SELECT COUNT(*) FROM `$TargetDatabase`.`$table`;"
            if ([int64]$sourceCount -ne [int64]$targetCount) {
                throw ("Conteo distinto en {0}: origen={1} destino={2}" -f $table, $sourceCount, $targetCount)
            }
        }
    }

    Write-Host 'Restore de prueba completado correctamente.'
    Write-Host "Resultado: OK"
}
finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
