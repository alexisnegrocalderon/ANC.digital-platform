# Matriz de madurez runtime de los módulos ANC

## Propósito

Esta matriz separa el catálogo comercial de la capacidad runtime real. Un módulo puede tener skill, manifest y dependencias registradas sin estar todavía listo para activarse en una plataforma de producción. El admin debe mostrar esta diferencia y solo permitir activaciones productivas cuando el módulo cumpla contrato, pruebas, migración, UI, permisos, health y documentación.

## Estados de madurez

| Estado | Significado operativo | ¿Activable en producción? |
|---|---|---:|
| `implemented-hardening` | Tiene runtime, persistencia, rutas, UI o integración principal y pruebas; requiere endurecimiento continuo antes de venderlo sin revisión. | Sí, con checklist e integraciones configuradas. |
| `contract-ready` | Tiene manifest, contrato y diseño de dominio, pero todavía necesita runtime completo, migración, UI y pruebas end-to-end. | No. |
| `scaffolded` | Tiene estructura inicial o frontera de módulo, pero faltan partes importantes del dominio. | No. |
| `planned` | Está definido en el catálogo y skill, pero aún no tiene implementación runtime suficiente. | No. |

## Inventario de los 20 módulos

| # | Key | Nombre comercial | Grupo | Madurez actual | Dependencias | Prioridad | Criterio de activación |
|---:|---|---|---|---|---|---|---|
| 1 | `catalogue` | Catálogo | Oferta | `implemented-hardening` | — | P0 | Productos/servicios, categorías, permisos, búsqueda, runtime Neon y UI base. |
| 2 | `pricing` | Precios y promociones | Oferta | `implemented-hardening` | `catalogue` | P1 | Reglas versionables, precio fijo/porcentaje/monto, ventanas activas, Neon y smoke test. |
| 3 | `orders` | Pedidos y checkout | Comercio | `scaffolded` | `catalogue` | P0 | Carrito, pedido, estados, idempotencia, checkout y fulfillment básico. |
| 4 | `payments` | Pagos | Comercio | `implemented-hardening` | `orders` | P0 | Credenciales del cliente, sandbox, webhooks, reembolsos y conciliación verificados. |
| 5 | `pos` | Caja y POS | Comercio | `planned` | `payments` | P2 | Caja, operadores, cierres, comprobantes y control de concurrencia. |
| 6 | `inventory` | Inventario | Comercio | `planned` | `catalogue` | P1 | Almacenes, movimientos, reservas de stock y alertas de disponibilidad. |
| 7 | `billing` | Facturación | Comercio | `planned` | `orders`, `payments` | P2 | Adaptador tributario, folios, documentos y manejo de errores. |
| 8 | `crm` | Clientes | Relación | `implemented-hardening` | — | P0 | Perfil, búsqueda, consentimientos, etiquetas, runtime Neon y UI base. |
| 9 | `campaigns` | Segmentación y campañas | Relación | `planned` | `crm` | P2 | Audiencias, consentimiento, programación y medición. |
| 10 | `loyalty` | Fidelización y membresías | Relación | `planned` | `crm` | P2 | Puntos, niveles, membresías, saldo, reglas y reversas. |
| 11 | `notifications` | Notificaciones | Relación | `implemented-hardening` | — | P0 | Templates, preferencias, outbox, reintentos, WhatsApp y estados de entrega. |
| 12 | `reviews` | Encuestas y reseñas | Relación | `contract-ready` | `crm` | P1 | Solicitud de reseña, moderación, publicación y métricas. |
| 13 | `reservations` | Reservas y agenda | Operación | `implemented-hardening` | `crm`, `notifications` | P0 | Disponibilidad, zonas horarias, citas, conflictos, cancelación y recordatorios. |
| 14 | `access` | Acceso y QR | Operación | `implemented-hardening` | `ticketing` | P1 | Validación QR, uso único, logs por negocio y router protegido. |
| 15 | `ticketing` | Ticketera y asistencia | Operación | `implemented-hardening` | `catalogue`, `access` | P0 para Eventos | Eventos publicados, tipos de entrada, cupos, emisión, validación y asistencia. |
| 16 | `wallet` | Billetera y consumo | Comercio | `planned` | `crm`, `payments`, `pos` | P2 | Saldo, ledger, autorización, consumos y reversas. |
| 17 | `delivery` | Delivery y despacho | Comercio | `planned` | `orders` | P1 | Zonas, tarifas, direcciones, asignaciones y estados de despacho. |
| 18 | `branches` | Sucursales | Oferta | `contract-ready` | — | P1 | Ubicaciones, horarios, equipos y aislamiento por sede. |
| 19 | `reporting` | Reportes y analítica | Inteligencia | `implemented-hardening` | — | P0 | KPIs base por negocio, pedidos, catálogo, clientes, citas y permisos. |
| 20 | `automations` | Automatizaciones | Inteligencia | `contract-ready` | `notifications` | P1 | Triggers, acciones, scheduler, logs, retries y permisos. |

## Orden de construcción

La primera ola ya convirtió el Core en una base operativa útil para cualquier negocio: `catalogue`, `crm`, `reporting`, `notifications` y la infraestructura transversal de permisos, auditoría, settings y health. Esta ola no activa pagos ni crea dependencias externas por defecto.

La segunda ola continúa con el flujo comercial: `orders`, `inventory`, `delivery` y `reviews`. `pricing` ya tiene runtime base y puede activarse con reglas revisadas, mientras los demás permanecen bloqueados hasta completar sus gates.

La tercera ola debe completar los verticales prioritarios. Para Eventos se deben cerrar `ticketing`, `access` y `wallet` sobre los módulos de pagos y órdenes existentes. Para Servicios/Reservas se debe endurecer `reservations`, `notifications`, `automations` y `branches`.

La cuarta ola corresponde a capacidades avanzadas: `pos`, `billing`, `campaigns` y `loyalty`. Estos módulos deben entrar al catálogo como visibles pero bloqueados hasta tener integraciones, pruebas y reglas comerciales.

## Regla del catálogo del admin

El admin puede mostrar los 20 módulos, sus skills, dependencias, verticales y roadmap. Sin embargo, una mutación de activación productiva solo debe aceptar módulos con madurez `implemented-hardening` y con todas sus dependencias en estado activo y saludable. Los estados `contract-ready`, `scaffolded` y `planned` solo pueden aparecer como `preview`, `roadmap` o `manual_required`.

Cada avance de madurez debe exigir migración, contrato de API, permisos, UI, pruebas unitarias, pruebas end-to-end, health check, documentación operativa y una versión de release. La reunión con cada cliente debe producir un snapshot de módulos deseados; ese snapshot no debe elevar automáticamente la madurez de un módulo ni saltarse sus gates.

## Aplicación a los tres primeros clientes

El primer cliente debe servir para validar el provisioning del Core y la composición base. El segundo debe probar el preset de Eventos con `ticketing`, `access`, pagos y reportes. El tercero debe probar el preset de Servicios/Reservas con agenda, WhatsApp, clientes, reseñas y automatizaciones. La selección definitiva se hará después de las reuniones de descubrimiento, pero ningún cliente debe recibir un módulo todavía bloqueado como si estuviera terminado.

## Criterio de terminado para un módulo

Un módulo se considera listo cuando puede instalarse en un repo nuevo desde el manifest versionado, crea o actualiza su esquema sin destruir datos, respeta `businessId`, exige permisos, funciona con el feature flag apagado y encendido, resiste reintentos, registra auditoría, tiene una UI usable, pasa pruebas de aislamiento y tiene un procedimiento de rollback. Solo entonces su estado puede cambiar a `implemented-hardening` y el catálogo puede permitir su activación productiva.

## Decisión registrada

Esta matriz conserva la diferencia entre **skill reutilizable**, **contrato de módulo**, **paquete runtime** y **módulo listo para producción**. El objetivo de la siguiente fase es completar el kit de descubrimiento para convertir las reuniones con los tres clientes en presets y manifests concretos, sin comenzar personalizaciones irreversibles antes de conocer sus procesos reales.

