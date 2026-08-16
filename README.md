# ANC Platform

**ANC Platform** es el núcleo modular para construir plataformas digitales personalizadas para distintos negocios sin volver a copiar y adaptar una aplicación completa por cliente. El repositorio contiene el frontend, el backend, los contratos tRPC, el esquema PostgreSQL de Neon, el registro de módulos, los presets sectoriales y el primer vertical funcional de Eventos.

> La regla de arquitectura es simple: **un core estable, módulos activables y configuración por negocio**. El repositorio activo de la productora de eventos se conserva como referencia protegida y no es un destino de cambios.

## Estado actual

| Área | Estado |
|---|---|
| Core React + Express + tRPC | Implementado y compilando. |
| Neon PostgreSQL + Drizzle | Conectado al proyecto Neon separado de Danceroom y migrado. |
| Multi-negocio | Esquema base con `businesses`, `users`, `memberships` y contexto por negocio. |
| Registro modular | 20 módulos declarados con dependencias, permisos, navegación y presets. |
| Vertical Eventos | Eventos, entradas, pedidos, tickets, checkout demo y validación de acceso. |
| Autenticación productiva | Manus OAuth, sesión JWT HttpOnly, memberships activas y roles server-side implementados; falta configurar credenciales del entorno productivo. |
| Pagos | Stripe Checkout Sessions y MercadoPago Checkout Pro con webhooks firmados, idempotencia local y estados persistidos. |
| Skills modulares | 20 skills `modulo-*` creadas y validadas; `modulo-whatsapp` se conserva como skill transversal. |
| Admin de módulos | Catálogo por negocio, grupos, madurez, dependencias, setup, plan de activación, health y auditoría. |

## Puesta en marcha local

Requiere Node.js, pnpm y un proyecto Neon. Instala dependencias con `pnpm install`, copia `.env.example` a `.env` y configura `DATABASE_URL` con la URL pooled de Neon y `DIRECT_DATABASE_URL` con la URL directa para migraciones. El archivo `.env` está ignorado por Git y nunca debe enviarse al repositorio.

```bash
pnpm install
pnpm run db:migrate
pnpm run seed:core
pnpm run seed:events
pnpm run publish:demo-event
pnpm run dev
```

Durante la etapa local, el frontend puede consultar el negocio demo `anc-demo` mediante un header de desarrollo. El backend lo acepta solamente cuando `NODE_ENV` no es `production` y `DEV_BUSINESS_CONTEXT_ENABLED=true`. En producción el header solo selecciona un negocio que el backend confirma contra una membership activa; no concede acceso por sí mismo. El panel admin exige `platform_role=platform_admin`.

## Comandos principales

| Comando | Propósito |
|---|---|
| `pnpm run check` | Validar TypeScript sin emitir archivos. |
| `pnpm test` | Ejecutar pruebas unitarias de registro, activación y configuración segura. |
| `pnpm run build` | Compilar frontend Vite y backend Express. |
| `pnpm run neon:smoke` | Confirmar conectividad real con Neon sin mostrar credenciales. |
| `pnpm run payments:schema-smoke` | Confirmar que las tablas de pagos existen en Neon. |
| `pnpm run payments:webhook-smoke` | Probar webhook Stripe firmado, procesamiento y duplicado idempotente. |
| `pnpm run db:generate` | Generar migraciones desde `drizzle/schema.ts`. |
| `pnpm run db:migrate` | Aplicar migraciones usando `DIRECT_DATABASE_URL`. |
| `pnpm run seed:core` | Sincronizar el catálogo de 20 módulos y crear `anc-demo`. |
| `pnpm run seed:events` | Crear el evento y ticket demo de la vertical Eventos. |
| `pnpm run publish:demo-event` | Publicar el evento demo de forma idempotente. |
| `pnpm run modules:catalog-validate` | Comprobar que el documento y el registry contienen los mismos 20 módulos. |

## Arquitectura

El core vive en `server/`, `shared/`, `drizzle/` y `modules/core/`. El contrato de módulo está definido en `shared/module.ts`; el registro central y los presets están en `modules/core/registry.ts`; la resolución de dependencias está en `modules/core/activation.ts`; y la persistencia de activaciones utiliza `business_modules`.

Cada módulo nuevo debe mantener sus servicios, router, esquema específico, pantallas y pruebas en su propio directorio. Las tablas de negocio deben incluir `businessId`, los importes deben usar enteros y moneda explícita, y las operaciones críticas deben generar auditoría o eventos de dominio. El core no debe conocer reglas particulares de eventos, restaurantes, gimnasios o servicios profesionales.

Cada módulo también tiene una skill reutilizable en `/home/ubuntu/skills/modulo-*/SKILL.md`. La skill guía la implementación; el runtime se acopla mediante `ModuleManifest`, `modules/core/registry.ts`, `business_modules` y los routers del módulo. El panel admin está integrado en `ModuleAdminPanel` y `MembershipAdminPanel`, y usa `admin.modules.*`, `admin.businessModules.*`, `admin.memberships.*` y `admin.audit.moduleChanges`. La autenticación usa `server/auth.ts`, `/api/auth/login`, `/api/oauth/callback`, `auth.me` y `auth.logout`.

## Módulos declarados

El registro inicial contiene `catalogue`, `pricing`, `orders`, `payments`, `pos`, `inventory`, `billing`, `crm`, `campaigns`, `loyalty`, `notifications`, `reviews`, `reservations`, `access`, `ticketing`, `wallet`, `delivery`, `branches`, `reporting` y `automations`. No todos tienen todavía tablas y pantallas específicas; el registro ya permite modelar sus dependencias y habilitarlos como capacidad de negocio, mientras la implementación se completa por prioridad comercial.

Los presets disponibles son `events`, `restaurant`, `salon`, `retail`, `gym` y `services`. Un preset se resuelve a un plan de activación que incluye dependencias antes de insertar `business_modules`. La activación no elimina historial cuando un módulo se desactiva.

## Neon y mantenimiento

ANC Platform usa un proyecto Neon separado para no tocar la base archivada de Danceroom. El runtime usa el endpoint pooled y Drizzle Kit usa el endpoint directo. El plan Free de Neon es apropiado para desarrollo, demos y negocios pequeños dentro de sus límites publicados, pero no debe venderse como operación productiva ilimitada; el almacenamiento, cómputo, transferencia, ramas y backups deben monitorearse antes de escalar clientes.[1] [2]

Para reducir mantenimiento, la aplicación se mantiene como monolito modular tipado, las migraciones se versionan junto al código, los seeds son reproducibles y el deployment puede usar un único servicio web más Neon. Cuando existan clientes con mayor volumen o necesidades de aislamiento, se podrá usar un proyecto Neon por cliente sin cambiar los contratos del core.

## Verificación realizada

El proyecto pasó `pnpm test`, `pnpm run check`, `pnpm run build`, `pnpm run neon:smoke`, `pnpm run payments:schema-smoke` y `pnpm run payments:webhook-smoke`. También se verificó que una firma Stripe inválida devuelve `401`, que el primer webhook actualiza la orden a `paid` y que un evento repetido devuelve `200` sin repetir efectos. El runtime tRPC contra Neon continúa leyendo el negocio demo, sus módulos y el vertical Eventos desde la base.

## Pendientes antes de producción

Antes de producción se deben configurar `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `JWT_SECRET` y los dominios HTTPS autorizados. También se debe promover el primer usuario a `platform_admin` mediante un procedimiento operativo protegido, no desde el frontend. Faltan pruebas sandbox reales de cada cuenta; resolver la ventana de fallo de red específica de MercadoPago Preferences API mediante Orders API o consulta/reconciliación; añadir reserva atómica de stock, QR firmado, rate limiting, observabilidad, backups y pruebas de integración sobre una branch aislada de Neon. Stripe y MercadoPago no deben considerarse activos hasta configurar sus secretos y URLs HTTPS en cada negocio.

## Referencias técnicas

[1]: https://neon.com/pricing "Neon Pricing Plans"

[2]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"

[3]: https://orm.drizzle.team/docs/get-started/neon-new "Get Started with Drizzle and Neon"
