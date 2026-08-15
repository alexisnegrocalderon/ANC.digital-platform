# Investigación oficial de pagos

## 15 de agosto de 2026 — evidencia inicial

### MercadoPago

La documentación oficial indica que MercadoPago envía una firma secreta en el header `x-signature`, con formato que incluye `ts` y `v1`. La verificación requiere extraer la clave de la cabecera y compararla con la clave secreta configurada para la aplicación. El ejemplo oficial también muestra que la validación utiliza `x-signature`, `x-request-id` y `data.id` del query string antes de aceptar la notificación. Fuente: [MercadoPago Webhooks](https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks).

### Stripe

Stripe requiere un endpoint HTTP/HTTPS POST que reciba un evento JSON y firme cada webhook mediante el header `Stripe-Signature`. La firma debe verificarse utilizando el cuerpo raw sin alterar y el endpoint secret; la documentación muestra `Stripe::Webhook.construct_event(payload, signature, endpoint_secret)`. Stripe recomienda responder rápidamente con un estado `2xx` antes de ejecutar lógica compleja que pueda causar timeout. Fuente: [Stripe Webhooks](https://docs.stripe.com/webhooks).

### Consecuencia de diseño

Los endpoints deben conservar el body raw, verificar la firma antes de escribir efectos de negocio, registrar el evento externo antes de procesarlo, responder rápido y procesar de forma idempotente. La identidad idempotente se conservará por proveedor, evento externo y negocio; el payload y el resultado del primer procesamiento se guardarán para que un reintento no vuelva a confirmar, cancelar o duplicar un pedido.

## Referencias

[1]: https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks "MercadoPago Webhooks"

[2]: https://docs.stripe.com/webhooks "Stripe Webhooks"

## Idempotencia

### Stripe

Stripe acepta claves de idempotencia en todas las solicitudes `POST`. Guarda el código de estado y el cuerpo del primer request para una clave, y los requests posteriores con la misma clave reciben el mismo resultado, incluso errores `500`. Stripe compara los parámetros del request original y falla si se reutiliza la clave con parámetros diferentes; las claves pueden eliminarse automáticamente después de al menos 24 horas y no deben contener datos sensibles. Fuente: [Stripe Idempotent requests](https://docs.stripe.com/api/idempotent_requests).

### MercadoPago

La referencia oficial de creación de órdenes de Checkout API exige el header `X-Idempotency-Key` y documenta una longitud permitida de 1 a 150 caracteres. La misma clave se debe generar desde el intento interno de pago y conservar durante reintentos, nunca desde un payload externo no validado. Fuente: [MercadoPago Create order](https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api/create-order/post).

### Consecuencia de diseño

El módulo interno conservará una clave idempotente propia por `businessId` y `orderId`, con una clave de request por intento de proveedor. Para Stripe se enviará como opción idempotente del SDK; para MercadoPago se enviará como `X-Idempotency-Key`. Además de las protecciones de cada proveedor, la base local tendrá una restricción única por proveedor, negocio y clave para impedir dobles efectos dentro de ANC Platform.

## Referencias adicionales

[3]: https://docs.stripe.com/api/idempotent_requests "Stripe Idempotent requests"

[4]: https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api/create-order/post "MercadoPago Create order"

## Contratos de creación y verificación

MercadoPago Checkout API crea órdenes mediante `POST https://api.mercadopago.com/v1/orders`, requiere `Authorization: Bearer ...` y `X-Idempotency-Key`, y soporta `external_reference`, `transactions`, `payer`, `total_amount`, `capture_mode` y `processing_mode`. La referencia documenta respuesta `201` en creación exitosa, errores `409` cuando una clave ya fue usada y `429` con `Retry-After` para rate limit; recomienda reintento con backoff y jitter para límites de cuota. Fuente: [MercadoPago Create order](https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api/create-order/post).

Stripe requiere que `constructEvent()` reciba el body raw string, el header `Stripe-Signature` y el endpoint secret. El body no puede pasar primero por `express.json()` porque cambios de espacios, orden de propiedades o encoding rompen la verificación. Fuente: [Stripe Resolve webhook signature verification errors](https://docs.stripe.com/webhooks/signature).

Para una integración web general Stripe recomienda Checkout Sessions con Payment Element sobre construir directamente PaymentIntents, aunque PaymentIntents queda disponible para flujos complejos. La API de Payment Intents recomienda reutilizar el mismo intent por carrito/sesión y usar idempotency key para evitar duplicados. El servidor debe monitorear webhooks para detectar éxito o falla, y metadata puede asociar el ID interno de la orden sin guardar datos sensibles. Fuente: [Stripe Payment Intents](https://docs.stripe.com/payments/payment-intents).

### Decisión para ANC Platform

El módulo se implementará con un contrato común `PaymentProviderAdapter`. El primer camino Stripe usará Checkout Sessions para reducir código de frontend; MercadoPago usará la Orders API cuando se disponga de las credenciales y configuración del país/Checkout API. La capa de aplicación no dependerá de un SDK específico: los adaptadores usarán `fetch` con timeouts, headers de idempotencia y normalización de estados. Los webhooks se recibirán con rutas Express separadas, body raw y una respuesta rápida después de registrar el evento; la transición de orden se ejecutará dentro de una operación idempotente local.

## Webhooks y checkout hospedado

MercadoPago permite configurar URL de test y producción, recomienda separarlas y usa temas como `payment`, `orders` y `merchant_order`. La documentación indica que la firma se valida con `x-signature`, `x-request-id`, `data.id` y el secreto de la aplicación. Después de recibir una notificación, la plataforma espera `HTTP 200` o `201`; el tiempo de confirmación es de 22 segundos y, si no se confirma, reintenta cada 15 minutos con intervalos posteriores más amplios. Luego de responder se debe consultar el recurso completo en la API, por ejemplo `/v1/payments/{id}` o `/v1/orders/{id}`, y recién entonces actualizar el negocio. Fuente: [MercadoPago Webhooks](https://www.mercadopago.com.mx/developers/en/docs/checkout-pro/additional-content/notifications/webhooks).

MercadoPago Checkout Pro usa la Preferences API para crear una preferencia por cada orden o flujo de pago, con items, quantity y unit_price, y devuelve un preference ID que luego se usa en la integración web para redirigir al checkout hospedado. Fuente: [MercadoPago Create payment preference](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/create-payment-preference).

Stripe Checkout Sessions se crean con `POST /v1/checkout/sessions`, `mode=payment`, line items, `success_url` y opcionalmente `cancel_url`, `client_reference_id` y metadata. La respuesta contiene un `url` de hosted page y un estado inicial `unpaid`. La capa de aplicación puede asociar el ID de orden mediante `client_reference_id` y metadata. Fuente: [Stripe Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create).

## Firma HMAC exacta de MercadoPago

La documentación oficial describe el algoritmo: recibir POST con `x-signature`, `x-request-id` y query `data.id`; extraer `ts` y `v1` desde `x-signature`; construir el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo pares ausentes; calcular `HMAC-SHA256(secret, manifest)` en hexadecimal; y comparar el hash calculado contra `v1` usando comparación constante. Si no coincide, el servidor debe responder `401`. Fuente: [MercadoPago Configure optional notifications](https://www.mercadopago.com.mx/developers/en/docs/checkout-api-orders/optional-notifications).

## Preferencias MercadoPago e idempotencia local

La referencia oficial de `POST /checkout/preferences` documenta `Authorization` como header obligatorio y los campos de items, payer, back URLs y notification URL, pero no documenta `X-Idempotency-Key` en ese endpoint. La idempotencia del checkout hospedado de MercadoPago se garantizará en ANC Platform mediante `payment_attempts` y su clave única; no se enviará un header no documentado a Preferences API. Si un cliente requiere una llamada de Orders API con idempotencia nativa, se podrá agregar otro adaptador usando `POST /v1/orders` y `X-Idempotency-Key`, pero su flujo requiere datos de pago/token y no sustituye Checkout Pro. Fuente: [MercadoPago Create preference API](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post).
