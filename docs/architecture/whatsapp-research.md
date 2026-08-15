# Investigación oficial: WhatsApp Business Platform

## Hallazgos confirmados

Meta documenta que la WhatsApp Business Platform envía webhooks HTTP con payloads JSON al endpoint configurado. El campo `messages` informa mensajes entrantes y estados de mensajes salientes; el endpoint debe suscribirse a los campos deseados desde la configuración de la aplicación. Meta también documenta permisos separados para webhooks de mensajes y otros eventos, payloads de hasta 3 MB y reintentos de entrega durante hasta 7 días cuando el endpoint no responde con HTTP 200. [1]

Para ANC Platform esto implica un endpoint HTTPS por instalación o negocio, recepción rápida, deduplicación por `wamid`/ID de evento y procesamiento durable en Neon. La integración debe registrar el estado del envío (`queued`, `sent`, `delivered`, `read`, `failed`) y conservar el error de proveedor sin guardar tokens en payloads.

Meta documenta que los templates son activos de una cuenta de WhatsApp Business que pueden enviarse por Cloud API. Son el único tipo de mensaje que puede enviarse fuera de la ventana de atención al cliente. Cada plantilla debe tener nombre, idioma, categoría y componentes; las categorías son `authentication`, `marketing` o `utility`, y las variables son responsabilidad de la aplicación. [2]

Las confirmaciones y recordatorios de reservas deben ser plantillas `utility`, con variables como nombre, servicio, fecha, hora, negocio y enlace de gestión. El módulo no debe intentar enviar texto libre fuera de la ventana de atención. La creación/aprobación de templates será una actividad de onboarding del negocio; el código solo enviará templates aprobadas.

## Opciones consideradas

| Enfoque | Tradeoffs | Costo | Complejidad |
|---|---|---|---|
| **Meta WhatsApp Cloud API directa** | Control completo, menos intermediarios y adaptación por negocio; cada cliente debe aportar WABA, número, token y templates aprobadas. | Sin proveedor intermediario; sujeto a cargos/políticas de Meta y operación de cada WABA. | Media-alta por onboarding, tokens, templates y webhooks. |
| BSP oficial de WhatsApp | Onboarding y soporte comercial más simple, posibles herramientas multi-cuenta y facturación centralizada; añade dependencia y margen del proveedor. | Suscripción o margen del BSP más cargos de Meta. | Media para el producto, menor para cada cliente. |
| Enlace `wa.me` / WhatsApp Business manual | Casi sin backend ni credenciales y útil como fallback; no permite confirmaciones automáticas, estados, templates ni reintentos controlados. | Bajo costo técnico, alto trabajo manual. | Baja, pero no cumple automatización completa. |

Se implementará la Cloud API directa como adaptador base y se dejará la interfaz `WhatsAppProvider` abierta para agregar un BSP sin modificar reservas. El fallback inicial será registrar la notificación como `manual_required` y mostrar un enlace `wa.me`, nunca fingir que el mensaje fue enviado.

## Referencias

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta WhatsApp Webhooks Overview"

[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Meta WhatsApp Template Fundamentals"

[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages "Meta WhatsApp Send Messages"

Meta también documenta que los mensajes libres solo pueden enviarse durante una ventana de atención de 24 horas iniciada por un mensaje o llamada del usuario; fuera de esa ventana solo se pueden usar plantillas aprobadas, y el usuario debe haber dado opt-in para recibir mensajes. [3]

La documentación de WhatsApp Flows describe interacciones estructuradas para mensajería empresarial. Meta menciona Flows como una forma de construir experiencias guiadas y muestra casos que pueden adaptarse a distintos usos. ANC Platform podrá incorporar un Flow de reserva como segunda etapa, pero la disponibilidad y confirmación final deben seguir siendo transaccionales en el backend para evitar doble reserva. [4]

[4]: https://developers.facebook.com/documentation/business-messaging/whatsapp/flows "Meta WhatsApp Flows"
