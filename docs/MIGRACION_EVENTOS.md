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

## Fase 1B.3 - Edicion, estado y cancelacion de Eventos

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1b3-edicion-eventos-ok`

### Implementado

Desde el detalle de Evento:

- editar Evento
- cambiar estado
- cancelar Evento

### Permisos

Las acciones de modificacion estan disponibles para:

- Admin
- SuperAdmin

UsuarioComun mantiene acceso de solo lectura.

El backend continua siendo la autoridad final de autorizacion.

### Edicion

Se permite modificar los datos admitidos por el contrato real de edicion.

La disponibilidad se consulta nuevamente cuando corresponde.

En edicion se utiliza `eventoIdExcluir` para que el Evento no genere conflicto consigo mismo.

Despues de guardar:

- se actualiza el Evento
- se refresca el calendario
- los cambios aparecen sin recargar completamente la aplicacion

### Disponibilidad

La regla continua en backend:

- separacion minima de 30 minutos entre Eventos
- exactamente 30 minutos: permitido
- menos de 30 minutos: rechazado
- Evento Cancelado no bloquea disponibilidad

Frontend consulta la disponibilidad pero no reemplaza la regla del backend.

### Cambio de estado

Se agrego cambio manual de estado mediante el endpoint existente.

Estados existentes:

- Reservado
- Señado
- Pagado
- Cancelado

En esta fase el cambio de estado NO genera movimientos financieros.

### Cancelacion

- requiere confirmacion
- no elimina fisicamente el Evento
- Evento queda con estado Cancelado
- un Evento Cancelado libera su horario
- no se ofrece nuevamente la accion Cancelar cuando ya esta cancelado

### Responsive

Verificado manualmente en:

- PC
- celular por red local

Funcionan correctamente:

- detalle
- edicion
- cambio de estado
- cancelacion

### Tests

- `EventosPage.test.tsx`: 10/10 OK
- existen warnings de `act(...)` en Vitest
- los warnings no rompen la suite y quedan como mejora tecnica futura

### Build

- `npm run build`: OK

### Verificacion manual

Confirmado de punta a punta:

- edicion de Evento: OK
- disponibilidad durante edicion: OK
- regla de 30 minutos: OK
- cambio de estado: OK
- cancelacion: OK
- Evento Cancelado libera horario: OK
- funcionamiento PC: OK
- funcionamiento celular: OK

### No incluido todavia

- PagoEvento
- GastoEvento
- integracion financiera con Caja
- QR de Evento
- Mercado Pago para Evento

### Proximo paso

Antes de implementar la parte financiera, definir y disenar:

**Fase 2 - Finanzas de Evento**

Incluyendo conceptualmente:

- senas
- pagos parciales
- saldo pendiente
- multiples pagos por Evento
- medios de pago
- movimientos de Caja
- gastos asociados al Evento

No implementar esa fase todavia.

## Fase 1B.4A - Alta de Cliente desde Nuevo Evento

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1b4a-cliente-desde-evento-ok`

### Objetivo

Permitir crear un Cliente real del sistema directamente desde el flujo
de alta de un Evento cuando el Cliente todavia no existe.

### Implementado

Dentro de `Nuevo Evento`:

- se mantiene la busqueda de Clientes existentes
- se agrego la accion `Crear cliente nuevo`
- se abre un formulario de alta de Cliente sin abandonar el Evento
- se utiliza el endpoint real:
  `POST /api/clientes`

El Cliente creado:

- se persiste normalmente en `CLIENTE`
- queda disponible globalmente en el sistema
- aparece posteriormente en `/clientes`
- no es un Cliente temporal ni exclusivo del Evento

### Campos del Cliente

Se utilizan los campos reales del modulo Clientes:

- nombre
- tipoDocumento
- numeroDocumento
- ivaCondicion
- telefono
- mail
- domicilio

Payload utilizado:

- nombre
- tipoDocumento
- numeroDocumento
- ivaCondicion
- telefono
- domicilio
- mail

### Flujo

Al crear correctamente el Cliente:

1. se guarda mediante `POST /api/clientes`
2. se cierra el formulario de Cliente
3. se vuelve al alta del Evento
4. se conservan todos los datos previamente cargados del Evento
5. el Cliente recien creado queda seleccionado automaticamente
6. el usuario continua normalmente con `Guardar Evento`

Crear el Cliente NO crea automaticamente el Evento.

### Cancelacion del alta de Cliente

Si se cancela el alta del Cliente:

- se vuelve al formulario de Evento
- no se pierden los datos cargados
- no se selecciona ningun Cliente nuevo

### Errores

Si falla el alta del Cliente:

- el formulario permanece abierto
- se muestra el mensaje devuelto por backend
- se pueden corregir los datos y reintentar
- los datos del Evento no se pierden

### Proteccion contra duplicados

Durante `POST /api/clientes`:

- el boton queda deshabilitado
- se evita doble creacion por doble click

### Permisos

El endpoint real `POST /api/clientes` esta autorizado para:

- Admin
- SuperAdmin

La autorizacion real continua dependiendo del backend.

No se modificaron permisos del backend.

### Edicion de Evento

La creacion de Cliente nuevo se agrego unicamente al alta de Evento.

En edicion de Evento:

- se pueden seleccionar Clientes existentes
- no se ofrece creacion inline de Cliente

### Responsive

Verificado manualmente en:

- PC
- celular por red local

El flujo funciona correctamente en ambos.

### Tests

Se amplio:

`frontend/src/pages/__tests__/EventosPage.test.tsx`

Resultado:

- 15/15 OK

Se verifico:

- apertura del alta de Cliente
- campos del Cliente
- payload
- creacion
- conservacion de datos del Evento
- seleccion automatica del Cliente creado
- cancelacion
- errores
- proteccion contra doble click
- ausencia de creacion inline durante edicion

Persisten warnings no bloqueantes de `act(...)` en Vitest.

### Build

- `npm run build`: OK

### Verificacion manual

Confirmado:

- creacion de Cliente desde Nuevo Evento: OK
- Cliente queda registrado globalmente: OK
- Cliente queda seleccionado automaticamente: OK
- datos previamente cargados del Evento se conservan: OK
- Evento puede guardarse posteriormente: OK
- Cliente aparece en el modulo Clientes: OK
- funcionamiento en PC: OK
- funcionamiento en celular: OK

### Git

Implementacion guardada inicialmente en:

`650793f Fase 1B.4A: permitir crear cliente desde nuevo evento`

### No modificado

- backend
- DbContext
- migraciones
- estructura de base de datos
- Caja
- PagoEvento
- GastoEvento
- Mercado Pago

### Proximo paso

Continuar con mejoras funcionales y de usabilidad del modulo Eventos
antes de comenzar la parte financiera.

No implementar pagos todavia.

## Fase 1B.4B - Contrato de Reserva de Evento v1

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1b4b-contrato-evento-ok`

### Objetivo

Permitir generar un contrato de reserva del salon utilizando
automaticamente los datos reales del Evento y del Cliente.

El contrato puede visualizarse e imprimirse desde el modulo Eventos.

Esta primera version NO incluye firma digital.

### Flujo

Desde el detalle de un Evento:

- accion `Contrato`
- `Ver contrato`
- `Imprimir contrato`

El contrato se genera bajo demanda.

No se persiste el PDF en:

- base de datos
- filesystem
- tabla adicional

### Endpoint

Se agrego:

`GET /api/eventos/{id}/contrato`

Caracteristicas:

- requiere JWT
- obtiene sucursal desde claims
- no acepta `sucursalId` desde query
- valida que el Evento pertenezca a la sucursal
- devuelve `application/pdf`
- Evento inexistente/no accesible devuelve respuesta controlada

### Generacion PDF

Se incorporo:

`QuestPDF`

Servicio:

`ContratoEventoPdfService`

Template:

`ContratoEventoTemplate`

El contenido contractual queda centralizado para poder reemplazar
facilmente las clausulas en el futuro.

### Datos del Cliente

El contrato utiliza datos reales:

- nombre
- tipo de documento
- numero de documento
- telefono
- domicilio
- mail, si existe

### Datos del Evento

Incluye:

- numero/ID de Evento
- fecha
- hora inicio
- hora fin
- tipo de evento
- cantidad de invitados
- monto total
- observaciones
- estado

Si existe informacion real utilizable de empresa/sucursal,
puede mostrarse el nombre comercial.

No se inventan datos legales.

### Contenido base

Titulo:

`CONTRATO DE RESERVA DE SALON DE EVENTOS`

El modelo inicial incluye:

- identificacion del contratante
- datos del Evento
- objeto de la reserva
- reserva de fecha
- horario
- cantidad de invitados
- cuidado de instalaciones
- responsabilidad
- cancelaciones/modificaciones
- conformidad
- observaciones
- espacios para firmas

Este texto es un MODELO BASE.

Esta diseñado para ser reemplazado posteriormente por el contrato

No debe considerarse todavia el texto contractual/legal definitivo.

### Firmas

El PDF incluye espacios para:

- firma del contratante
- aclaracion
- DNI
- firma del responsable del salon
- aclaracion

En esta fase las firmas son para impresion y firma manual.

NO existe todavia captura de firma digital.

### Evento Cancelado

El contrato puede seguir consultandose para un Evento cancelado.

En ese caso debe quedar identificado explicitamente:

`EVENTO CANCELADO`

### Frontend

Desde el detalle del Evento:

`Ver contrato`

- solicita el PDF autenticado
- crea un Blob
- abre el documento en una nueva pestaña

`Imprimir contrato`

- reutiliza el PDF
- utiliza un iframe temporal/oculto
- ejecuta la impresion del navegador

No existe una segunda version HTML independiente del contrato.

El PDF es la representacion visual del contrato.

### Celular

Verificado manualmente desde celular por red local.

El contrato puede:

- abrirse
- visualizarse
- utilizar las opciones normales del navegador/dispositivo

No se implemento integracion Android nativa especifica.

### Dependencias

Backend:

- QuestPDF

Tests:

- UglyToad.PdfPig

PdfPig se utiliza para inspeccion/validacion del PDF en tests,
no como generador del contrato.

### Tests backend

Tests relacionados con Eventos/Contrato:

- `42/42 OK`

Incluyen validaciones de:

- generacion de PDF
- content-type
- PDF no vacio
- datos del Evento
- datos del Cliente
- monto
- horario
- invitados
- observaciones
- aislamiento por sucursal
- Evento inexistente
- Evento cancelado
- generacion sin modificar Evento/DB

Nota:

El `dotnet test` completo mantiene 2 tests preexistentes fallando
en `UsuariosSubscriptionTest`, no relacionados con esta fase.

### Tests frontend

`EventosPage.test.tsx`

Resultado:

- `16/16 OK`

Se verifica:

- accion Contrato
- apertura
- impresion
- permisos de lectura
- generacion sin crear pagos
- generacion sin cambiar estado

Persisten warnings no bloqueantes de `act(...)`.

### Build

Backend:

- `dotnet build PosWeb/PosWeb.csproj`: OK
- `dotnet build PosWeb.Application.Test/PosWeb.Application.Test.csproj`: OK

Frontend:

- `npm run build`: OK

### Verificacion manual

Confirmado manualmente:

- abrir Evento: OK
- abrir Contrato: OK
- PDF generado correctamente: OK
- datos de Cliente: OK
- datos de Evento: OK
- visualizacion: OK
- impresion: OK
- funcionamiento desde PC: OK
- funcionamiento desde celular: OK

### Seguridad

El contrato respeta el aislamiento por sucursal.

La sucursal se obtiene desde JWT/claims.

No se puede indicar otra sucursal mediante query para acceder
al contrato de otro Evento.

### No incluido todavia

- firma digital
- almacenamiento permanente del contrato firmado
- versionado de contratos
- PagoEvento
- GastoEvento
- integracion financiera con Caja
- Mercado Pago
- QR

### No modificado

La fase NO modifica:

- regla de disponibilidad
- separacion de 30 minutos entre Eventos
- estados automaticos
- Caja
- Mercado Pago

### Proximo paso

Continuar puliendo Eventos antes de iniciar la parte financiera.

La firma digital puede implementarse posteriormente como una fase
independiente sobre esta base.
