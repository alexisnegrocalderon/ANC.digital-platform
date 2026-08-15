# Entrega: módulo de reservas, agenda y WhatsApp

**Proyecto:** ANC Platform Core  
**Repositorio:** `alexisnegrocalderon/ANC.digital-platform`  
**Fecha:** 15 de agosto de 2026  
**Estado:** Implementado en la repo conectada; listo para revisión y configuración de onboarding Meta.

## Resumen ejecutivo

Se implementó el módulo modular de reservas y agenda para que cada negocio pueda publicar servicios, asignar profesionales, definir horarios, bloquear excepciones, consultar disponibilidad y crear citas con idempotencia. El módulo se conecta al core multi-negocio existente, reutiliza Neon PostgreSQL y no modifica la plataforma activa de eventos `candylandwebsite`.

La capa de WhatsApp utiliza un adaptador directo a Meta WhatsApp Cloud API. Las citas crean una outbox durable con confirmación y recordatorios de 24 y 2 horas. El worker procesa entregas en lotes, usa backoff para errores transitorios, guarda IDs de proveedor y marca `manual_required` cuando falta la cuenta WABA o una plantilla. Los webhooks raw validan el challenge y `X-Hub-Signature-256` antes de actualizar estados de entrega.

## Implementación principal

| Área | Entrega |
|---|---|
| Modelo Neon | `booking_services`, `booking_staff`, `booking_availability_rules`, `booking_availability_overrides`, `appointments`, `appointment_notifications`, `whatsapp_accounts`. |
| Integridad | Migración `0004_booking_overlap_constraints.sql` con `btree_gist`, check `starts_at < ends_at` y exclusión GiST por negocio/profesional/rango activo. |
| Dominio | Disponibilidad por zona horaria, buffers, anticipación mínima/máxima, estados, cancelación, E.164 e idempotencia. |
| API | Router tRPC `bookings` para servicios, profesionales, slots, citas, agenda y configuración; router `notifications` para WhatsApp y outbox. |
| WhatsApp | Templates utility, cifrado AES-256-GCM, challenge Meta, HMAC raw, estados `sent`, `delivered`, `read`, `failed`, reintentos y `manual_required`. |
| Jobs | `POST /api/internal/jobs/notifications`, protegido con `CRON_SECRET` en producción. |
| Frontend | `BookingDemoPanel` con servicio, profesional, slots, formulario, reserva y estado de confirmación. |
| Documentación | Contratos de agenda, investigación oficial Meta, operación, auditoría visual y este informe. |

## Validaciones

Las pruebas unitarias finales pasan: **27 tests en 8 archivos**. También pasan `pnpm run check` y `pnpm run build`. La prueba `bookings:schema-smoke` confirmó en Neon las siete tablas nuevas. `bookings:smoke` confirmó slots, reutilización idempotente, rechazo de solapamiento secuencial y tres notificaciones en outbox. El endpoint interno procesó una notificación sin cuenta WhatsApp y la marcó correctamente como `manual_required`.

La verificación visual del preview mostró `CORE ONLINE`, el negocio demo, 14 módulos activos, el catálogo de Eventos y la agenda con `Consultoría demo`, `Ana Demo` y slots reales cargados desde Neon.

La prueba de concurrencia local con Neon tuvo una limitación externa: una ejecución directa sufrió `UND_ERR_CONNECT_TIMEOUT` al conectar al endpoint Neon; una ejecución HTTP concurrente posterior alcanzó el runtime y recibió un error de base en uno de los caminos antes de completar el assertion. La exclusión `appointments_no_active_overlap` fue inspeccionada directamente en Neon y está aplicada. El manejo de errores fue endurecido para traducir códigos `23P01`, constraint y exclusión a `BOOKING_CONFLICT`. Debe repetirse el smoke concurrente en una ventana estable o branch Neon de pruebas antes de considerar este caso certificado.

## Configuración de producción

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Runtime pooled Neon. |
| `DIRECT_DATABASE_URL` | Migraciones. |
| `PAYMENTS_ENCRYPTION_KEY` | Clave base64 de 32 bytes para secretos cifrados. |
| `CRON_SECRET` | Protección del job interno; obligatoria en producción. |
| `PUBLIC_APP_URL` | URL HTTPS pública. |
| `WHATSAPP_GRAPH_API_VERSION` | Versión opcional del Graph API. |

Cada negocio requiere WABA, `phone_number_id`, access token, app secret, verify token, número en formato E.164, opt-in y templates Meta aprobadas. La mutación `notifications.configureWhatsApp` cifra los secretos en `whatsapp_accounts`; no se deben copiar tokens a logs, issues o variables compartidas entre clientes.

## Rutas operativas

```text
GET  /api/whatsapp/webhooks/{businessSlug}
POST /api/whatsapp/webhooks/{businessSlug}
POST /api/internal/jobs/notifications
```

El scheduler debe ejecutar el job cada 5–15 minutos, según el SLA de recordatorios del producto. Si el negocio no tiene WhatsApp configurado, la reserva sigue siendo válida y la notificación queda visible como `manual_required`; el sistema no presenta un mensaje falso de envío exitoso.

## Pendientes antes de venderlo en producción

La primera versión necesita autenticación y autorización completas para mutaciones administrativas, una política configurable de cancelación, reprogramación con historial explícito y controles de consentimiento/baja de WhatsApp. También se debe probar una cuenta Meta sandbox real, confirmar templates por idioma, incorporar observabilidad de jobs y decidir si los recordatorios deben reprogramarse cuando una cita cambia de hora.

WhatsApp Flows puede añadirse como mejora de adquisición y reserva dentro de WhatsApp, pero la confirmación final debe seguir pasando por el servicio transaccional y la restricción de Neon. También conviene incorporar un BSP solo si el onboarding multi-WABA directo se vuelve demasiado costoso comercialmente; la interfaz `WhatsAppProvider` permite esa extensión.

## Archivos relevantes

```text
modules/bookings/service.ts
modules/bookings/router.ts
modules/bookings/time.ts
modules/notifications/whatsapp.ts
modules/notifications/service.ts
modules/notifications/router.ts
server/webhooks/whatsapp.ts
client/src/components/bookings/BookingDemoPanel.tsx
drizzle/migrations/0003_naive_fenris.sql
drizzle/migrations/0004_booking_overlap_constraints.sql
docs/architecture/bookings.md
docs/architecture/whatsapp-research.md
docs/operations/bookings-whatsapp.md
```

## Referencias externas

La política de ventana de atención, templates utility, opt-in, webhooks y Flows se basa en la documentación oficial de Meta. [1] [2] [3] [4]

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta WhatsApp Service Messages"

[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Meta WhatsApp Template Fundamentals"

[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta WhatsApp Webhooks Overview"

[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows "Meta WhatsApp Flows"
