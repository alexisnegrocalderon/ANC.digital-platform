# Catálogo maestro de módulos ANC Platform

**Versión:** 0.1.0  
**Fuente técnica:** `shared/module.ts` y `modules/core/registry.ts`  
**Propósito:** definir qué capacidades existen, cómo se venden, qué dependencias tienen y qué tan listas están para acoplarse a un negocio.

> **Importante:** estar registrado en el catálogo no significa estar implementado para producción. Un módulo solo se considera operativo cuando tiene dominio, esquema/migración, router, servicios, UI o integración correspondiente, pruebas y documentación.

## Niveles de madurez

| Estado | Significado |
|---|---|
| `implemented` | Implementación funcional completa para el alcance definido, con pruebas y documentación. |
| `implemented-hardening` | Flujo funcional probado, pero con pendientes de producción como auth, sandbox, reconciliación, observabilidad o hardening. |
| `scaffolded` | Existen piezas funcionales dentro de un vertical o carpeta, pero aún no es un paquete independiente reutilizable. |
| `contract-ready` | Tiene manifest, dependencias, permisos, navegación y compatibilidad, pero no dominio completo. |
| `planned` | Definido comercialmente para una siguiente etapa; no debe activarse como funcionalidad productiva. |

## Inventario canónico

| # | Key | Nombre para el admin | Grupo | Dependencias | Skill | Estado actual | Qué existe hoy | Siguiente trabajo |
|---:|---|---|---|---|---|---|---|---|
| 1 | `catalogue` | Catálogo y oferta | Oferta y datos base | — | `modulo-catalogo` | `contract-ready` | Manifest, permisos y compatibilidad vertical. Eventos tiene tipos de entrada, pero no un catálogo genérico independiente. | Crear productos/servicios, categorías, variantes, imágenes, publicaciones y API genérica. |
| 2 | `pricing` | Precios y promociones | Oferta y datos base | `catalogue` | `modulo-precios` | `contract-ready` | Manifest y dependencia de catálogo. | Crear listas de precios, cupones, descuentos, reglas y vigencias. |
| 3 | `orders` | Pedidos y checkout | Comercio y transacciones | `catalogue` | `modulo-pedidos` | `scaffolded` | El vertical Eventos crea pedidos, pero la lógica no es todavía un módulo de pedidos general. | Extraer órdenes, líneas, estados, checkout y fulfillment reutilizables. |
| 4 | `payments` | Pagos y conciliación | Comercio y transacciones | `orders` | `modulo-pagos` | `implemented-hardening` | Stripe Checkout Sessions, MercadoPago Preferences, estados, webhooks raw, idempotencia, Neon, UI y tests. | Auth administrativa, sandbox real, reconciliación MercadoPago, reembolsos, chargebacks y observabilidad. |
| 5 | `pos` | Caja y POS | Comercio y transacciones | `payments` | `modulo-pos` | `planned` | Solo manifest y dependencia. | Ventas presenciales, cajas, operadores, cierres, comprobantes y permisos de caja. |
| 6 | `inventory` | Inventario y stock | Comercio y transacciones | `catalogue` | `modulo-inventario` | `planned` | Solo manifest y dependencia. | Existencias, movimientos, reservas atómicas, costos, alertas y multi-sucursal. |
| 7 | `billing` | Facturación y comprobantes | Comercio y transacciones | `orders`, `payments` | `modulo-facturacion` | `planned` | Solo manifest y dependencia. | Adaptadores tributarios, documentos, estados, notas y conciliación. |
| 8 | `crm` | Clientes y CRM | Clientes y relación | — | `modulo-crm` | `contract-ready` | Hay usuarios, memberships y preferencias del core; no existe aún un CRM de clientes de negocio. | Contactos, historial, tags, consentimientos, actividades y deduplicación. |
| 9 | `campaigns` | Campañas y segmentación | Clientes y relación | `crm` | `modulo-campanas` | `planned` | Solo manifest y dependencia. | Segmentos, campañas, audiencias, consentimiento, métricas y canales. |
| 10 | `loyalty` | Fidelización y membresías | Clientes y relación | `crm` | `modulo-fidelizacion` | `planned` | Solo manifest y dependencia. | Puntos, niveles, membresías, gift cards, saldos y reglas. |
| 11 | `notifications` | Notificaciones omnicanal | Clientes y relación | — | `modulo-notificaciones` | `implemented-hardening` | Outbox de citas, worker, templates, webhooks y Meta WhatsApp Cloud API. La skill transversal `modulo-whatsapp` ya existe. | Auth, consentimiento/baja, observabilidad, más canales y configuración visual. |
| 12 | `reviews` | Reseñas y encuestas | Clientes y relación | `crm` | `modulo-resenas` | `contract-ready` | Manifest y dependencia de CRM. | Solicitudes de reseña, encuestas, moderación, rating y reportes. |
| 13 | `reservations` | Reservas y agenda | Operación y atención | `crm`, `notifications` | `modulo-reservas` | `implemented-hardening` | Agenda, staff, servicios, reglas, overrides, slots, idempotencia, exclusión GiST, UI y Neon. | Normalizar `modules/bookings` a `reservations`, auth, reprogramación, política comercial y concurrencia certificada. |
| 14 | `access` | Acceso, QR y validación | Operación y atención | `crm`, `notifications` | `modulo-acceso` | `scaffolded` | Validación de tickets y registro de acceso dentro del vertical Eventos. | Extraer QR firmado/tokenizado, escaneo, controles de uso y permisos como módulo independiente. |
| 15 | `ticketing` | Ticketera y asistencia | Operación y atención | `catalogue`, `orders`, `access` | `modulo-ticketera` | `scaffolded` | Eventos, tipos de entrada, tickets y asistencia existen dentro del vertical Eventos. | Extraer ticketera genérica, cupos, asistentes, transferencias y recuperación. |
| 16 | `wallet` | Billetera y consumo | Comercio y transacciones | `crm`, `payments`, `pos` | `modulo-billetera` | `planned` | Solo manifest y dependencia. | Saldos, consumos autorizados, descuentos, devoluciones y auditoría financiera. |
| 17 | `delivery` | Delivery y despacho | Comercio y transacciones | `orders` | `modulo-delivery` | `planned` | Solo manifest y dependencia. | Zonas, direcciones, tarifas, asignación, estados, retiro y tracking. |
| 18 | `branches` | Sucursales y equipos | Oferta y datos base | — | `modulo-sucursales` | `contract-ready` | Manifest de ubicaciones, equipos y compatibilidad vertical. | Sedes, equipos, horarios, inventario, usuarios y reportes por sucursal. |
| 19 | `reporting` | Reportes y analítica | Inteligencia y control | — | `modulo-reportes` | `contract-ready` | Eventos de auditoría y dominio en el core; no existe un panel de reporting de negocio. | KPIs, filtros, exportaciones, snapshots y paneles por módulo. |
| 20 | `automations` | Automatizaciones y workflows | Inteligencia y control | `notifications` | `modulo-automatizaciones` | `contract-ready` | Outbox/jobs puntuales y eventos de dominio en el core; no existe builder de reglas general. | Triggers, condiciones, acciones, tareas programadas, webhooks y trazabilidad. |

## Capacidades ya funcionales

### Core modular y activación

El core ya mantiene `businesses`, `memberships`, `module_catalog`, `business_modules`, auditoría, eventos de dominio y resolución de dependencias. Puede registrar 20 keys, persistir activaciones y activar dependencias en orden. Todavía no debe considerarse un admin productivo porque el contexto demo por header debe ser reemplazado por autenticación y autorización por rol.

### Vertical Eventos

Eventos es un **preset compuesto**, no un módulo adicional. Su flujo funcional cubre publicación, catálogo de evento, pedido demo, tickets y validación de acceso. Se debe conservar como ejemplo de composición para demostrar cómo varios módulos se unen sobre el core.

### Pagos

Pagos está en `implemented-hardening`. La integración ya usa adaptadores separados de Stripe y MercadoPago, webhooks verificados, estados e idempotencia. Faltan autenticación administrativa, compras sandbox reales, reconciliación, reembolsos, chargebacks, fulfillment y observabilidad antes de venderlo como productivo.

### Reservas y notificaciones

Reservas está en `implemented-hardening`; su código actual vive en `modules/bookings` y debe normalizarse al key `reservations` sin romper contratos existentes. Notificaciones tiene base funcional mediante WhatsApp Cloud API, outbox y worker, pero requiere WABA sandbox, consentimiento, monitoreo y permisos productivos.

## Familias comerciales

### Oferta y datos base

`catalogue`, `pricing` y `branches` definen la oferta, los precios y las sedes. Son la base de restaurantes, retail, salones, gimnasios y servicios.

### Comercio y transacciones

`orders`, `payments`, `billing`, `pos`, `inventory`, `delivery` y `wallet` cubren el ciclo de venta, cobro, comprobantes, inventario, despacho y consumo. El admin debe mostrar dependencias y no permitir activar una combinación incompleta.

### Clientes y relación

`crm`, `campaigns`, `loyalty`, `notifications` y `reviews` trabajan sobre identidad de clientes, comunicación y retención. `modulo-whatsapp` es un conector transversal para `notifications`, no un módulo duplicado.

### Operación y atención

`reservations`, `access` y `ticketing` cubren citas, ingreso, tickets y asistencia. Eventos compone esta familia con comercio, reporting y automatizaciones.

### Inteligencia y workflows

`reporting` y `automations` consumen eventos de dominio y auditoría de las demás familias. Conviene implementarlos después de estabilizar los contratos de eventos.

## Presets recomendados

| Preset | Módulos principales |
|---|---|
| Eventos | Catálogo, precios, pedidos, pagos, CRM, notificaciones, acceso, ticketera, billetera, POS, reportes y automatizaciones. |
| Restaurante | Catálogo, precios, pedidos, pagos, POS, inventario, CRM, notificaciones, delivery y reportes. |
| Salón/Barbería | Catálogo, pagos, CRM, notificaciones, reservas, fidelización, reseñas y reportes. |
| Retail | Catálogo, precios, pedidos, pagos, POS, inventario, CRM, fidelización, sucursales y reportes. |
| Gimnasio/Bienestar | Catálogo, pagos, CRM, notificaciones, reservas, fidelización, acceso y reportes. |
| Servicios profesionales | Catálogo, pagos, CRM, notificaciones, reservas, reseñas, reportes y automatizaciones. |

## Skills relacionadas

| Skill | Estado |
|---|---|
| `modulo-whatsapp` | Creada y validada; es transversal para notificaciones y reservas. |
| `modulo-catalogo` a `modulo-automatizaciones` | Por crear siguiendo el contrato estándar de skills. |

## Regla de activación

El admin debe mostrar primero el **plan de activación**. Si el usuario solicita `payments`, el sistema debe incluir `orders` y `catalogue`; si solicita `reservations`, debe incluir `crm` y `notifications`. La activación debe ser atómica, auditable y específica del negocio. Desactivar una dependencia activa debe bloquearse hasta resolver o desactivar los módulos dependientes.
