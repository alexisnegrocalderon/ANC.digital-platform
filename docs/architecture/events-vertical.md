# Vertical Eventos — ANC Platform

## Alcance de la primera vertical

El módulo Eventos demuestra que una vertical puede conectarse al core sin duplicar autenticación futura, contexto de negocio, almacenamiento, auditoría ni acceso a Neon. La primera versión cubre eventos, tipos de entrada, pedidos, tickets y validación de acceso.

El código vive en `modules/events/`. El esquema PostgreSQL se encuentra en `drizzle/schema.ts`, con las tablas `events`, `ticket_types`, `orders`, `order_items`, `tickets` y `access_logs`. Todas las tablas incluyen `businessId` y las consultas de servicio filtran por negocio antes de leer o modificar datos.

## Flujo end-to-end

El flujo probado es el siguiente: el negocio publica un evento; el catálogo de entradas se consulta con `events.listPublished`; el cliente crea un pedido con `events.createOrder`; el sistema emite un código único por ticket; el operador valida el código mediante `events.validateTicket`; la primera validación cambia el ticket a `used` y escribe `access_logs`; una segunda validación devuelve `already_used` y no vuelve a aceptar el acceso.

| Paso | Contrato | Resultado |
|---|---|---|
| Publicación | `events.publish` | El evento cambia de `draft` a `published` solo dentro del negocio actual. |
| Catálogo | `events.listPublished` y `events.getTicketTypes` | El cliente ve los eventos y tipos de entrada disponibles. |
| Compra | `events.createOrder` | Se crea pedido, ítem y uno o más tickets; se incrementa el stock vendido. |
| Acceso válido | `events.validateTicket` | El ticket pasa a `used`, se registra `accepted` y devuelve `valid: true`. |
| Reuso | `events.validateTicket` | Se registra `already_used` y devuelve `valid: false`. |

## Decisiones del MVP

Los precios se almacenan como enteros en centavos y llevan moneda explícita. El pago real todavía es un estado `pending` y debe conectarse después a un adaptador de pagos; el MVP no debe presentarse como integración tributaria o conciliación final. La generación de códigos usa `nanoid`, y el resultado de la compra no expone secretos ni depende de la identidad interna del usuario.

La prueba visual utiliza el negocio semilla `anc-demo`, el evento `anc-launch-demo` y el tipo de entrada `Entrada general`. Los seeds son reproducibles e idempotentes para la creación de catálogo, negocio, evento y tipo de entrada; la prueba de compra genera una orden de QA y debe utilizarse solo en la base Neon de desarrollo.

## Próximos límites antes de vender

Antes de ofrecer ticketera en producción se deben agregar autenticación real, permisos de operador, transacciones o estrategia de reserva atómica para stock, idempotencia de checkout, adaptador de pagos, reembolsos, QR firmado o tokenizado, rate limiting, protección contra enumeración de tickets y pruebas de integración aisladas en un branch de Neon. El header de negocio es únicamente un contexto demo local y se bloquea cuando `NODE_ENV=production`.
