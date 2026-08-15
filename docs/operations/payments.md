# Operación del módulo de pagos

## Configuración

El módulo no guarda credenciales en el frontend. Para desarrollo rápido se pueden usar variables globales; para clientes productivos se debe usar `payments.configureProvider`, que cifra el access token y el secreto webhook con `PAYMENTS_ENCRYPTION_KEY` antes de guardarlos en Neon.

| Variable | Desarrollo | Producción |
|---|---|---|
| `PUBLIC_APP_URL` | URL local o HTTPS de preview. | URL HTTPS pública del cliente. |
| `PAYMENTS_ENCRYPTION_KEY` | Opcional si solo se usan credenciales globales. | Obligatoria: base64 de 32 bytes. |
| `STRIPE_SECRET_KEY` | Cuenta Stripe de prueba opcional. | Opcional si la cuenta está configurada por negocio. |
| `STRIPE_WEBHOOK_SECRET` | Secreto del endpoint de prueba. | Secreto del endpoint productivo. |
| `MERCADOPAGO_ACCESS_TOKEN` | Token de prueba opcional. | Opcional si la cuenta está configurada por negocio. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto Webhooks de la aplicación. | Secreto Webhooks productivo. |

Las variables globales son un fallback de desarrollo. No se deben compartir entre clientes en producción, porque una cuenta de proveedor pertenece a un negocio específico y necesita aislamiento, rotación y auditoría.

## URLs de webhooks

Para cada negocio se registra una URL por proveedor:

```text
POST https://CLIENTE.example/api/payments/webhooks/stripe/SLUG_DEL_NEGOCIO
POST https://CLIENTE.example/api/payments/webhooks/mercadopago/SLUG_DEL_NEGOCIO
```

El servidor monta ambas rutas antes de `express.json()`. Stripe recibe el body raw y se valida contra `Stripe-Signature`; MercadoPago se valida con `x-signature`, `x-request-id`, `data.id` y el secreto de la aplicación. Las firmas inválidas reciben `401`. Los eventos válidos reciben `200` rápidamente y se registran en `payment_webhook_events` antes de procesarse.

En Stripe se deben activar, como mínimo, `checkout.session.completed`, `checkout.session.expired` y `payment_intent.payment_failed`. En MercadoPago se debe activar el tema correspondiente al checkout usado, normalmente `payment` para Checkout Pro; la aplicación consulta el recurso completo después de validar la notificación.

## Pruebas locales

El suite unitario prueba la máquina de estados, cifrado AES-256-GCM, firma raw Stripe, manifest HMAC MercadoPago y contratos del core. Las pruebas contra Neon se ejecutan con:

```bash
pnpm run payments:schema-smoke
SMOKE_PORT=3011 STRIPE_WEBHOOK_SECRET=test-webhook-secret pnpm run payments:webhook-smoke
```

El smoke test de webhook crea un intento de prueba en Neon, envía un evento firmado al runtime local, verifica que la orden pase a `paid`, envía el mismo evento otra vez y confirma que el segundo request recibe `200` como duplicado sin repetir efectos. Solo se debe ejecutar sobre Neon de desarrollo o sobre un branch aislado.

## Idempotencia y reconciliación

Stripe usa la clave local como `Idempotency-Key` al crear Checkout Sessions. El webhook se deduplica con `businessId`, proveedor e ID externo, y las transiciones de estado se validan antes de modificar la orden.

MercadoPago Checkout Pro Preferences API no documenta `X-Idempotency-Key` para la creación de preferences. Por eso la protección inmediata es local: una nueva solicitud para la misma orden, proveedor y clave devuelve el `payment_attempt` existente y no crea una segunda preference mientras la respuesta inicial haya sido guardada. Para cubrir la ventana extrema de caída después de crear la preference y antes de guardar la respuesta, producción debe añadir reconciliación por `external_reference` o usar el flujo Orders API con `X-Idempotency-Key` cuando el cliente requiera esa garantía del proveedor.

## Checklist antes de activar un cliente

| Control | Verificación |
|---|---|
| Cuenta | Access token y webhook secret pertenecen al mismo negocio/proveedor. |
| URL | Endpoint público HTTPS, con `SLUG_DEL_NEGOCIO` válido. |
| Firma | Stripe Dashboard/CLI y MercadoPago Webhooks usan secretos del ambiente correcto. |
| Base | Migración `0002` aplicada y tablas de pagos presentes. |
| Seguridad | `PAYMENTS_ENCRYPTION_KEY` configurada; no hay secretos en Git. |
| Estados | La orden solo se confirma por webhook verificado, no por `success_url`. |
| Reintentos | Duplicados, firma inválida, timeouts y estados finales tienen pruebas. |
| Operación | Hay plan de rotación de secretos, reembolsos, conciliación y backup. |

## Referencias oficiales

[1]: https://docs.stripe.com/webhooks "Stripe Webhooks"

[2]: https://docs.stripe.com/webhooks/signature "Stripe Webhook Signature Verification"

[3]: https://docs.stripe.com/api/idempotent_requests "Stripe Idempotent Requests"

[4]: https://docs.stripe.com/api/checkout/sessions/create "Stripe Create Checkout Session"

[5]: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks "MercadoPago Webhooks"

[6]: https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/optional-notifications "MercadoPago HMAC Manifest"

[7]: https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post "MercadoPago Create Preference API"
