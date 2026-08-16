# Blueprint de staging: Natalia Rodriguez Studio

## Identificación

| Campo | Valor | Estado |
|---|---|---|
| Cliente | Natalia Rodriguez Studio | Confirmado |
| Rubro | Estética | Confirmado |
| Tipo de negocio | Venta de servicios y cursos en línea; agenda de citas | Confirmado |
| Frontend | Sitio público de servicios/cursos, agenda y checkout | Requiere descubrimiento |
| Backend | Administración de servicios, cursos, agenda, clientes y estados de atención | Confirmado como alcance |
| País/moneda/zona horaria | Por confirmar | `manual_required` |
| Dominio final | Por confirmar | `manual_required` |
| Branding | Logo, colores, tipografías y tono por solicitar | `waiting_for_client` |

## Composición inicial

El staging se construirá desde el preset `services` con una adaptación de estética. La configuración deseada no modificará directamente el Core; se expresará como snapshot de módulos y una extensión versionada.

| Capacidad | Módulo o extensión | Estado para staging | Observación |
|---|---|---|---|
| Oferta de servicios y cursos | `catalogue` | Activable | Los cursos comienzan como productos de catálogo hasta completar la extensión de entrega de contenido. |
| Precios y promociones | `pricing` | Activable | Reglas de precio y promociones básicas. |
| Clientes | `crm` | Activable | Perfil, contacto, consentimiento y etiquetas. |
| Agenda | `reservations` | Activable con setup | Servicios, profesionales, horarios, excepciones y políticas. |
| Reportes base | `reporting` | Activable | KPIs de clientes, catálogo, pedidos y citas disponibles. |
| Notificaciones | `notifications` + outbox mailing | Activable con setup | WhatsApp requiere cuenta WABA y templates; mailing ya tiene outbox idempotente y queda `manual_required` hasta configurar proveedor email. |
| Pagos | `payments` | Pendiente de onboarding | Debe conectarse a la cuenta Mercado Pago/Stripe de Natalia. No se reutilizan credenciales ANC. |
| Venta/checkout | `orders` | Bloqueado hasta completar runtime genérico | Es dependencia necesaria para vender cursos y servicios online con trazabilidad. |
| Cursos online | Extensión `course-delivery` | Runtime staging listo; producción bloqueada | Cursos, lecciones, matrículas y progreso están implementados. El acceso protegido, checkout y contenido privado requieren completar Orders/Payments y almacenamiento seguro. |
| Automatizaciones | `automations` | Preview/manual | Recordatorios y secuencias avanzadas se incorporarán después de cerrar mailing y WhatsApp. |
| Reseñas | `reviews` | Opcional | Se evaluará si Natalia necesita testimonios, encuestas post-cita o reseñas públicas. |

## Flujo propuesto

La primera versión de staging debe permitir registrar servicios, profesionales, horarios y clientes; consultar slots; crear y cancelar citas; preparar plantillas de confirmación; visualizar el catálogo; registrar una estructura de curso; y mostrar claramente qué integraciones todavía están pendientes. El checkout real de servicios y cursos debe esperar a que el módulo `orders` y la cuenta de pagos pasen sus gates. La extensión de cursos puede probarse en staging con contenido de ejemplo, matrícula y progreso, pero no debe exponerse como producto pagado hasta cerrar acceso protegido y fulfillment.

## Preguntas pendientes para la reunión

Antes de provisionar producción se deben confirmar la duración y precio de cada servicio, profesionales, cabinas o recursos, horarios, anticipación mínima, cancelaciones, no-show, datos requeridos del cliente, canales de mailing, templates WhatsApp, modalidad de cursos, acceso por alumno, contenido protegido, pagos, dominio y branding.

## Criterio de aceptación de staging

Staging estará listo cuando el Core, Neon, Vercel, autenticación y roles funcionen; Catálogo, CRM, Precios, Reservas y Reportes pasen sus smoke tests; WhatsApp quede en `manual_required` si faltan credenciales; el panel admin muestre la composición; y ningún módulo bloqueado se active como si estuviera listo. La producción no debe publicarse hasta completar pagos, órdenes, mailing, cursos y aprobación de Natalia.
