[CmdletBinding()]
param(
    [string]$Server = $(if ($env:POSWEB_DB_HOST) { $env:POSWEB_DB_HOST } else { 'localhost' }),
    [int]$Port = $(if ($env:POSWEB_DB_PORT) { [int]$env:POSWEB_DB_PORT } else { 3306 }),
    [string]$User = $(if ($env:POSWEB_DB_USER) { $env:POSWEB_DB_USER } else { 'root' }),
    [string]$Password = $env:POSWEB_DB_PASSWORD,
    [string]$Database = $(if ($env:POSWEB_DB_NAME) { $env:POSWEB_DB_NAME } else { 'posweb' }),
    [string]$BackupDir = $(if ($env:POSWEB_BACKUP_DIR) { $env:POSWEB_BACKUP_DIR } else { Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PosWeb\backups' }),
    [int]$RetentionCount = $(if ($env:POSWEB_BACKUP_RETENTION_COUNT) { [int]$env:POSWEB_BACKUP_RETENTION_COUNT } else { 14 }),
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

function Assert-SafeBackupDir {
    param([Parameter(Mandatory)] [string]$Path)

    $full = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($full)
    if ($full.TrimEnd('\') -eq $root.TrimEnd('\')) {
        throw "La carpeta de backups no puede ser la raíz del disco: $full"
    }

    return $full
}

function Remove-OldBackups {
    param(
        [Parameter(Mandatory)] [string]$Path,
        [int]$RetainCount
    )

    if ($RetainCount -lt 0) {
        throw 'POSWEB_BACKUP_RETENTION_COUNT no puede ser negativo.'
    }

    $files = Get-ChildItem -LiteralPath $Path -Filter 'posweb-*.sql' -File | Sort-Object LastWriteTime -Descending
    $oldFiles = @($files | Select-Object -Skip $RetainCount)

    foreach ($file in $oldFiles) {
        if (-not $file.FullName.StartsWith($Path, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Ruta de backup insegura detectada: $($file.FullName)"
        }

        Remove-Item -LiteralPath $file.FullName -Force
        Write-Host "Eliminado backup antiguo: $($file.Name)"
    }
}

$safeBackupDir = Assert-SafeBackupDir -Path $BackupDir

Write-Host "========================================"
Write-Host "PosWeb - Backup de base de datos"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "Base: $Database"
Write-Host "Destino: $safeBackupDir"
Write-Host "========================================"

if ($DryRun) {
    Write-Host 'DryRun activo: no se ejecuta mysqldump.'
    return
}

New-Item -ItemType Directory -Path $safeBackupDir -Force | Out-Null

$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$fileName = "posweb-$timestamp.sql"
$backupPath = Join-Path $safeBackupDir $fileName

$mysqlDump = Resolve-MySqlCommand -CommandName 'mysqldump'
$env:MYSQL_PWD = $Password
try {
    $args = @(
        '--host', $Server,
        '--port', $Port,
        '--user', $User,
        '--single-transaction',
        '--routines',
        '--triggers',
        '--hex-blob',
        '--quick',
        '--skip-lock-tables',
        '--default-character-set=utf8mb4',
        $Database
    )

    Write-Host 'Inicio backup...'
    & $mysqlDump @args 1> $backupPath
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        if (Test-Path $backupPath) { Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue }
        throw "mysqldump falló con código $exitCode."
    }

    if (-not (Test-Path $backupPath)) {
        throw 'mysqldump terminó pero no se generó el archivo de backup.'
    }

    $fileInfo = Get-Item -LiteralPath $backupPath
    if ($fileInfo.Length -le 0) {
        Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
        throw 'El archivo de backup quedó vacío.'
    }

    Write-Host "Archivo generado: $backupPath"
    Write-Host "Tamaño: $([Math]::Round($fileInfo.Length / 1KB, 2)) KB"
    Remove-OldBackups -Path $safeBackupDir -RetainCount $RetentionCount
    Write-Host 'Resultado: OK'
}
finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
