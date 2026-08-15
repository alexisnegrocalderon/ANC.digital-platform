# Módulo de reservas y agenda

## Objetivo

El módulo `bookings` permite que cada negocio publique servicios reservables, configure profesionales y horarios, reciba citas, cancele o reprograme reservas y envíe confirmaciones y recordatorios por WhatsApp. El core solo conoce el contrato de módulo, el negocio activo y los eventos de dominio; las reglas de disponibilidad y mensajería viven dentro de `modules/bookings` y `modules/notifications`.

> La disponibilidad se calcula en la zona horaria del negocio o del profesional, pero la reserva se persiste siempre en UTC. La confirmación transaccional se realiza en PostgreSQL; nunca se confía en una validación visual del frontend para evitar doble reserva.

## Dos opciones de ejecución consideradas

| Enfoque | Tradeoffs | Costo | Complejidad |
|---|---|---|---|
| **Webhooks + cola durable en Neon + cron de reintentos** | El request de reserva responde rápido; notificaciones y reintentos quedan persistidos, sin servidor adicional. Requiere job periódico y límites de lote. | Sin infraestructura fija adicional; costo variable de hosting/API de Meta. | Media; tablas de outbox, worker y webhook. |
| Enviar WhatsApp sincrónicamente dentro de la reserva | Menos tablas y configuración inicial, pero una caída de Meta puede hacer fallar reservas o aumentar la latencia. | Bajo costo inicial, mayor riesgo operativo. | Baja al principio, alta al escalar. |
| WhatsApp Flow completo para elegir servicio, profesional y horario | Excelente experiencia dentro de WhatsApp y menos navegación externa; exige construir Flow, endpoint de datos y más onboarding de Meta. | API de Meta y operación de WABA; sin infraestructura adicional. | Alta; se recomienda como etapa posterior. |

Se implementará la primera opción. La reserva se confirma independientemente del estado de WhatsApp, se crea una notificación en una outbox durable y un worker programático intenta enviarla. Meta Cloud API será el adaptador inicial; la interfaz permitirá agregar BSPs sin cambiar el dominio.

## Entidades

| Entidad | Responsabilidad | Aislamiento |
|---|---|---|
| `booking_services` | Servicio reservable, duración, buffers, precio y reglas de anticipación. | `businessId` obligatorio. |
| `booking_staff` | Profesional, recurso o sala que presta el servicio. | `businessId` obligatorio. |
| `booking_availability_rules` | Horarios recurrentes por día de semana y zona horaria. | Negocio + profesional opcional. |
| `booking_availability_overrides` | Excepciones, feriados, bloqueos y horarios especiales. | Negocio + fecha + profesional opcional. |
| `appointments` | Reserva del cliente y máquina de estados. | Unique idempotency key y conflicto de rango por profesional. |
| `appointment_notifications` | Outbox y estado de cada mensaje, con reintentos. | Unique appointment + event + channel. |
| `whatsapp_accounts` | WABA, `phone_number_id`, token cifrado, secreto y templates por negocio. | Un registro activo por negocio y número. |
| `booking_domain_events` | Eventos de reserva para automatizaciones futuras y auditoría. | Negocio + agregado. |

## Disponibilidad y doble reserva

El frontend solicita slots disponibles para un servicio, profesional y rango de fechas. El backend expande reglas recurrentes, aplica overrides y bloquea slots que intersectan citas activas. Cada cita guarda `startsAt` y `endsAt` en `timestamptz`, con `startsAt < endsAt` y media apertura `[start, end)` para permitir una cita que empiece exactamente cuando termina otra.

La migración agregará una exclusión PostgreSQL GiST por `businessId`, `staffId` y `tstzrange(startsAt, endsAt, '[)')` para estados `pending`, `confirmed`, `checked_in` y `rescheduled`. La creación y confirmación de una cita se hace dentro de una transacción; si PostgreSQL detecta solapamiento, el servicio devuelve `CONFLICT` y nunca envía una notificación de confirmación.

## Estados

| Estado | Significado | Próximos estados permitidos |
|---|---|---|
| `pending` | Slot solicitado, pendiente de confirmación o pago opcional. | `confirmed`, `cancelled`, `expired`. |
| `confirmed` | Reserva aceptada por el negocio. | `checked_in`, `completed`, `cancelled`, `no_show`, `rescheduled`. |
| `checked_in` | Cliente llegó o profesional inició atención. | `completed`, `cancelled`. |
| `completed` | Servicio realizado. | `refunded` si existe pago asociado. |
| `cancelled` | Cancelada por cliente o negocio. | Ninguno. |
| `expired` | No confirmada dentro de la ventana. | Ninguno. |
| `no_show` | Cliente no se presentó. | Ninguno. |
| `rescheduled` | Se reemplazó por otra cita vinculada. | `confirmed`, `cancelled`. |

Cancelar o reprogramar debe crear auditoría y una notificación independiente. Un pago, si el módulo Payments está activo, no se confirma automáticamente desde la reserva; el dominio recibe `payment.approved` como evento separado.

## Notificaciones WhatsApp

Los eventos iniciales son `appointment.confirmed`, `appointment.reminder_24h`, `appointment.reminder_2h`, `appointment.cancelled` y `appointment.rescheduled`. Cada uno crea una fila única en `appointment_notifications` con `idempotencyKey`, `scheduledAt`, `attemptCount` y `status`.

| Evento | Plantilla Meta | Cuándo |
|---|---|---|
| Confirmación | `appointment_confirmed` / categoría utility | Después de confirmar la cita. |
| Recordatorio 24 h | `appointment_reminder_24h` / utility | Job cada 5–15 minutos, ventana de entrega. |
| Recordatorio 2 h | `appointment_reminder_2h` / utility | Job cada 5–15 minutos. |
| Cancelación | `appointment_cancelled` / utility | Después de cancelar. |
| Reprogramación | `appointment_rescheduled` / utility | Después de nueva hora confirmada. |

Fuera de la ventana de atención de WhatsApp solo se usarán plantillas aprobadas y con opt-in. El contenido y parámetros se generan desde datos persistidos, no desde texto libre del usuario. [1] [2]

## Rutas

| Ruta | Método | Uso |
|---|---|---|
| `/api/trpc/bookings.listServices` | Query | Catálogo público del negocio. |
| `/api/trpc/bookings.getAvailability` | Query | Slots disponibles en zona horaria solicitada. |
| `/api/trpc/bookings.createAppointment` | Mutation | Crear una cita idempotente y reservar rango. |
| `/api/trpc/bookings.cancelAppointment` | Mutation | Cancelar con política del negocio. |
| `/api/trpc/bookings.rescheduleAppointment` | Mutation | Crear nuevo rango sin perder historial. |
| `/api/trpc/bookings.listAgenda` | Query | Agenda operativa por día, profesional o estado. |
| `/api/trpc/bookings.configureService` | Mutation protegida | Administrar servicios y disponibilidad. |
| `/api/trpc/notifications.processDue` | Mutation interna/job | Procesar lote de outbox vencida. |
| `/api/whatsapp/webhooks/:businessSlug` | GET/POST | Verificación de Meta y estados entrantes/salientes. |

## Seguridad y límites

Las mutaciones administrativas requieren autenticación y membresía productiva; el header demo solo funciona en desarrollo. El teléfono se normaliza a formato internacional E.164, se conserva con acceso restringido y nunca se incluye en logs. Los webhooks se validan con el verify token de Meta y la firma `X-Hub-Signature-256` cuando corresponda. Los payloads se redacted antes de persistirse.

El módulo no promete WhatsApp gratuito o ilimitado: Meta aplica políticas, opt-in, calidad de templates y cargos según categoría y mercado. Para reducir mantenimiento se usará un worker de lotes sobre la misma aplicación y Neon; si el volumen exige alta frecuencia, se podrá migrar a un job administrado sin cambiar el outbox.

## Referencias

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Meta WhatsApp Template Fundamentals"

[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta WhatsApp Service Messages"

[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta WhatsApp Webhooks Overview"

[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows "Meta WhatsApp Flows"
