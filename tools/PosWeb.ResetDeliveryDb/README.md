# PosWeb Reset Delivery Database

Herramienta local para preparar una base SQLite de entrega. No contiene una ruta de producción ni detiene servicios: requiere que el operador haya detenido `posweb.service` y confirme esa condición explícitamente.

## Inspección sin cambios

```bash
dotnet run --project tools/PosWeb.ResetDeliveryDb -- --inspect --database /var/lib/posweb/posweb.db
```

Seleccionar de la salida una cadena coherente de empresa, sucursal y suscripción.

## Ejecución posterior autorizada

```bash
set -euo pipefail
timestamp=$(date +%Y%m%d-%H%M%S)
sudo systemctl stop posweb.service
sudo mkdir -p /var/lib/posweb/backups
dotnet run --project tools/PosWeb.ResetDeliveryDb -- \
  --database /var/lib/posweb/posweb.db \
  --backup /var/lib/posweb/backups/posweb-pre-entrega-$timestamp.db \
  --company-id <ID_EMPRESA> \
  --sucursal-id <ID_SUCURSAL> \
  --suscripcion-id <ID_SUSCRIPCION> \
  --service-stopped \
  --confirm RESET-POSWEB-DELIVERY
sudo systemctl start posweb.service
```

La herramienta crea el backup con `SqliteConnection.BackupDatabase`, no usa `sqlite3` CLI y nunca sobrescribe un backup existente. Si falla cualquier operación posterior al backup, revierte la transacción de reseteo.

Antes del backup y de los `DELETE`, valida que todas las tablas críticas existan y que las columnas usadas por los seeds, organización, usuario y suscripción sean compatibles con el esquema SQLite actual.
