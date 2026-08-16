# Entrega: feature flags por negocio y composición dinámica

**Proyecto:** ANC Platform Core  
**Repositorio:** `alexisnegrocalderon/ANC.digital-platform`  
**Fecha:** 16 de agosto de 2026  

## Resultado

El admin de ANC Platform ahora permite componer cada plataforma cliente desde el mismo core. El administrador selecciona un negocio, escoge un preset de rubro o marca módulos individuales, revisa dependencias y aplica la configuración con un clic. La activación queda persistida en `business_modules` y el runtime consulta ese estado por negocio.

La plataforma activa de eventos permanece separada y sin modificaciones.

## Funcionalidades implementadas

| Capacidad | Implementación |
|---|---|
| Catálogo por negocio | `admin.modules.catalog` entrega 20 módulos, madurez, dependencias, setup y flags actuales. |
| Aplicación de preset | `admin.presets.list` y `admin.presets.applyPreset` arman un paquete sectorial y resuelven dependencias. |
| Activación manual | `admin.businessModules.enable` activa la selección ordenada por dependencias. |
| Desactivación | `admin.businessModules.disable` rechaza dependencias activas y conserva historial. |
| Configuración | `admin.businessModules.updateSettings` valida settings según el manifest. |
| Idempotencia | `module_flag_operations` garantiza una operación única por negocio e idempotency key. |
| Auditoría | Activaciones, desactivaciones y settings guardan actor, negocio, módulo, operación y key. |
| Health | `admin.businessModules.health` muestra estado derivado por módulo. |
| Guards runtime | Eventos, Pagos, Reservas y Notificaciones bloquean tRPC si su flag no está habilitado. |
| UI | `ModuleAdminPanel` ofrece preset, selección, plan, dependencias y acciones de un clic. |

## Flujo comercial recomendado

Primero se crea o selecciona el negocio en el admin. Luego se aplica un preset, por ejemplo `restaurant`, para obtener una base funcional con las dependencias requeridas. El administrador puede ajustar la selección individual, revisar el plan topológico y aplicar el cambio. Después debe completar el checklist de setup de cada módulo y revisar el estado de health antes de entregar el tenant al cliente.

La operación técnica no exige generar un nuevo bundle ni copiar una repo. El mismo despliegue sirve a todos los clientes; el negocio activo, sus memberships y sus feature flags determinan qué puede ver y usar cada tenant.

## Reglas de seguridad

El frontend nunca es la autoridad para habilitar un módulo. Cada mutación revalida permisos de `platform_admin`, key registrada, madurez permitida y dependencias. Los routers de módulos usan `moduleEnabledProcedure`, por lo que ocultar un botón o manipular una petición no permite usar un módulo apagado.

La query string `admin_modules=1` solo habilita una vista de preview en desarrollo. No concede permisos. En producción el panel admin exige autenticación y rol global `platform_admin`.

## Migración Neon

La migración `drizzle/migrations/0006_groovy_sheva_callister.sql` crea `module_flag_operations` con unicidad `(business_id, idempotency_key)`, referencias a negocio y actor, módulos solicitados/resueltos y resultado JSONB. La tabla fue aplicada y verificada en el proyecto Neon separado de ANC Platform Core.

## Validaciones

| Validación | Resultado |
|---|---|
| Tests unitarios | 40 tests aprobados en 12 archivos. |
| TypeScript | `pnpm run check` aprobado. |
| Build | `pnpm run build` aprobado. |
| Migración Neon | Tabla e índices únicos verificados en Neon. |
| Guards runtime | Tests de módulo activo/desactivado aprobados. |
| Preview visual | Presets, selector de negocio, 20 módulos y plan de activación visibles. |
| Secret scan | Sin credenciales fuera de `.env` local y placeholders documentales. |

## Estado real de módulos

La administración permite catalogar los 20 módulos, pero la madurez sigue siendo una regla comercial importante. `payments`, `reservations` y `notifications` están en `implemented-hardening`; `ticketing`, `orders` y `access` tienen implementación parcial; otros módulos permanecen en `contract-ready`, `scaffolded` o `planned`. Los módulos no implementados no se pueden activar desde `admin.businessModules.enable`; el catálogo los muestra para planificación, no como producto listo.

## Próximas mejoras

El siguiente incremento debería añadir `business_entitlements` para vincular módulos a planes comerciales, límites de usuarios/sucursales/transacciones y fechas de vigencia. Después conviene añadir permisos finos por módulo, rollout gradual, modo de solo lectura para módulos archivados y un onboarding de negocio que aplique preset, branding, memberships y checklist en una sola transacción de preparación.
