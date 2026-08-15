# Entrega del módulo de pagos

**Fecha:** 15 de agosto de 2026  
**Repositorio:** [alexisnegrocalderon/ANC.digital-platform](https://github.com/alexisnegrocalderon/ANC.digital-platform)

## Resultado

Se implementó el módulo `payments` sobre el core existente de ANC Platform. La integración soporta Stripe Checkout Sessions y MercadoPago Checkout Pro Preferences API mediante adaptadores independientes. Ambos proveedores comparten el mismo modelo de negocio, intentos de pago, estados, webhooks y auditoría; ninguna credencial ni lógica de proveedor se expone al frontend.

La confirmación del pago se procesa únicamente desde un webhook verificado o una consulta server-to-server. Las URLs de éxito y cancelación solo sirven para navegación del usuario y no modifican el estado de una orden.

## Entregables

| Área | Implementación |
|---|---|
| Esquema Neon | `payment_provider_accounts`, `payment_attempts` y `payment_webhook_events`, con índices y restricciones únicas por negocio/proveedor. |
| Idempotencia | Reutilización local de checkout por orden/proveedor/operación; `Idempotency-Key` nativa en Stripe; deduplicación de webhooks por evento externo. |
| Estados | `created`, `pending`, `requires_action`, `approved`, `failed`, `cancelled`, `expired`, `refunded` y `partially_refunded`, con transiciones permitidas. |
| Stripe | Checkout Session hospedada, metadata de orden/negocio, firma `Stripe-Signature` sobre body raw y normalización de eventos. |
| MercadoPago | Preference hospedada, `external_reference`, back URLs, notification URL, firma HMAC con manifest oficial y consulta del recurso completo. |
| Seguridad | AES-256-GCM para credenciales por negocio, body raw antes de `express.json()`, comparación constante de firmas y redacción de payloads. |
| Webhooks | Rutas raw `/api/payments/webhooks/stripe/:businessSlug` y `/api/payments/webhooks/mercadopago/:businessSlug`. |
| Frontend | Selector de proveedor y botón para abrir checkout hospedado desde el panel demo de Eventos. |
| Documentación | Contrato técnico, investigación oficial, operación de pagos y README actualizado. |

## Validaciones

| Prueba | Resultado |
|---|---|
| `pnpm test` | 19 pruebas aprobadas. |
| `pnpm run check` | TypeScript aprobado. |
| `pnpm run build` | Frontend y backend compilados. |
| `pnpm run neon:smoke` | Conexión real a Neon aprobada. |
| `pnpm run payments:schema-smoke` | Las tres tablas de pagos existen en Neon. |
| `pnpm run payments:webhook-smoke` | Webhook Stripe firmado procesa la orden a `paid`; el duplicado recibe `200` sin repetir efectos. |
| Firma inválida | Stripe devuelve `401` antes de registrar o procesar el evento. |
| Credenciales | Escaneo sin secretos fuera de `.env` y `.env.example`. |

Las pruebas de adaptador mockean las respuestas HTTP para verificar forma de requests, moneda, metadata, `Idempotency-Key` de Stripe y ausencia de headers no documentados en Preferences API. Todavía se requiere ejecutar una compra de sandbox real con cuentas de MercadoPago y Stripe del negocio antes de activar producción.

## Configuración mínima

Configurar `PUBLIC_APP_URL`, `PAYMENTS_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` según el ambiente. Para producción se exige URL HTTPS y clave de cifrado base64 de 32 bytes. Las credenciales globales son fallback de desarrollo; el flujo vendible debe guardar credenciales cifradas por negocio mediante `payments.configureProvider` después de incorporar autenticación y permisos productivos.

## Límite específico de MercadoPago

MercadoPago Checkout Pro Preferences API documenta el header `Authorization` y devuelve un preference ID/URL, pero no documenta `X-Idempotency-Key` para ese endpoint. ANC Platform evita enviar un header no documentado y garantiza idempotencia local reutilizando el `payment_attempt`. Esto evita duplicar una preference cuando el request se reintenta después de recibir respuesta; queda una ventana extrema si el proveedor crea la preference y la conexión cae antes de que ANC guarde el ID. Antes de producción se debe implementar reconciliación por `external_reference` o un adaptador Orders API con `X-Idempotency-Key` cuando el flujo de pago permita usarlo.

## Pendientes antes de producción

La integración necesita autenticación real y autorización por membresía para configurar proveedores; una pantalla de administración de credenciales con rotación; pruebas sandbox reales; rate limiting y observabilidad; reintentos durables para eventos `failed`; reconciliación MercadoPago; reembolsos y chargebacks; reserva atómica de stock; y un fulfillment que emita tickets solo después de `approved`. El panel actual conserva el flujo demo de creación de orden y debe migrarse a un flujo donde la entrega ocurra después de confirmación de pago.

## Referencias oficiales

[1]: https://docs.stripe.com/webhooks "Stripe Webhooks"

[2]: https://docs.stripe.com/webhooks/signature "Stripe Webhook Signature Verification"

[3]: https://docs.stripe.com/api/idempotent_requests "Stripe Idempotent Requests"

[4]: https://docs.stripe.com/api/checkout/sessions/create "Stripe Create Checkout Session"

[5]: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks "MercadoPago Webhooks"

[6]: https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/optional-notifications "MercadoPago HMAC Manifest"

[7]: https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post "MercadoPago Create Preference API"

[8]: https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api/create-order/post "MercadoPago Create Order and Idempotency"
