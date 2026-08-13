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

## Fase 1B.4C - Pulido de Eventos

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1b4c-pulido-eventos-ok`

### Próximos eventos

- Se agregó una lista lateral de próximos eventos.
- Muestra como máximo 10 eventos.
- Se ordena por fecha y hora ascendente.
- No incluye eventos `Cancelado`.
- Incluye eventos de hoy que todavía no terminaron.
- Excluye eventos de hoy ya finalizados.
- Es independiente del mes que se visualiza en el calendario.
- El click abre el mismo detalle existente.
- Se actualiza después de crear, editar, cancelar y cambiar estado.
- La vista responde bien en PC y celular.
- No se creó backend nuevo para esta mejora.

### Simplificación de contrato

- En el detalle de Evento quedó una sola accion: `Ver contrato`.
- Se elimino de la interfaz `Imprimir contrato`.
- El usuario puede imprimir desde el visor PDF o el navegador.
- El endpoint y la generacion del PDF siguen intactos.
- `ContratoEventoPdfService` no fue modificado en esta mejora.
- El contrato sigue disponible normalmente.

### Detalle de Evento

- Se dejo de mostrar visualmente `Sucursal` en el detalle.
- El motivo es que actualmente el sistema trabaja con una sola sucursal.
- `sucursalId` sigue existiendo internamente.
- La seguridad y el aislamiento por sucursal siguen funcionando.
- No se modificaron claims ni backend por este ajuste visual.

### Validacion de fecha minima

- No se puede crear ni editar un Evento con fecha anterior a hoy.
- Ejemplo: si hoy es 10/08/2026, `09/08/2026` se rechaza, `10/08/2026` y `11/08/2026` se permiten.
- La regla backend quedo centralizada en `EventoService`.
- Usa `DateOnly.FromDateTime(DateTime.Today)` para tomar la fecha local del sistema.
- El mensaje de validacion es: `No se puede reservar un evento en una fecha anterior a hoy`.
- En frontend, el input de fecha usa `min` con la fecha de hoy.
- Ademas existe validacion antes de `POST` y `PUT`.
- La regla no depende solamente del navegador.
- Los eventos historicos siguen siendo consultables.
- Pueden abrirse en detalle, verse en calendario y abrir su contrato.
- Solo no pueden crearse ni guardarse con fecha pasada.

### Regla de disponibilidad

- No se modifico la regla existente de separacion minima de 30 minutos.
- Exactamente 30 minutos sigue permitido.
- Menos de 30 minutos sigue rechazado.
- `Cancelado` sigue sin bloquear.
- `eventoIdExcluir` sigue funcionando en edicion.

### Tests

- Backend: tests filtrados de Evento `49 passed`.
- Frontend: `EventosPage.test.tsx` `23 passed`.
- El test de `Próximos eventos` inicialmente tuvo timeout por `fake timers`.
- Se corrigio eliminando `fake timers` y usando fechas futuras relativas a `new Date()`.
- No se modifico funcionalidad productiva para hacer pasar el test.
- Persisten warnings no bloqueantes de `act(...)` en la suite frontend.

### Builds

- `dotnet build PosWeb/PosWeb.csproj`: OK
- `npm run build`: OK

### Verificacion manual

**PC**

- Próximos eventos: OK
- maximo 10: OK
- orden: OK
- Cancelados excluidos: OK
- click abre detalle: OK
- Sucursal oculta: OK
- solo Ver contrato: OK
- contrato PDF sigue funcionando: OK
- fecha pasada bloqueada: OK
- fecha de hoy permitida: OK
- edicion con fecha pasada bloqueada: OK

**Celular**

- visualizacion: OK
- Próximos eventos: OK
- detalle: OK
- contrato: OK
- selector y validacion de fecha: OK

### No modificado

Esta fase no toco:

- PagoEvento
- GastoEvento
- Caja
- Mercado Pago
- QR
- logica del contrato PDF
- reglas de roles
- aislamiento por sucursal
- algoritmo de disponibilidad de 30 minutos

### Proximo paso

Continuar con mejoras menores de Eventos si se consideran necesarias, o comenzar el diseño de la fase financiera:

- PagoEvento
- senas
- pagos parciales
- saldo
- Caja
- Mercado Pago
- QR
- cambios automaticos de estado

No se implementa ninguna de esas cosas en esta tarea.

## Fase 1C.1 - Datos basicos de Cliente para Eventos

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1c1-cliente-basico-ok`

### Alcance

- Cliente fue adaptado al sistema de Eventos.
- No se implementaron familiares todavia.
- La condicion de IVA dejo de mostrarse al usuario.
- Se mantiene internamente por compatibilidad usando `ConsumidorFinal`.

### Campos obligatorios

- Nombre
- Fecha de nacimiento
- Celular/Teléfono
- Email

### Campos opcionales

- DNI / numero de documento
- Domicilio

### Fecha de nacimiento

- Se agrego `FechaNacimiento`.
- El backend usa `DateOnly?`.
- La base de datos permite `null` para compatibilidad historica.
- En altas nuevas es obligatoria.
- En edicion es obligatoria.
- No puede ser futura.
- No se inventaron fechas para Clientes existentes.
- Los Clientes historicos sin `fechaNacimiento` siguen listandose.
- Tambien siguen consultandose.
- No rompen Eventos.
- Al editar, deben completar la fecha antes de guardar.

### Telefono

- Celular/Teléfono es obligatorio.
- No se permite `null`, vacio ni solo espacios.
- No se agrego validacion internacional compleja.
- Se conserva compatibilidad con telefonos existentes.
- Esto mantiene funcionando `Llamar` y `WhatsApp` desde el detalle de Evento.

### Email

- Email es obligatorio.
- Se valida formato.
- No puede estar vacio.

### DNI / Documento

- El numero de documento dejo de ser obligatorio.
- Permite `null` y vacio.
- No se generan DNIs ficticios.
- `TipoDocumento` se mantiene por compatibilidad.

### Domicilio

- Domicilio dejo de ser obligatorio.
- Permite `null` y vacio.
- No se asignan valores ficticios.

### IVA

- Se auditaron referencias legacy a `ivaCondicion`.
- No se elimino la propiedad ni la columna todavia.
- Se mantiene compatibilidad interna.
- Se oculta completamente del nuevo flujo de Cliente.
- No se pide en alta.
- No se pide en edicion.
- Internamente se usa `ConsumidorFinal`.
- La decision evita romper modulos legacy que todavia referencian el campo.

### Base de datos

- MySQL: `PosWeb/Migrations/20260811114658_UpdateClienteNacimientoContacto.cs`
- SQLite: `PosWeb/Migrations/Local/20260811114738_UpdateClienteNacimientoContacto.cs`
- Ambas agregan soporte para `fechaNacimiento`.
- Ambas preservan Clientes existentes.
- No inventan fechas.
- Ajustan la nullabilidad necesaria para campos opcionales.
- No crean todavia `FAMILIAR_CLIENTE`.
- No eliminan datos.
- Los snapshots quedaron actualizados para ambos providers.

### ClientesPage

- El formulario ahora muestra:
  - Nombre *
  - Fecha de nacimiento *
  - Celular / Teléfono *
  - Email *
  - Tipo documento
  - DNI / número de documento
  - Domicilio
- No muestra `Condición IVA`.
- Se agregaron validaciones inline.
- Se asociaron correctamente labels e inputs mediante `htmlFor` + `id`.
- IDs utilizados:
  - `cliente-nombre`
  - `cliente-fecha-nacimiento`
  - `cliente-telefono`
  - `cliente-mail`
  - `cliente-tipo-documento`
  - `cliente-numero-documento`
  - `cliente-domicilio`

### Cliente desde Nuevo Evento

- `Nuevo Evento -> Crear cliente nuevo` usa las mismas reglas.
- Obligatorio: Nombre, FechaNacimiento, Celular, Email.
- Opcional: DNI, Domicilio.
- IVA queda oculto.
- El Cliente creado sigue siendo un Cliente real y global del sistema.

### Compatibilidad legacy

- Se hicieron ajustes minimos de compatibilidad en pantallas legacy relacionadas con Cliente, incluyendo `VentasPage` y `VentaDialogs`.
- No se redisenio Ventas.
- No se modifico la logica de negocio de Ventas.

### Tests backend

- Nueva suite `ClienteServiceTests`.
- Ajustes en tests de Eventos que construyen `Cliente`.
- Comando: `dotnet test PosWeb.Application.Test/PosWeb.Application.Test.csproj --filter "FullyQualifiedName~Cliente|FullyQualifiedName~Evento"`
- Resultado combinado: `59 passed`.
- Build backend: `dotnet build PosWeb/PosWeb.csproj`: OK.

### Tests frontend

- `ClientesPage.test.tsx`: `6/6 OK`.
- Corrida combinada `ClientesPage + EventosPage`: `31/31 OK`.
- Build frontend: `npm run build`: OK.
- Los tests inicialmente fallaban porque los labels no estaban asociados semanticamente a sus inputs.
- Se corrigio el formulario con `htmlFor` + `id`.
- No se modificaron los tests para evitar el problema.

### Verificacion manual

- Alta Cliente con obligatorios: OK
- Alta sin DNI: OK
- Alta sin domicilio: OK
- IVA no visible: OK
- Fecha futura bloqueada: OK
- Email invalido bloqueado: OK
- Edicion Cliente: OK
- Creacion Cliente desde Nuevo Evento: OK
- Cliente aparece globalmente: OK
- Funcionamiento general: OK

### No incluido todavia

- familiares
- `FamiliarCliente`
- tabla `FAMILIAR_CLIENTE`
- cumpleaños de familiares
- recordatorios familiares

### No modificado

- disponibilidad de Eventos
- regla de 30 minutos
- estados de Evento
- contrato PDF
- `PagoEvento`
- `GastoEvento`
- `Caja`
- `Mercado Pago`
- `QR`

### Proximo paso

Proxima fase prevista: `Fase 1C.2 - Familiares de Cliente`.

Todavia no se implementa.

Conceptualmente incluiria:

- 0..N familiares por Cliente
- nombre
- fecha de nacimiento
- relacion 1:N

## Fase 1C.2A - Familiares de Cliente: backend y persistencia

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1c2a-familiares-backend-ok`

### Resumen

- Se agrego la entidad `FamiliarCliente`.
- La relacion quedo como `Cliente 1 -> N FamiliarCliente`.
- Un Cliente puede tener 0, 1 o varios familiares.
- Los familiares son opcionales.
- No se agrego UI de familiares.
- Esta fase solo cubre backend, persistencia y tests.

### Entidad

`FamiliarCliente` contiene solo:

- `ID_FAMILIAR_CLIENTE`
- `ID_CLIENTE`
- `NOMBRE`
- `FECHA_NACIMIENTO`

Validaciones:

- nombre obligatorio
- nombre no vacio
- fecha de nacimiento obligatoria
- fecha de nacimiento no futura

No se agrego:

- documento
- telefono
- mail
- parentesco
- observaciones

### Relacion

- `Cliente` tiene coleccion de familiares.
- Clientes existentes sin familiares siguen funcionando.
- Devuelven coleccion vacia.
- No necesitan datos ficticios.

### DeleteBehavior

- `DeleteBehavior = Cascade`
- Si un Cliente se elimina fisicamente, sus familiares se eliminan junto con el.
- No afecta la eliminacion logica mientras el Cliente siga fisicamente en la DB.

### DbSet y mapping

Se agrego `DbSet<FamiliarCliente>` en:

- `PosDbContext`
- `PosDbContextLocal`

Tabla:

- `FAMILIAR_CLIENTE`

PK:

- `PK_FAMILIAR_CLIENTE`
- sobre `ID_FAMILIAR_CLIENTE`

FK:

- `FK_FAMILIAR_CLIENTE_CLIENTE_ID_CLIENTE`
- hacia `CLIENTE(ID_CLIENTE)`

Indice:

- `IX_FAMILIAR_CLIENTE_ID_CLIENTE`

### Migracion MySQL

Migracion generada:

- `20260812222950_AddFamiliarCliente`

`Up()`:

- crea solo `FAMILIAR_CLIENTE`
- crea `ID_FAMILIAR_CLIENTE`
- crea `ID_CLIENTE`
- crea `NOMBRE`
- crea `FECHA_NACIMIENTO`
- crea PK
- crea FK
- crea indice

`Down()`:

- elimina solo `FAMILIAR_CLIENTE`

No modifica otras tablas.

### Migracion SQLite

Migracion generada:

- `20260812223033_AddFamiliarCliente`

`Up()`:

- crea solo `FAMILIAR_CLIENTE`
- crea PK
- crea FK
- crea indice

`Down()`:

- elimina solo `FAMILIAR_CLIENTE`

No modifica otras tablas.

### SQLite fisica

- La migracion SQLite fue aplicada correctamente a la DB fisica local con `dotnet ef database update --context PosDbContextLocal --project PosWeb --startup-project PosWeb`.
- Luego el backend arranco indicando que no habia migraciones pendientes.
- La base quedo actualizada.

### Backend

`ClienteDto` ahora incluye familiares.

`ClienteService` permite:

- crear Cliente sin familiares
- crear Cliente con familiares
- obtener Cliente con familiares
- editar familiares
- agregar familiares
- actualizar familiares
- eliminar familiares

Estrategia implementada:

- al crear o actualizar Cliente, se sincroniza la coleccion completa de familiares desde el DTO
- familiares con `Id` existente se actualizan
- familiares sin `Id` se crean
- familiares que no vienen en el DTO se eliminan de la coleccion y quedan cubiertos por cascada al persistir
- al consultar, los familiares se devuelven ordenados por `ID_FAMILIAR_CLIENTE`

### Snapshots

- `PosDbContextModelSnapshot` y `PosDbContextLocalModelSnapshot` quedaron actualizados y coherentes con las migraciones reales.
- Inicialmente los snapshots habian sido modificados manualmente, lo cual impedio que EF detectara una diferencia de modelo.
- Luego se corrigio generando las migraciones reales:
  - `20260812222950_AddFamiliarCliente`
  - `20260812223033_AddFamiliarCliente`

### Tests y build

- `dotnet build PosWeb/PosWeb.csproj`: OK
- `dotnet test PosWeb.Application.Test/PosWeb.Application.Test.csproj --filter "FullyQualifiedName~Cliente|FullyQualifiedName~Evento"`: `66 passed`, `0 failed`
- Verificacion especifica `ClienteServiceTests`: `17/17 OK`

### Backend en ejecucion

- El backend inicia correctamente despues de aplicar la migracion.
- Mensaje relevante: `Now listening on: http://0.0.0.0:5196`
- Mensaje relevante: `The database is already up to date.`

### Frontend

- No se modifico frontend en esta fase.
- Todavia no existe UI de familiares en `ClientesPage`.
- Todavia no existe boton `Agregar familiar`.
- Todavia no existen familiares en `Nuevo Evento`.
- Todavia no existe edicion visual de familiares.
- Eso corresponde a `Fase 1C.2B`.

### No modificado

- `EventoService`
- disponibilidad
- regla de 30 minutos
- regla de fechas de Evento
- `ContratoEventoPdfService`
- `PagoEvento`
- `GastoEvento`
- `Caja`
- `Mercado Pago`
- `QR`

### Proximo paso

Proxima fase prevista: `Fase 1C.2B - Familiares en frontend`.

Incluiria:

- mostrar familiares en Cliente
- agregar familiar
- editar familiar
- eliminar familiar
- nombre
- fecha de nacimiento
- integracion con Crear Cliente desde Nuevo Evento

## Fase 1C.2B - Familiares y administracion de Clientes en frontend

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1c2b-familiares-frontend-ok`

### Resumen

- Se agrego la administracion de familiares en `ClientesPage`.
- Un Cliente puede tener 0, 1 o varios familiares.
- La lista de Clientes quedo con scroll vertical propio.
- Se agrego reactivacion de Clientes inactivos desde la misma administracion.
- No se implementaron familiares en Nuevo Evento.

### Tipos frontend

- Se agrego/ajusto `FamiliarClienteDto`.
- `ClienteDto` ahora incluye `familiares`.
- Cada familiar contiene:
  - `id`
  - `nombre`
  - `fechaNacimiento`

### Alta de Cliente

- Se agrego la seccion `Familiares (opcional)`.
- Boton `Agregar familiar`.
- Cada fila permite:
  - Nombre
  - Fecha de nacimiento
  - Eliminar
- En alta, el familiar nuevo se maneja localmente.
- Eliminar no llama endpoint separado.
- El payload `POST` incluye la coleccion de familiares.
- Cliente sin familiares sigue siendo valido.

### Edicion de Cliente

- Al editar Cliente, se cargan familiares existentes mediante `GET /api/clientes/{id}`.
- Se muestran en el formulario.
- Pueden editarse.
- Pueden agregarse nuevos.
- Pueden eliminarse.
- La coleccion completa se envia en `PUT`.
- El familiar existente conserva su `id`.
- El familiar nuevo usa `id` compatible con backend.
- El familiar eliminado se omite del payload final.

### Validaciones de familiar

- Nombre obligatorio.
- Nombre con `trim`.
- Nombre no vacio.
- Fecha de nacimiento obligatoria.
- Fecha de nacimiento no futura.
- `input[type=date]` usa `max = hoy local`.
- Mensajes frontend claros.
- No se agregaron:
  - DNI
  - telefono
  - mail
  - parentesco
  - observaciones

### Accesibilidad

- Los campos de familiares usan `id` unicos y `htmlFor`.
- Ejemplos:
  - `familiar-0-nombre`
  - `familiar-0-fecha`
- No se repiten IDs entre filas.

### Responsive

- En PC, los campos pueden mostrarse en 2 columnas si hay espacio.
- En celular, los campos se apilan.
- El boton Eliminar sigue accesible.
- No se genero scroll horizontal nuevo.
- El modal mantiene scroll interno.

### Scroll de lista de Clientes

- La tabla/lista tiene scroll vertical propio.
- Contenedor con `overflow-y-auto`.
- `max-h-[calc(100vh-19rem)]`.
- Encabezado sticky con `sticky top-0`.
- Fondo del encabezado con `bg-gray-50`.
- Buscador queda fuera del area scrolleable.
- Boton `Nuevo cliente` queda fuera del scroll y visible.
- No se modificaron columnas ni logica de negocio.

### Reactivacion de Clientes

- Se resolvio que un Cliente podia desactivarse pero no reactivarse.
- Antes:
  - `DELETE /api/clientes/{id}`
  - `cliente.Desactivar()`
  - `ACTIVO = false`
- La entidad ya tenia `cliente.Activar()`, pero no habia endpoint/servicio expuesto.
- Se agrego endpoint:
  - `POST /api/clientes/{id}/reactivar`

### Administracion activo/inactivo

- Cliente activo:
  - estado `Activo`
  - accion `Desactivar`
- Cliente inactivo:
  - estado `Inactivo`
  - accion `Reactivar`
- Despues de Reactivar:
  - mismo ID
  - mismos datos
  - mismos familiares
  - `Activo = true`
  - la lista se refresca
- No se crea Cliente nuevo.
- No se elimina fisicamente.

### Clientes inactivos y Eventos

- `ClientesPage` administrativa puede mostrar clientes inactivos para permitir reactivacion.
- Otros consumidores mantienen el listado normal.
- Por lo tanto, los clientes inactivos no quedan disponibles para nuevas reservas mientras siguen inactivos.
- No se modifico `EventosPage`.

### Familiares y desactivacion

- Desactivar Cliente NO elimina familiares.
- Reactivar Cliente conserva:
  - datos del Cliente
  - ID
  - familiares asociados

### Permisos

- Desactivar/Reactivar mantiene permisos de `ClientesController`:
  - `SuperAdmin`
  - `Admin`

### Tests frontend

- `ClientesPage.test.tsx`
- Resultado final: `24 passed / 0 failed`
- Cobertura incluye:
  - seccion Familiares
  - agregar familiar
  - varios familiares
  - eliminar familiar
  - validaciones
  - payload POST
  - payload PUT
  - edicion
  - scroll
  - Cliente activo muestra Desactivar
  - Cliente inactivo muestra Reactivar
  - reactivacion
  - conservacion de familiares
  - cliente inactivo visible en administracion

- Build frontend:
  - `npm run build`
  - OK

### Backend

- Ajuste minimo para reactivacion:
  - `ClienteService`
  - `ClientesController`
  - endpoint `POST /api/clientes/{id}/reactivar`
- No hubo cambios de DB ni migraciones.
- La funcionalidad backend fue probada manualmente y funciona.

### Verificacion manual

- Cliente sin familiares: OK
- Cliente con familiar: OK
- Cliente con varios familiares: OK
- edicion familiar: OK
- agregar familiar en edicion: OK
- eliminar familiar: OK
- persistencia despues de recargar: OK
- scroll de Clientes: OK
- Activo -> Desactivar: OK
- Inactivo -> Reactivar: OK
- familiares se conservan: OK
- funcionamiento general: OK

### No modificado

- DB schema
- migraciones
- `EventoService`
- disponibilidad
- regla de 30 minutos
- contrato PDF
- `PagoEvento`
- `GastoEvento`
- `Caja`
- `Mercado Pago`
- `QR`

## Fase 1C.2C - Familiares al crear Cliente desde Nuevo Evento

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1c2c-familiares-desde-evento-ok`

### Alcance

- Se documento el cierre del subflujo `Eventos -> Nuevo Evento -> Crear cliente nuevo`.
- El modal `Nuevo Cliente` ahora permite cargar `Familiares (opcional)`.
- Se mantienen 0, 1 o varios familiares.

### Flujo conservado

- Se abre el modal `Crear cliente nuevo` desde `Nuevo Evento`.
- Se cargan los datos del Cliente.
- Se puede cancelar sin perder los datos del Evento.
- Al crear el Cliente:
  - se guarda como Cliente real/global
  - vuelve al Evento
  - queda seleccionado automaticamente
  - los datos ya cargados del Evento se conservan
- Agregar familiares no altera ese flujo.

### Familiares en el modal

- Se agrego la seccion `Familiares (opcional)`.
- Accion disponible: `Agregar familiar`.
- Cada fila permite:
  - `Nombre`
  - `Fecha de nacimiento`
  - `Eliminar`

### Validaciones

- Nombre familiar:
  - obligatorio si existe la fila
  - `trim`
  - no vacio
- Fecha nacimiento familiar:
  - obligatoria
  - no futura
- Input:
  - `type=date`
  - `max=hoy local`
- No se agregaron:
  - DNI
  - telefono
  - mail
  - parentesco
  - domicilio
  - observaciones

### Payload

- `api.clientes.crear(...)` recibe los datos normales del Cliente y la coleccion `familiares`.
- Ejemplo conceptual:
  - `familiares: [{ id: 0, nombre: "Juan", fechaNacimiento: "2015-05-10" }]`
- Sin familiares, el Cliente sigue pudiendo crearse normalmente.

### Bug encontrado y corregido

- Durante la prueba manual, la fecha de nacimiento del Cliente principal se veia cargada, pero al crear desde Eventos aparecia un error indicando que faltaba.
- Causa exacta: `guardarNuevoCliente()` usaba `clienteCreateForm.fechaNacimiento` sin normalizar antes de validar y enviar.
- Solucion: normalizacion con `toDateInputValue(...)` antes de la validacion, la construccion del payload y el POST.
- Resultado: la fecha enviada queda en formato `YYYY-MM-DD`.

### Cliente vs familiares

- El bug de fecha correspondia al Cliente principal.
- No fue causado por la fecha del familiar.
- Adicionalmente se corrigio un problema secundario de React con keys de familiares usando `id: 0` fijo.

### Preservacion de datos

- Al agregar o eliminar familiares:
  - no se pierde `fechaNacimiento` del Cliente
  - no se pierden datos del Evento
- Al cancelar la creacion del Cliente:
  - el Evento conserva sus datos
  - los familiares temporales se descartan
- Si backend rechaza el Cliente:
  - el modal permanece abierto
  - se conservan los datos del Cliente
  - se conservan los familiares
  - se conserva el Evento de fondo

### Doble click

- Se mantiene la proteccion existente contra doble creacion.
- Durante el POST del Cliente:
  - el boton queda bloqueado
  - no se crean duplicados

### Responsive

- PC: la seccion Familiares es usable dentro del modal.
- Celular: Nombre y Fecha se apilan, Eliminar sigue accesible, el modal mantiene scroll interno y no se agrego scroll horizontal.

### Tests

- `EventosPage.test.tsx`: `29 passed`
- Cobertura: seccion Familiares visible, Agregar familiar, Cliente sin familiares, Cliente con familiar, varios familiares, eliminar familiar, nombre vacio, fecha vacia, fecha futura, `max=hoy`, payload con familiares, fechaNacimiento real del Cliente en payload, datos del Evento conservados, Cliente auto-seleccionado, cancelar conserva Evento, error backend conserva formulario/familiares, doble click, no se crea Evento automaticamente.

### Build

- `npm run build`
- `OK`

### Verificacion manual

- Nuevo Evento -> cargar datos Evento -> Crear cliente nuevo -> cargar fecha de nacimiento -> agregar familiar -> Crear Cliente.
- Resultado:
  - Cliente creado correctamente
  - familiar guardado
  - no aparece error falso de fecha faltante
  - Cliente queda seleccionado automaticamente
  - datos del Evento se conservan
  - flujo funciona correctamente

### No modificado

- backend
- DB
- migraciones
- `ClienteService`
- `ClientesController`
- `EventoService`
- disponibilidad
- regla de 30 minutos
- contrato PDF
- `PagoEvento`
- `GastoEvento`
- `Caja`
- `Mercado Pago`
- `QR`

### Proximo paso

Continuar con mejoras menores de Clientes/Eventos si se consideran necesarias, o comenzar fase financiera.

## Fase 1C.3A - Celular normalizado para Clientes y WhatsApp

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1c3a-telefono-normalizado-ok`

### Alcance

- Se actualizo la carga del celular de Cliente para usar un selector de codigo de area argentino y un campo de numero local.
- El codigo predeterminado para nuevos Clientes es `+54 9 11`.
- El telefono sigue guardandose normalizado como un unico string en el payload.

### Codigos soportados

- `+54 9 11`
- `+54 9 221`
- `+54 9 223`
- `+54 9 261`
- `+54 9 264`
- `+54 9 299`
- `+54 9 341`
- `+54 9 342`
- `+54 9 343`
- `+54 9 351`
- `+54 9 362`
- `+54 9 376`
- `+54 9 379`
- `+54 9 381`
- `+54 9 387`
- `+54 9 388`

### Helper centralizado

- La normalizacion y parseo quedaron centralizados en `frontend/src/utils/phone.ts`.
- Funciones relevantes:
  - `sanitizePhoneDigits`
  - `parseArgentinaPhone`
  - `buildArgentinaPhone`
  - `buildWhatsAppHref`
  - `buildTelHref`
  - `getArgentinaPhoneLocalDigits`
  - `limitArgentinaPhoneLocalDigits`

### Cantidad de digitos

- Area `11`: `8` digitos locales.
- Otros codigos soportados: `7` digitos locales.
- El texto de ayuda y el placeholder cambian segun el codigo seleccionado.

### Validacion

- El celular sigue siendo obligatorio.
- El codigo de area sigue siendo obligatorio.
- El numero local sigue siendo obligatorio.
- Se normalizan espacios y guiones al escribir.
- Se cuenta la cantidad real de digitos.
- Si la cantidad no coincide, se muestra `El número debe tener X dígitos`.
- No permite guardar mientras el valor sea invalido.

### Clientes nuevos

- `Clientes -> Nuevo Cliente` muestra por defecto `+54 9 11`.
- El usuario ingresa solo el numero local.
- El payload final guarda el telefono completo y normalizado.

### Edicion

- Los Clientes existentes reconocidos se parsean automaticamente.
- Ejemplo: `5491112345678` se muestra como `+54 9 11` + `12345678`.
- Otros codigos conocidos se seleccionan automaticamente.

### Telefonos historicos

- Se corrigio un bug donde un telefono historico no reconocido podia ser prefijado de forma incorrecta al reabrir Editar y Guardar.
- `parseArgentinaPhone` ahora informa `recognized`.
- `ClientesPage` mantiene estado `raw` y `custom` para preservar telefonos historicos no reconocidos.
- Si el usuario no modifica un telefono historico no reconocido, se vuelve a guardar exactamente igual.
- Si el usuario modifica el telefono, se pasa a modo custom y se normaliza con el codigo seleccionado.

### WhatsApp

- Un telefono normalizado como `5491112345678` genera `https://wa.me/5491112345678`.
- No se uso WhatsApp Business API.
- No se agrego mensaje automatico.
- No se agrego verificacion previa de cuenta.

### Llamar

- Un telefono normalizado como `5491112345678` genera `tel:+5491112345678`.
- Se mantiene el flujo de Llamar existente.

### Eventos

- La misma carga de celular se aplica en `Nuevo Evento -> Crear cliente nuevo`.
- Se mantienen familiares, fecha de nacimiento, auto-seleccion del Cliente y datos del Evento.

### Familiares

- Los familiares no fueron modificados funcionalmente.
- Siguen teniendo solo `nombre` y `fecha de nacimiento`.
- No tienen telefono.

### Tests

- Corrida final: `3` test files, `71` tests passed, `0` failed.
- Cobertura relevante:
  - default `+54 9 11`
  - normalizacion
  - cambio de codigo
  - cantidad dinamica de digitos
  - numero corto/largo
  - edicion
  - telefonos historicos
  - WhatsApp
  - Llamar
  - creacion desde Evento

### Build

- `npm run build`: `OK`
- Solo hubo warning no bloqueante de chunk grande de Vite.

### Verificacion manual

- `+54 9 11`: OK
- Otro codigo de area: OK
- Cantidad dinamica de digitos: OK
- Validacion: OK
- WhatsApp: OK
- Llamar: OK
- Creacion Cliente: OK
- Creacion Cliente desde Evento: OK
- Funcionamiento general: OK

### No modificado

- backend
- DB
- migraciones
- `ClienteService`
- `ClientesController`
- `EventoService`
- disponibilidad
- regla de 30 minutos
- contrato PDF
- `Caja`
- `PagoEvento`
- `GastoEvento`
- `Mercado Pago`
- `QR`

### Proximo paso

- Siguiente mejora visual sugerida: ocultar el nombre de sucursal actual y la opcion `Cambiar sucursal` porque el sistema usa una unica sucursal.
- Solo ocultar UI, sin eliminar logica de sucursal, claims ni `sucursalId`.

## Fase 1C.3B - Simplificacion de sucursal y branding Gestor de Eventos

**Estado:** COMPLETADA  
**Tag Git previsto:** `fase-1c3b-branding-gestor-eventos-ok`

### Alcance

- Esta fase realizo dos mejoras exclusivamente visuales:
  - simplificacion de la interfaz para una unica sucursal
  - cambio del branding visible de `PosWeb` / `Punto de Venta` a `Gestor de Eventos`
- No se modifico la arquitectura interna de sucursales.

### Sucursal

- En `Layout` se ocultaron visualmente:
  - el nombre de la sucursal actual, por ejemplo `Sucursal Central`
  - la accion/opcion `Cambiar sucursal`
- Esto aplica para:
  - `SuperAdmin`
  - `Admin`
  - `UsuarioComun`
- Solo dejaron de renderizarse visualmente.
- Continuan intactos:
  - `sucursal`
  - `sucursalId`
  - `useSucursalActiva`
  - `cambiar`
  - `limpiar`
  - `Outlet context`
  - filtrado interno por sucursal
  - claims
  - JWT
- El sistema sigue soportando tecnicamente su arquitectura de sucursales.

### Branding visible

- El nombre visible de la aplicacion paso a ser `Gestor de Eventos`.
- El nombre tecnico interno sigue siendo `PosWeb`.
- No se renombraron:
  - solucion
  - proyectos .NET
  - namespaces `PosWeb.*`
  - carpetas
  - rutas API
  - DB
  - migraciones
  - identificadores internos

### Layout

- Antes:
  - `PW`
  - `PosWeb`
  - `Punto de Venta`
- Ahora:
  - `GE`
  - `Gestor de Eventos`
  - `Gestor de Eventos`
- Especificamente:
  - recuadro/logo textual: `PW -> GE`
  - branding lateral: `PosWeb -> Gestor de Eventos`
  - `h1` principal: `Punto de Venta -> Gestor de Eventos`
- Ademas:
  - `Sucursal Central` ya no se muestra
  - `Cambiar sucursal` ya no se muestra
- No se modifico la navegacion ni el comportamiento funcional del Layout.

### Navegador

- `frontend/index.html` actualizo el `title` visible de `PosWeb` a `Gestor de Eventos`.
- Resultado:
  - `<title>Gestor de Eventos</title>`

### App e Inicio

- Se actualizaron referencias visibles al branding viejo en:
  - `frontend/src/App.tsx`
  - `frontend/src/pages/InicioPage.tsx`
- Incluye el texto visible de inicio/carga correspondiente.
- No se modifico la logica funcional de `App` ni de `Inicio`.

### Ticket

- `frontend/src/pages/venta/TicketResultado.tsx` tenia un fallback visible con el branding anterior.
- Se actualizo unicamente ese branding visible a `Gestor de Eventos`.
- No se modifico la logica de ventas ni la generacion funcional del ticket.

### PWA

- `frontend/vite.config.ts` quedo con el manifest PWA:
  - `name: Gestor de Eventos`
  - `short_name: Gestor Eventos`
- No se creo una PWA nueva.
- No se agregaron dependencias.

### Tauri

- `frontend/src-tauri/tauri.conf.json` actualizo unicamente branding visible:
  - `productName: Gestor de Eventos`
  - `title: Gestor de Eventos`
- Se mantiene intacto el identificador tecnico `com.posweb.app`.

### Login

- Login fue auditado.
- No contenia branding `PosWeb` visible que requiriera modificacion.
- Autenticacion quedo intacta.

### Tests

- Verificacion relevante:
  - `npx.cmd vitest run src/components/__tests__/Layout.test.tsx src/App.test.tsx`
- Resultado:
  - `2` test files passed
  - `6` tests passed
  - `0` failed
- Cobertura relevante:
  - `Gestor de Eventos` visible
  - `GE` visible
  - branding anterior eliminado de las ubicaciones modificadas
  - nombre de sucursal no visible
  - `Cambiar sucursal` no visible
  - modulos por rol continúan visibles segun reglas existentes
  - `Salir` continua funcionando

### Build final

- `npm.cmd run build`
- Resultado: `OK`
- Datos relevantes:
  - TypeScript build OK
  - Vite build OK
  - 1860 modulos transformados
  - PWA `generateSW` OK
  - `dist/sw.js` generado
  - `dist/workbox` generado
- Warning no bloqueante:
  - chunk principal mayor a 500 kB despues de minificacion
- Queda como optimizacion futura y no como error de esta fase.

### Prueba visual

- Se verifico visualmente la interfaz.
- Resultado esperado/final:
  - `GE` visible en lugar de `PW`
  - `Gestor de Eventos` visible en lugar de `PosWeb`
  - `Gestor de Eventos` visible en lugar de `Punto de Venta`
  - `Sucursal Central` oculta
  - `Cambiar sucursal` oculto
  - Layout/header sin cambios funcionales

### No modificado

- backend
- DB
- migraciones
- `ClienteService`
- `ClientesController`
- `EventoService`
- disponibilidad
- regla de 30 minutos
- familiares
- telefonos
- WhatsApp
- Llamar
- contrato PDF funcionalmente
- autenticacion
- JWT
- claims
- `sucursalId`
- `Caja`
- `PagoEvento`
- `GastoEvento`
- `Mercado Pago`
- `QR`

### Nombre tecnico

- El producto visible ahora se llama `Gestor de Eventos`.
- El nombre tecnico interno continua siendo `PosWeb`.
- Esto es intencional para evitar un refactor innecesario y riesgoso.

### Optimizacion futura

- Revisar code splitting del frontend porque Vite informa que el chunk principal supera 500 kB minificado.
- No implementar esa optimizacion en esta tarea.

## Fase 1B.4D - Contacto rapido del Cliente

**Estado:** COMPLETADA
**Tag Git previsto:** `fase-1b4d-contacto-cliente-ok`

### Contacto rapido

- Desde el detalle de un Evento se agregaron dos acciones: `Llamar` y `WhatsApp`.
- El telefono se obtiene del Cliente real asociado al Evento.
- No se duplico el telefono dentro de `Evento`.
- Estas acciones estan disponibles para cualquier usuario que tenga permiso para visualizar el Evento.
- No son acciones administrativas.
- No se modificaron roles ni autorizacion backend.

### Llamar

- Boton `Llamar`.
- Utiliza enlace `tel:`.
- En celular abre el marcador o la aplicacion de llamadas.
- No inicia una llamada automaticamente.
- En PC delega en la aplicacion disponible para manejar enlaces `tel:`.

### WhatsApp

- Boton `WhatsApp`.
- Utiliza enlace `wa.me`.
- Abre el contacto o chat correspondiente.
- Funciona desde celular.
- Puede abrir WhatsApp Web o la app en PC segun el entorno.
- No se implemento WhatsApp Business API.
- No se implemento envio automatico de mensajes.
- No se implemento verificacion previa de si el numero posee WhatsApp.
- Si el numero no tiene WhatsApp, la propia plataforma se encarga de informarlo.

### Normalizacion

- `sanitizePhoneInput` hace `trim()` y elimina todo excepto digitos y `+`.
- Para `tel:`:
  - si el valor empieza con `+`, se conserva tal cual
  - si no, se eliminan los caracteres no numericos y se usan solo digitos
- Para `wa.me`:
  - se eliminan todos los caracteres no numericos
  - si los digitos empiezan con `54`, se usan asi
  - si el valor sanitizado empezaba con `+`, se usan solo los digitos
  - si los digitos empiezan con `00`, se quitan esos dos ceros
  - si el numero tiene 10 u 11 digitos y no trae prefijo internacional, se antepone `54`
  - en cualquier otro caso se usa el numero resultante sin mas transformaciones

### Cliente sin telefono

- Si el Cliente no tiene telefono, o el campo esta vacio o contiene solo espacios, no se muestran los botones de contacto.
- En ese caso se muestra `Cliente sin teléfono registrado.`
- Si falla la carga del Cliente, se muestra `Las acciones de contacto no están disponibles.` y tampoco se muestran botones.

### Responsive y verificacion

- Se verifico manualmente el flujo en el detalle del Evento.
- En celular: `Evento -> Detalle -> Llamar` abre el marcador.
- En celular: `Evento -> Detalle -> WhatsApp` abre WhatsApp o el chat correspondiente.
- En PC, el comportamiento depende de la aplicacion disponible para manejar `tel:` y del navegador o aplicacion que maneje `wa.me`.
- La funcionalidad fue validada manualmente y funciona correctamente.

### No modificado

- backend
- base de datos
- migraciones
- `EventoService`
- disponibilidad
- regla de separacion de 30 minutos
- validacion de fechas
- contrato PDF
- `PagoEvento`
- `GastoEvento`
- `Caja`
- `Mercado Pago`
- `QR`
- no se agregaron dependencias nuevas

### Proximo paso

- Continuar con pequenas mejoras de Eventos, o
- comenzar la fase financiera:
  - `PagoEvento`
  - senas
  - pagos parciales
  - saldo
  - `Caja`
  - `Mercado Pago`
  - `QR`
  - cambio automatico de estado

No se implementa ninguna de esas cosas en esta tarea.
