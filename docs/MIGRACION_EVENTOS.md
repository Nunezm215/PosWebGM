# Migracion de PosWeb a gestion de salon de eventos

Bitacora permanente de la migracion funcional de PosWeb hacia un sistema de gestion de salon de eventos.

## Fase 0 - Preparacion

**Estado:** COMPLETADA  
**Tag Git:** `fase-0-ok`

### Cambios

- Se partio de una copia limpia del PosWeb original.
- Se ocultaron de la navegacion los modulos comerciales que no se usaran.
- Se conservaron Clientes, Caja, Gastos, Usuarios y Configuracion.
- No se eliminaron paginas ni rutas originales.
- Se corrigio el updater de Tauri para ejecucion web con Vite.
- Backend y frontend fueron probados manualmente.

### Verificacion

- Tests frontend OK.
- Build frontend OK.
- Backend OK.
- Login OK.
- Conexion frontend/backend OK.

## Fase 1A.1 - Nucleo de Evento

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1a1-evento-core-ok`

### Implementado

- `Evento`
- Estados de `Evento`
- `CrearEventoRequestDto`
- `EditarEventoRequestDto`
- `EventoDto`
- `IEventoRepository`
- `IEventoService`
- `EventoService`
- `EventoDisponibilidad`
- Margen de 30 minutos
- Exactamente 30 minutos permitido
- `Cancelado` no bloquea disponibilidad
- Validaciones implementadas

### Archivos creados

- `PosWeb.Domain/Evento.cs`
- `PosWeb.Contracts/CrearEventoRequestDto.cs`
- `PosWeb.Contracts/EditarEventoRequestDto.cs`
- `PosWeb.Contracts/EventoDto.cs`
- `PosWeb/Application/Eventos/IEventoRepository.cs`
- `PosWeb/Application/Eventos/IEventoService.cs`
- `PosWeb/Application/Eventos/EventoDisponibilidad.cs`
- `PosWeb/Application/Eventos/EventoService.cs`
- `PosWeb.Application.Test/Eventos/EventoServiceTests.cs`

### Tests

- `EventoServiceTests`: 13/13 OK

### Build

- `dotnet build PosWeb/PosWeb.csproj`
- 0 errores
- 0 advertencias

### Verificacion manual

- Backend levanta.
- Frontend levanta.
- Login funciona.
- El sistema existente continua funcionando.

### Aun no existe

- `DbSet<Evento>`
- mapeo EF Core
- migracion `Evento`
- tabla `EVENTO`
- `EventosController`
- endpoints HTTP
- calendario frontend
- `PagoEvento`
- `GastoEvento`
- integracion Evento/Caja
- QR para Evento

## Nota sobre `VentaServiceTest`

`PosWeb.Application.Test/VentaServiceTest.cs` fue ajustado unicamente para compatibilidad con la firma actual de `VentaService` y para que compile el proyecto de tests.

No representa una funcionalidad nueva de Evento.

## Infraestructura - Acceso por red local

**Estado:** COMPLETADO  
**Tag Git previsto:** `lan-web-ok`

### Problema detectado

- El backend escuchaba solo en:
  `http://localhost:5196`
- Desde el celular se podia abrir el frontend, pero no conectar al backend.
- El frontend tambien tenia una base API absoluta:
  `http://localhost:5196/api`
- En el celular, `localhost` apuntaba al propio telefono.

### Cambios realizados

**Backend:**

- Se elimino `builder.WebHost.UseUrls("http://localhost:5196");` de `PosWeb/Program.cs`.
- `launchSettings.json` paso a usar `http://0.0.0.0:5196`.
- Se removio el valor global `"Urls": "http://localhost:5196"` de `PosWeb/appsettings.json` para permitir que prevalezcan `launchSettings` y `--urls`.

**Frontend:**

- `frontend/src/api/client.ts` ahora usa `/api` relativo en entorno web.
- En Tauri conserva `http://localhost:5196/api`.
- Vite sigue haciendo proxy `/api -> http://localhost:5196`.

### Tests

- `frontend/src/api/client.test.ts`: 2/2 OK
- `npm run build`: OK
- `dotnet build`: OK

### Verificacion manual

- Backend responde desde la PC.
- Backend responde desde celular: `http://192.168.0.10:5196/api/sucursales`
- Frontend responde desde celular: `http://192.168.0.10:5173`
- Login funciona desde celular.
- Frontend conecta correctamente al backend a traves del proxy Vite.
- Aplicacion funcionando correctamente desde PC y celular en la misma red Wi-Fi.

### Archivos de este checkpoint

- `PosWeb/Program.cs`
- `PosWeb/Properties/launchSettings.json`
- `PosWeb/appsettings.json`
- `frontend/src/api/client.ts`
- `frontend/src/api/client.test.ts`

### Nota

Esta modificacion es de infraestructura/desarrollo.

No modifica:

- Evento
- Caja
- Mercado Pago
- base de datos
- migraciones
- logica de negocio

## Fase 1A.2A - Persistencia de Evento

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1a2a-evento-persistencia-ok`

### Implementado

- `DbSet<Evento>` en `PosDbContext`.
- `DbSet<Evento>` en `PosDbContextLocal`.
- Mapeo de `EVENTO`.
- Relaciones con `Cliente`, `Usuario` y `Sucursal`.
- `DeleteBehavior.Restrict` en las tres relaciones.
- Indices:
  - `ID_CLIENTE`
  - `ID_USUARIO_CREADOR`
  - `ID_SUCURSAL + FECHA`
- `EventoRepository` real con `PosDbContextLocal`.
- Filtrado por sucursal en consultas.
- Persistencia SQLite validada con base in-memory.

### Migraciones

**MySQL:**

- `PosWeb/Migrations/20260810181808_AddEvento.cs`

**SQLite:**

- `PosWeb/Migrations/Local/20260810181845_AddEvento.cs`

**Ambas:**

- crean solo `EVENTO`
- crean PK
- crean FKs
- crean indices
- no modifican otras tablas
- no insertan datos

**Designer:**

- presentes en ambas migraciones

**Snapshots:**

- actualizados para MySQL y SQLite

### Tipos

**MySQL:**

- `int`
- `date`
- `time(6)`
- `datetime(6)`
- `decimal(18,2)`
- `varchar`

**SQLite:**

- `INTEGER/TEXT` con conversiones de `DateOnly`/`TimeOnly`/`DateTime` segun provider

La estructura logica es equivalente.

### Repository

`EventoRepository` soporta:

- `ObtenerPorIdAsync`
- `ListarAsync`
- `ListarPorRangoAsync`
- `ListarPorFechaYSucursalAsync`
- `AgregarAsync`
- `ActualizarAsync`

La disponibilidad sigue siendo logica de `EventoService`, no del repository.

### Reglas preservadas

- 30 minutos exactos entre eventos: permitido.
- 29 minutos: rechazado.
- `Cancelado` no bloquea.
- eventos filtrados por sucursal.

### Tests

- `EventoServiceTests`
- `EventoRepositoryEfTests`
- total: 20/20 OK

### Build

- `dotnet build PosWeb/PosWeb.csproj`
- 0 errores
- 0 advertencias

### Base fisica

- La migracion SQLite todavia NO fue aplicada a la DB fisica.
- Tests usan `DataSource=:memory:`
- MySQL real no fue tocado.

### Nota tecnica MySQL

- `Program.cs` dejo de usar `ServerVersion.AutoDetect(...)`
- ahora usa `ServerVersion.Parse("8.0.36-mysql")`
- esto evita conexion real a MySQL durante tooling/design-time
- `DesignTimeDbContextFactory` usa la misma version
- queda como observacion futura centralizar esta version para evitar duplicacion

### Aun no existe

- `EventosController`
- endpoints HTTP de Evento
- frontend/calendario
- `PagoEvento`
- `GastoEvento`
- integracion con Caja
- QR de eventos

### Proximo paso

**Fase 1A.2B:**
Aplicar migracion SQLite local + registrar DI + API HTTP de Eventos.

## Fase 1A.2B - API HTTP de Eventos

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1a2b-evento-api-ok`

### Implementado

- Migracion SQLite `AddEvento` aplicada a la DB fisica local.
- DI de `IEventoRepository` / `EventoRepository`.
- DI de `IEventoService` / `EventoService`.
- `EventosController`.
- Endpoints:
  - `POST /api/eventos`
  - `GET /api/eventos`
  - `GET /api/eventos/{id}`
  - `GET /api/eventos/rango`
  - `GET /api/eventos/disponibilidad`
  - `PUT /api/eventos/{id}`
  - `PATCH /api/eventos/{id}/estado`
  - `POST /api/eventos/{id}/cancelar`

### Seguridad

- `[Authorize]`
- `usuarioId` desde `ClaimTypes.NameIdentifier`
- `sucursalId` desde claim `"sucursalId"`
- `Admin` / `SuperAdmin` pueden modificar
- `UsuarioComun` no puede editar / cancelar / cambiar estado

### Swagger

- Se agrego soporte JWT Bearer en Swagger con boton `Authorize`.
- La autenticacion JWT real no fue modificada.

### Tests

- `dotnet test --filter "FullyQualifiedName~Evento"`
- `35/35 OK`

### Build

- `dotnet build PosWeb/PosWeb.csproj`
- `0 errores`
- `0 advertencias`

### Verificacion manual real

- `GET /api/eventos` autenticado => `200`
- sin eventos inicialmente => `[]`
- `ClientePrueba` creado con `clienteId 1`
- `POST /api/eventos` valido => `201 Created`
- Evento creado:
  - id `1`
  - clienteId `1`
  - usuarioCreadorId `1`
  - sucursalId `1`
  - fecha `2026-08-15`
  - horario `18:00-22:00`
  - estado `Reservado`
- `POST` superpuesto `21:00-23:00` => `400`
- mensaje:
  "El evento no está disponible en ese horario"

### Confirmaciones

- La regla de disponibilidad funciona contra la SQLite fisica.
- El evento se persiste realmente.
- El usuario y sucursal salen del JWT.
- No se toco frontend.
- No se toco Caja.
- No se toco Mercado Pago.
- No existen todavia `PagoEvento` ni `GastoEvento`.

### Proximo paso

**Fase 1B:**
frontend de Eventos + calendario + alta/detalle/edicion/cancelacion.

## Fase 1B.1 - Calendario frontend de Eventos

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1b1-calendario-eventos-ok`

### Implementado

- Ruta `/eventos`.
- Opcion `Eventos` agregada al menu.
- Visible para:
  - SuperAdmin
  - Admin
  - UsuarioComun
- `EventosPage` creada.
- Calendario mensual propio, sin dependencia externa.
- Calendario de solo lectura.
- Carga de eventos mediante:
  `GET /api/eventos/rango`
- Consulta unicamente el rango visible del calendario.
- Al cambiar de mes se consulta nuevamente el rango.
- Tipo frontend `EventoDto`.
- Helpers:
  - `api.eventos.listarPorRango`
  - `api.eventos.obtenerPorId`

### Visualizacion

- Los eventos muestran hora y tipo de evento.
- Estados:
  - Reservado
  - Señado
  - Pagado
  - Cancelado
- Los estados tienen identificacion textual.
- Cancelados se muestran diferenciados.
- Click sobre evento abre detalle de solo lectura.

### Detalle

El modal muestra:

- fecha
- hora inicio
- hora fin
- tipo de evento
- invitados
- monto
- estado
- cliente
- sucursal
- usuario creador
- observaciones

### Responsive

Verificado en:

- PC
- celular en red local

El calendario y el detalle funcionan correctamente en ambos.

### Tests

Tests de:

- EventosPage
- Layout

Se corrigio un test que encontraba dos textos `Reservado`,
limitando la busqueda al dialog mediante `within(dialog)`.

### Build

- `npm run build`: OK

### Verificacion manual

Se verifico correctamente el Evento real existente:

- fecha: 15/08/2026
- inicio: 18:00
- fin: 22:00
- tipo: Cumpleanos
- estado: Reservado

El evento se obtiene desde la API y aparece correctamente en el calendario.

Al hacer click se abre correctamente su detalle.

### Dependencias

- No se agrego ninguna libreria de calendario.
- No se agregaron dependencias nuevas.

### No incluido todavia

- crear Evento desde frontend
- editar Evento
- cancelar Evento
- cambiar estado
- pagos de Evento
- gastos de Evento
- integracion con Caja
- QR

### Proximo paso

**Fase 1B.2: Alta de Evento desde frontend.**

Incluir:

- boton Nuevo Evento
- busqueda/seleccion de cliente
- formulario
- fecha y horarios
- tipo de evento
- invitados
- monto
- observaciones
- validacion de disponibilidad
- POST /api/eventos
- actualizacion automatica del calendario

## Proximo paso

**Fase 1A.2:** persistencia EF Core + migraciones + API de Eventos.

## Fase 1B.2 - Alta de Evento desde frontend

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1b2-alta-evento-ok`

### Implementado

- Boton `Nuevo Evento`.
- Modal de alta.
- Busqueda de clientes existentes.
- Debounce de 300 ms en busqueda.
- Seleccion y limpieza del cliente.
- Campos:
  - Cliente
  - Fecha
  - Hora inicio
  - Hora fin
  - Tipo de evento
  - Cantidad de invitados
  - Monto total
  - Observaciones
- Validacion simple de horarios en frontend.
- Consulta real a:
  `GET /api/eventos/disponibilidad`
- Estado visual:
  - Disponible
  - Horario no disponible
- Alta mediante:
  `POST /api/eventos`
- No se envian:
  - usuarioCreadorId
  - sucursalId
  - estado
- Backend continua obteniendo usuario/sucursal desde JWT.
- Despues de crear:
  - cierra modal
  - limpia formulario
  - refresca rango visible
  - Evento aparece automaticamente en calendario
- Proteccion contra doble click mediante estado `saving`.
- Errores backend quedan visibles sin cerrar modal.
- Labels asociados correctamente a inputs con `htmlFor`/`id`.

### Payload

El alta envia:

- `clienteId`
- `fecha`
- `horaInicio`
- `horaFin`
- `tipoEvento`
- `cantidadInvitados`
- `montoTotal`
- `observaciones`

### Disponibilidad

- Frontend no duplica la regla completa de 30 minutos.
- La autoridad sigue siendo backend.
- Se consulta `/api/eventos/disponibilidad`.
- Si backend informa conflicto, no se permite guardar.

### Responsive

Verificado manualmente en:

- PC
- celular por red local

El alta funciona correctamente en ambos.

### Tests

- EventosPage + Layout
- 13/13 OK
- cobertura de:
  - apertura de modal
  - campos
  - busqueda/seleccion cliente
  - horarios
  - disponibilidad
  - payload
  - exclusion de usuario/sucursal/estado
  - refresh
  - errores
  - doble click

### Build

- `npm run build`: OK

### Verificacion manual

Confirmado:

- crear Evento desde PC: OK
- crear Evento desde celular: OK
- Evento aparece inmediatamente en calendario
- disponibilidad funciona correctamente
- flujo completo frontend -> API -> SQLite funciona

### No incluido todavia

- editar Evento
- cancelar Evento
- cambiar estado
- PagoEvento
- GastoEvento
- Caja financiera de Eventos
- QR

### Proximo paso

**Fase 1B.3: detalle editable + edicion + cancelacion de Evento.**
