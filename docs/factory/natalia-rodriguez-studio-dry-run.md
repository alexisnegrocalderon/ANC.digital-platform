# Dry-run de provisioning: Natalia Rodriguez Studio

## Estado

| Campo | Valor |
|---|---|
| Cliente | Natalia Rodriguez Studio |
| Vertical | Servicios / Estética |
| País | Chile |
| Moneda | CLP |
| Zona horaria | `America/Santiago` |
| Slug | `retiro-acrocordones` |
| Preset | `services-v1` adaptado a estética |
| Ambiente | `staging` |
| Modo | `dry_run` |
| Recursos reales creados | Ninguno |
| Aprobación ANC | Pendiente |
| Aprobación cliente | Pendiente |
| Producción | Bloqueada |

## Manifest aplicado al preview

El preview propone activar `catalogue`, `pricing`, `crm`, `reservations`, `reporting` y `notifications`. La extensión `course-delivery` queda disponible para staging, pero su acceso pagado y contenido privado están bloqueados hasta completar Orders, Payments y storage protegido.

La cuenta propia de Mercado Pago de Natalia está confirmada, pero sus credenciales todavía deben configurarse en el entorno aislado. WhatsApp Cloud API propio también está confirmado, pero requiere WABA, token, plantillas y webhook. `orders` queda bloqueado por madurez runtime.

El módulo de mailing ya tiene integración técnica con **Resend** y outbox idempotente. La entrega permanece `manual_required` hasta que Natalia compre un dominio, se verifique un dominio o subdominio de envío en Resend y se configure `RESEND_API_KEY` junto con `RESEND_FROM_EMAIL`. El plan Free de Resend es adecuado para la etapa inicial, siempre sujeto a sus límites vigentes y a la verificación del dominio.

## Pasos del job

| Paso | Proveedor | Resultado dry-run | Estado esperado |
|---|---|---|---|
| Preparar manifest | Interno | Generar snapshot de blueprint, branding, `es-CL`, CLP y Santiago | `ready` |
| Crear repositorio privado | GitHub | Repo planificado desde template ANC | `manual_required` hasta conectar GitHub App |
| Crear proyecto Vercel | Vercel | Proyecto planificado con dominio técnico | `manual_required` hasta conectar Vercel |
| Crear proyecto/branch Neon | Neon | Proyecto y branch `staging` planificados | `manual_required` hasta conectar Neon Factory |
| Variables server-only | Manual | Lista generada; no se imprimen secretos | `manual_required` |
| Configurar Resend | Manual / Resend | API key, remitente y dominio verificado | `manual_required` hasta comprar/verificar dominio |
| Configurar Mercado Pago | Manual / cliente | Credenciales propias de Natalia | `manual_required` |
| Configurar WhatsApp | Manual / cliente | WABA, token, templates y webhook | `manual_required` |
| Deploy staging | Manual | Commit y deployment esperados | `manual_required` |
| Health del Core | Interno | Se ejecuta después del deployment | `pending` |

## Recursos planificados

| Recurso | Nombre técnico provisional |
|---|---|
| GitHub repo | `retiro-acrocordones-platform` |
| Vercel project | `retiro-acrocordones` |
| Neon project | `retiro-acrocordones` |
| Staging URL | `https://retiro-acrocordones-staging.ancdigital.cl` |
| Resend sender sugerido | `hola@<dominio-de-natalia>` o `notificaciones@<dominio-de-natalia>` |
| Producción URL | Dominio de Natalia, pendiente de compra |

## Variables previstas para staging

| Variable | Estado | Observación |
|---|---|---|
| `DATABASE_URL` | Pendiente | Neon pooled URL del staging |
| `DIRECT_DATABASE_URL` | Pendiente | Neon direct URL para migraciones |
| `PUBLIC_APP_URL` | Pendiente | URL HTTPS del staging |
| `MAILING_ENABLED` | `false` inicialmente | Activar solo después de configurar Resend |
| `RESEND_API_KEY` | Pendiente | Secreto server-only de Natalia |
| `RESEND_FROM_EMAIL` | Pendiente | Debe usar dominio verificado |
| `MERCADOPAGO_ACCESS_TOKEN` | Pendiente | Credencial de la cuenta propia del cliente |
| `MERCADOPAGO_WEBHOOK_SECRET` | Pendiente | Secret del webhook del cliente |
| WhatsApp secrets | Pendiente | Nunca se exponen al frontend |

## Aprobación requerida

El dry-run ya incorpora los datos confirmados por ANC. No se debe ejecutar el provisioning real hasta confirmar el owner interno que aprobará la creación de recursos, conectar las integraciones de GitHub/Vercel/Neon y definir el dominio de producción de Natalia. El staging técnico de ANC puede existir sin dominio final del cliente; el mailing productivo no debe activarse sin dominio verificado.

El dry-run no modifica Mercado Pago, ventas, liquidaciones ni comisiones ANC.

## Referencias

[1]: https://resend.com/pricing "Resend Pricing"
[2]: https://resend.com/docs/send-with-nodejs "Resend Node.js SDK"
[3]: https://resend.com/docs/dashboard/domains/introduction "Resend Verified Domains"
