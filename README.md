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
| Autenticación productiva | Pendiente; el contexto por header solo funciona en desarrollo con `DEV_BUSINESS_CONTEXT_ENABLED=true`. |
| Pagos reales y facturación | Pendiente; el MVP deja `paymentStatus` en `pending`. |

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

Durante la etapa local, el frontend consulta el negocio demo `anc-demo` mediante un header de desarrollo. El backend lo acepta solamente cuando `NODE_ENV` no es `production` y `DEV_BUSINESS_CONTEXT_ENABLED=true`. En producción se requiere una autenticación real basada en membresías antes de exponer rutas administrativas.

## Comandos principales

| Comando | Propósito |
|---|---|
| `pnpm run check` | Validar TypeScript sin emitir archivos. |
| `pnpm test` | Ejecutar pruebas unitarias de registro, activación y configuración segura. |
| `pnpm run build` | Compilar frontend Vite y backend Express. |
| `pnpm run neon:smoke` | Confirmar conectividad real con Neon sin mostrar credenciales. |
| `pnpm run db:generate` | Generar migraciones desde `drizzle/schema.ts`. |
| `pnpm run db:migrate` | Aplicar migraciones usando `DIRECT_DATABASE_URL`. |
| `pnpm run seed:core` | Sincronizar el catálogo de 20 módulos y crear `anc-demo`. |
| `pnpm run seed:events` | Crear el evento y ticket demo de la vertical Eventos. |
| `pnpm run publish:demo-event` | Publicar el evento demo de forma idempotente. |

## Arquitectura

El core vive en `server/`, `shared/`, `drizzle/` y `modules/core/`. El contrato de módulo está definido en `shared/module.ts`; el registro central y los presets están en `modules/core/registry.ts`; la resolución de dependencias está en `modules/core/activation.ts`; y la persistencia de activaciones utiliza `business_modules`.

Cada módulo nuevo debe mantener sus servicios, router, esquema específico, pantallas y pruebas en su propio directorio. Las tablas de negocio deben incluir `businessId`, los importes deben usar enteros y moneda explícita, y las operaciones críticas deben generar auditoría o eventos de dominio. El core no debe conocer reglas particulares de eventos, restaurantes, gimnasios o servicios profesionales.

## Módulos declarados

El registro inicial contiene `catalogue`, `pricing`, `orders`, `payments`, `pos`, `inventory`, `billing`, `crm`, `campaigns`, `loyalty`, `notifications`, `reviews`, `reservations`, `access`, `ticketing`, `wallet`, `delivery`, `branches`, `reporting` y `automations`. No todos tienen todavía tablas y pantallas específicas; el registro ya permite modelar sus dependencias y habilitarlos como capacidad de negocio, mientras la implementación se completa por prioridad comercial.

Los presets disponibles son `events`, `restaurant`, `salon`, `retail`, `gym` y `services`. Un preset se resuelve a un plan de activación que incluye dependencias antes de insertar `business_modules`. La activación no elimina historial cuando un módulo se desactiva.

## Neon y mantenimiento

ANC Platform usa un proyecto Neon separado para no tocar la base archivada de Danceroom. El runtime usa el endpoint pooled y Drizzle Kit usa el endpoint directo. El plan Free de Neon es apropiado para desarrollo, demos y negocios pequeños dentro de sus límites publicados, pero no debe venderse como operación productiva ilimitada; el almacenamiento, cómputo, transferencia, ramas y backups deben monitorearse antes de escalar clientes.[1] [2]

Para reducir mantenimiento, la aplicación se mantiene como monolito modular tipado, las migraciones se versionan junto al código, los seeds son reproducibles y el deployment puede usar un único servicio web más Neon. Cuando existan clientes con mayor volumen o necesidades de aislamiento, se podrá usar un proyecto Neon por cliente sin cambiar los contratos del core.

## Verificación realizada

El proyecto pasó `pnpm test`, `pnpm run check`, `pnpm run build` y `pnpm run neon:smoke`. También se verificó el runtime tRPC contra Neon: health reporta la base configurada, el negocio demo y sus módulos activos se leen desde la base, y el vertical Eventos completa el flujo de creación de pedido, emisión de ticket, primera validación aceptada y segunda validación rechazada por reuso.

## Pendientes antes de producción

El siguiente hito debe incorporar autenticación real, membresías y permisos en las rutas; pago idempotente y adaptadores por proveedor; reserva atómica de stock; QR firmado; rate limiting; manejo estructurado de errores; pruebas de integración sobre una branch aislada de Neon; almacenamiento de archivos; notificaciones; observabilidad; y una estrategia comercial clara para separar demo, cliente individual y operación multi-tenant.

## Referencias técnicas

[1]: https://neon.com/pricing "Neon Pricing Plans"

[2]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"

[3]: https://orm.drizzle.team/docs/get-started/neon-new "Get Started with Drizzle and Neon"
