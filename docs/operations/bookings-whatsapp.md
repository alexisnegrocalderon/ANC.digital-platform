# Operación de reservas y WhatsApp

## Alcance

El módulo `bookings` funciona por negocio y agrega servicios, profesionales, horarios recurrentes, excepciones, citas y una outbox de notificaciones. La reserva se persiste en Neon en UTC, usando la zona horaria del negocio para construir disponibilidad. La restricción GiST `appointments_no_active_overlap` impide solapamientos activos por negocio y profesional incluso si dos clientes intentan reservar el mismo slot al mismo tiempo.

La implementación usa la **WhatsApp Cloud API directa** como primer adaptador. El negocio debe proporcionar una cuenta WABA, `phone_number_id`, token de acceso, app secret, verify token, opt-in de clientes y plantillas Meta aprobadas. Las confirmaciones y recordatorios se envían como templates `utility` fuera de la ventana de atención; no se debe enviar texto libre fuera de la ventana de 24 horas. [1] [2]

## Variables

| Variable | Obligatoria | Uso |
|---|---:|---|
| `DATABASE_URL` | Sí | Neon pooled runtime. |
| `DIRECT_DATABASE_URL` | Migraciones | Neon direct connection. |
| `PAYMENTS_ENCRYPTION_KEY` | Sí en producción | AES-256-GCM para tokens y secretos. |
| `CRON_SECRET` | Sí en producción | Protege `/api/internal/jobs/notifications`. |
| `PUBLIC_APP_URL` | HTTPS en producción | Retornos, enlaces y configuración pública. |
| `WHATSAPP_GRAPH_API_VERSION` | No | Versión Graph; default documentado en el adaptador. |

Las credenciales específicas del negocio se almacenan cifradas en `whatsapp_accounts` mediante el servicio existente de secretos. No se guardan en `.env`, logs ni payloads de webhook. La mutación `notifications.configureWhatsApp` requiere membresía administrativa en producción; el contexto por header solo existe en desarrollo.

## Onboarding de un negocio

Primero se activa el módulo `reservations` y su dependencia `notifications`. Luego se crea el servicio, el profesional y las reglas de disponibilidad. Las reglas usan `weekday` de domingo `0` a sábado `6`, horarios `HH:mm` y una zona IANA, por ejemplo `America/Santiago`. Los días bloqueados se agregan como overrides.

En Meta se configura el webhook HTTPS:

```text
GET  https://{PUBLIC_APP_URL}/api/whatsapp/webhooks/{businessSlug}
POST https://{PUBLIC_APP_URL}/api/whatsapp/webhooks/{businessSlug}
```

Meta debe recibir el mismo `verifyToken` guardado para el negocio. El POST se valida contra el cuerpo raw y `X-Hub-Signature-256`; el servidor responde `401` ante firma inválida y `200` después de registrar estados de entrega. Meta puede reintentar webhooks, por lo que el módulo no debe producir efectos duplicados. [3]

Las plantillas recomendadas son:

| Clave interna | Template sugerida | Variables |
|---|---|---|
| `appointment.confirmed` | `appointment_confirmed` | `customer_name`, `service_name`, `appointment_start`, `timezone`, `appointment_id`. |
| `appointment.reminder_24h` | `appointment_reminder_24h` | Las mismas variables. |
| `appointment.reminder_2h` | `appointment_reminder_2h` | Las mismas variables. |
| `appointment.cancelled` | `appointment_cancelled` | `customer_name`, `appointment_id`. |
| `appointment.rescheduled` | `appointment_rescheduled` | Las mismas variables más la nueva hora. |

El nombre final de cada template puede variar por negocio; se registra en `whatsapp_accounts.templates` como mapa de evento a nombre aprobado en Meta.

## Procesamiento de la outbox

Cada cita confirmada crea tres filas en `appointment_notifications`: confirmación inmediata, recordatorio de 24 horas y recordatorio de 2 horas. La clave única por negocio y evento evita duplicaciones. Un worker reclama filas `queued` o `retrying`, las cambia a `processing`, envía la plantilla y guarda el `providerMessageId`. Los errores transitorios usan backoff hasta cinco intentos; una cuenta o plantilla faltante se marca `manual_required`, no se reintenta inútilmente.

El endpoint interno de bajo mantenimiento es:

```text
POST /api/internal/jobs/notifications
Header: x-cron-secret: {CRON_SECRET}
Body: {"limit": 20}
```

En producción debe ser invocado por un scheduler HTTPS o cron administrado cada cinco o quince minutos. En desarrollo puede ejecutarse sin el header, pero nunca se debe publicar esa configuración.

## Pruebas reproducibles

| Comando | Objetivo |
|---|---|
| `pnpm run db:migrate` | Aplicar migraciones 0003 y 0004. |
| `pnpm run bookings:schema-smoke` | Verificar las siete tablas del módulo en Neon. |
| `pnpm run seed:bookings` | Crear servicio, profesional y reglas demo. |
| `pnpm run bookings:smoke` | Probar slots, idempotencia, conflicto y outbox. |
| `pnpm run bookings:concurrency-smoke` | Intentar dos reservas simultáneas del mismo slot. |
| `pnpm test` | Ejecutar el suite unitario completo. |
| `pnpm run check` | Validar TypeScript. |
| `pnpm run build` | Validar frontend y servidor productivo. |

El smoke de concurrencia debe ejecutarse solo en un branch o dataset de prueba, porque crea citas y notificaciones demo. La restricción de base puede inspeccionarse con `pg_constraint`; el nombre esperado es `appointments_no_active_overlap`.

## Límites y pendientes

Meta exige opt-in del usuario y plantillas aprobadas para mensajes fuera de la ventana de atención. WhatsApp Flows puede incorporarse posteriormente para reservar dentro de WhatsApp, pero la confirmación final debe seguir pasando por `createAppointment` y la restricción de Neon para evitar doble reserva. [4]

Antes de producción deben agregarse autenticación y autorización completas para todas las mutaciones administrativas, política de cancelación por negocio, controles de consentimiento y baja, reprogramación completa con historial, monitoreo de fallos, reconciliación de estados y pruebas sandbox reales de Meta. El módulo no promete gratuidad ilimitada: la API y las políticas de Meta tienen costos y límites que dependen de la categoría, mercado y calidad de la cuenta.

## Referencias

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta WhatsApp Service Messages"

[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Meta WhatsApp Template Fundamentals"

[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta WhatsApp Webhooks Overview"

[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows "Meta WhatsApp Flows"
