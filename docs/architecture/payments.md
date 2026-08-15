# Módulo de pagos multi-proveedor

## Objetivo

El módulo `payments` conecta órdenes del core con MercadoPago y Stripe sin que el resto de ANC Platform conozca la API de cada proveedor. El diseño prioriza checkout hospedado, webhooks firmados, idempotencia local y del proveedor, y una máquina de estados explícita por negocio.

> La confirmación del pago siempre proviene de un webhook verificado o de una consulta server-to-server al proveedor. La URL de éxito del navegador nunca confirma por sí sola una orden.

## Dos opciones consideradas

| Enfoque | Tradeoffs | Costo | Complejidad |
|---|---|---|---|
| **Adaptadores en el backend actual con Checkout hospedado** | Menos código de frontend y mantiene el flujo dentro del monolito; requiere conservar body raw y administrar secretos por negocio. | Sin infraestructura adicional; solo las comisiones de cada proveedor. | Media; dos adaptadores y dos verificadores de firma. |
| Checkout personalizado con SDK de cada proveedor en el navegador | Permite UI muy controlada y métodos avanzados, pero aumenta superficie PCI, dependencia de SDKs, estados de 3DS y mantenimiento por proveedor. | Sin servidor adicional, pero mayor costo de implementación y soporte. | Alta. |

Se implementará la primera opción porque es la más coherente con una plataforma vendible, modular y de bajo mantenimiento. Stripe usará Checkout Sessions hospedado. MercadoPago usará Checkout Pro mediante Preferences API, con redirección al checkout del proveedor. El contrato interno quedará abierto para agregar Payment Intents o Checkout API cuando un cliente necesite un flujo personalizado.

## Modelo de datos

La migración agregará tres tablas. `payment_provider_accounts` representa la conexión de un negocio con un proveedor; sus secretos se cifran con `PAYMENTS_ENCRYPTION_KEY` y nunca se devuelven al frontend. `payment_attempts` representa cada intento interno asociado a una orden o referencia de negocio. `payment_webhook_events` conserva el identificador externo, tipo, hash/payload redacted, resultado y estado de procesamiento para evitar efectos duplicados y permitir reintentos controlados.

| Tabla | Responsabilidad | Restricción clave |
|---|---|---|
| `payment_provider_accounts` | Credenciales y configuración por negocio/proveedor. | Un registro por `businessId + provider`; secretos cifrados. |
| `payment_attempts` | Checkout, monto, estado interno e IDs externos. | Un `idempotencyKey` por `businessId + provider + operation`; proveedor externo único cuando existe. |
| `payment_webhook_events` | Ingreso y procesamiento idempotente de webhooks. | Un evento externo por `businessId + provider + externalEventId`. |

Los montos se almacenan como enteros en unidades menores y la moneda como código ISO de tres letras. Los pagos no almacenan números de tarjeta, CVV ni secretos del proveedor. Los payloads de webhook se guardan redacted y con límites de tamaño; el body raw se usa para validar firma y no se persiste completo.

## Máquina de estados

Los estados internos son `created`, `pending`, `requires_action`, `approved`, `failed`, `cancelled`, `expired`, `refunded` y `partially_refunded`. Solo transiciones monotónicas o explícitamente permitidas actualizan una orden: `approved` puede activar fulfillment y pasar el `paymentStatus` de la orden a `paid`; `failed`, `cancelled` y `expired` no entregan tickets; `refunded` y `partially_refunded` producen eventos de dominio para reversos posteriores.

| Estado proveedor | Estado ANC | Acción |
|---|---|---|
| Stripe `checkout.session.completed` con `payment_status=paid` | `approved` | Marcar intento y orden pagados una sola vez. |
| Stripe `payment_intent.payment_failed` | `failed` | Registrar error sin entregar producto. |
| Stripe `checkout.session.expired` | `expired` | Cerrar intento sin cobrar. |
| MercadoPago `approved` / orden procesada | `approved` | Confirmar orden después de consulta server-to-server. |
| MercadoPago `rejected`, `cancelled`, `expired` | `failed` o `cancelled` | Conservar razón y no duplicar reversos. |
| Evento repetido | Estado actual | Responder 200/204 sin repetir efectos. |

## Idempotencia

La capa de aplicación genera una clave determinista por intento de checkout y la guarda antes de llamar al proveedor. Repetir la misma operación devuelve el intento existente y no crea un segundo checkout. Stripe recibe esa clave como `Idempotency-Key`; MercadoPago Checkout Pro Preferences API no documenta ese header en su endpoint de preferences, por lo que ANC Platform depende de la restricción local y de la reutilización del `payment_attempt`. Las llamadas futuras a MercadoPago Orders API podrán usar `X-Idempotency-Key` cuando el flujo requiera token de pago y creación de orden compatible.

Al recibir un webhook, el servidor verifica la firma, inserta `payment_webhook_events` con `on conflict do nothing` y procesa únicamente si la inserción fue nueva. Un evento existente con estado `processed` se considera duplicado exitoso. Un evento `failed` puede reintentarse de forma controlada; el handler no puede aplicar dos veces la transición a `approved`.

## Rutas

| Ruta | Método | Uso |
|---|---|---|
| `/api/trpc/payments.createCheckout` | tRPC mutation | Crear o reutilizar un checkout para una orden. |
| `/api/trpc/payments.getStatus` | tRPC query | Consultar estado interno; no confirma por URL de retorno. |
| `/api/payments/webhooks/stripe/:businessSlug` | POST raw | Verificar `Stripe-Signature`, registrar y procesar eventos. |
| `/api/payments/webhooks/mercadopago/:businessSlug` | POST raw | Verificar `x-signature`, `x-request-id` y `data.id`, registrar y consultar recurso. |
| `/api/trpc/payments.configureProvider` | tRPC mutation protegida | Guardar o actualizar credenciales cifradas; pendiente de auth productiva. |

Los endpoints webhook se montan antes de `express.json()`. Stripe necesita el body UTF-8 exacto y MercadoPago necesita query `data.id`; cualquier firma inválida responde `401`. Después de una firma válida, el sistema registra y procesa dentro del límite de respuesta del proveedor. Las respuestas duplicadas son `200` sin repetir efectos.

## Secretos y configuración

| Variable | Uso |
|---|---|
| `PAYMENTS_ENCRYPTION_KEY` | Clave base64 de 32 bytes para cifrar secretos por negocio. Obligatoria en producción si se configuran cuentas por negocio. |
| `STRIPE_SECRET_KEY` | Cuenta Stripe global opcional para desarrollo. |
| `STRIPE_WEBHOOK_SECRET` | Secreto global Stripe opcional para desarrollo. |
| `MERCADOPAGO_ACCESS_TOKEN` | Token global MercadoPago opcional para desarrollo. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto global MercadoPago opcional para desarrollo. |
| `PUBLIC_APP_URL` | Base HTTPS para URLs de éxito, cancelación y webhooks. |

La implementación soportará configuración global para smoke tests y configuración cifrada por negocio para el producto vendible. La autenticación y autorización de la mutación administrativa no debe depender de `x-business-id` cuando `NODE_ENV=production`.

## Referencias oficiales

[1]: https://docs.stripe.com/webhooks "Stripe Webhooks"

[2]: https://docs.stripe.com/webhooks/signature "Stripe Webhook Signature Verification"

[3]: https://docs.stripe.com/api/idempotent_requests "Stripe Idempotent Requests"

[4]: https://docs.stripe.com/api/checkout/sessions/create "Stripe Create Checkout Session"

[5]: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks "MercadoPago Webhooks"

[6]: https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/optional-notifications "MercadoPago HMAC Manifest"

[7]: https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/create-payment-preference "MercadoPago Create Payment Preference"

[8]: https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api/create-order/post "MercadoPago Create Order and Idempotency"
