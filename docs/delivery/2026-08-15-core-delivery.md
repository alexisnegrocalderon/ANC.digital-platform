# Entrega ANC Platform Core

**Fecha:** 15 de agosto de 2026  
**Repositorio:** [alexisnegrocalderon/ANC.digital-platform](https://github.com/alexisnegrocalderon/ANC.digital-platform)  
**Último commit:** `55e627a` — `docs: add secure low-maintenance operations guide`

## Resultado

Se construyó la primera base real de ANC Platform en la repo conectada, manteniendo intacta la repo activa `candylandwebsite` y usando esa plataforma únicamente como referencia de negocio y módulos. El resultado es un monolito modular tipado con frontend React, backend Express/tRPC, esquema PostgreSQL con Drizzle, proyecto Neon separado y un registro central de veinte módulos con dependencias y presets por rubro.

La base ya permite crear un negocio, sincronizar el catálogo de módulos, activar capacidades por preset, consultar el contexto del negocio desde el frontend y agregar verticales sin crear un fork por cliente. El contexto demo por `x-business-id` está bloqueado en producción; la siguiente etapa debe reemplazarlo por autenticación y membresías reales.

## Componentes entregados

| Componente | Entrega |
|---|---|
| Core web | Shell React/Vite, Express, tRPC y React Query con diseño base ANC. |
| Datos | Neon PostgreSQL separado, Drizzle schema y migraciones versionadas. |
| Multi-negocio | `businesses`, `users`, `memberships`, configuración de sitio, archivos, auditoría, eventos de dominio y preferencias. |
| Registro | 20 módulos declarados, con permisos, navegación, dependencias, verticales y presets para Eventos, Restaurante, Salón, Retail, Gimnasio y Servicios. |
| Activación | Resolución de dependencias y persistencia en `business_modules`; activación/desactivación con auditoría. |
| Vertical Eventos | Eventos, tipos de entrada, pedidos, ítems, tickets, validación de acceso y logs. |
| UI vertical | Catálogo publicado y checkout demo integrado al shell principal. |
| Operación | README, contrato de core, guía Neon, guía de vertical Eventos y guía de bajo mantenimiento. |

## Neon y separación de bases

Se creó un proyecto Neon nuevo y separado para ANC Platform. El proyecto archivado `Danceroom` no se utilizó para el core y no se modificó. La aplicación valida la conexión pooled con `pnpm run neon:smoke`, aplica migraciones con `DIRECT_DATABASE_URL` y mantiene las credenciales únicamente en `.env`, excluido por `.gitignore`.

La migración inicial creó diez tablas del core. La segunda migración agregó seis tablas de Eventos. El catálogo fue sincronizado con veinte registros, el negocio demo `anc-demo` fue creado y el preset de Eventos dejó catorce módulos activos después de una prueba adicional de activación.

Neon mantiene un plan Free permanente de $0 por mes, pero publica límites de cómputo, almacenamiento, transferencia, branches e historial. Por lo tanto, la arquitectura es adecuada para prototipos, demos y negocios pequeños dentro de esos límites; no se debe vender como gratuidad productiva ilimitada.[1] [2]

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `pnpm test` | 9 pruebas aprobadas. |
| `pnpm run check` | TypeScript aprobado. |
| `pnpm run build` | Frontend y backend compilados. |
| `pnpm run neon:smoke` | Conexión real a `neondb` aprobada. |
| Runtime tRPC | Health, negocio demo y módulos activos leídos desde Neon. |
| Seguridad | El contexto demo devuelve 400 en producción; no hay credenciales fuera de `.env`. |
| Eventos E2E | Pedido creado, ticket emitido, primer acceso aceptado y segundo acceso rechazado como `already_used`. |
| Preview visual | Shell, 20 módulos, contexto `anc-demo`, 14 módulos activos y evento publicado visibles en preview temporal. |

## Qué significa “20 módulos listos” en esta entrega

Los veinte módulos ya están definidos como capacidades registrables y activables. El registro evita forks y fija el contrato común para dependencias, permisos, navegación, configuración y verticales. Sin embargo, no todos tienen todavía tablas, servicios y pantallas de dominio; la implementación completa se hará por prioridad comercial. Eventos es el primer módulo vertical con flujo funcional de punta a punta.

Esta distinción es intencional: es mejor tener veinte módulos honestamente declarados y dos o tres verticales sólidas que veinte áreas visuales sin reglas de negocio, seguridad ni pruebas. La plataforma queda preparada para incorporar los siguientes módulos sin rehacer el core.

## Prioridad de la siguiente etapa

| Prioridad | Módulo o capacidad | Razón comercial y técnica |
|---|---|---|
| 1 | Autenticación, membresías y roles | Reemplazar el contexto demo y hacer vendible el aislamiento por negocio. |
| 2 | Pagos idempotentes | Convertir checkout demo en operación real, con adaptadores por proveedor. |
| 3 | CRM y clientes | Compartido por eventos, restaurantes, servicios, salones y gimnasios. |
| 4 | Notificaciones | Recordatorios, confirmaciones y alertas para aumentar valor inmediato. |
| 5 | Reporting | Mostrar retorno y operación al dueño del negocio. |
| 6 | Archivos, branding y onboarding | Reducir el tiempo de personalización de cada cliente. |
| 7 | Reservas y agenda | Abrir salones, bienestar y servicios profesionales. |
| 8 | Inventario, POS y delivery | Abrir restaurantes y retail con módulos operativos reutilizables. |

## Riesgos pendientes antes de producción

El MVP todavía no debe venderse como ticketera productiva sin incorporar autenticación real, control de permisos de operador, reserva atómica de stock, idempotencia de checkout, adaptador de pagos, reembolsos, QR firmado o tokenizado, rate limiting, observabilidad, respaldo comercial y pruebas de integración aisladas. El README y la guía operativa dejan estos límites explícitos para no convertir una demo funcional en una promesa técnica exagerada.

## Archivos principales

La auditoría de repositorios está en `docs/audits/2026-08-15-platform-audit.md`. Los contratos del core están en `docs/architecture/core-contracts.md`; la conexión Neon en `docs/architecture/neon-connection.md`; el vertical Eventos en `docs/architecture/events-vertical.md`; y la operación de bajo mantenimiento en `docs/operations/low-maintenance.md`.

## Referencias

[1]: https://neon.com/pricing "Neon Pricing Plans"

[2]: https://neon.com/docs/introduction/plans "Neon Plans and Billing"

[3]: https://orm.drizzle.team/docs/get-started/neon-new "Get Started with Drizzle and Neon"

[4]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"
