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

## Proximo paso

**Fase 1A.2:** persistencia EF Core + migraciones + API de Eventos.
