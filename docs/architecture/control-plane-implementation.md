# Control plane: implementación del Core

## Rutas

El Core expone bajo `/api/v1/control-plane` las rutas protegidas por JWT Ed25519:

| Método | Ruta | Scope |
|---|---|---|
| `POST` | `/businesses` | `platform.business.write` |
| `GET` | `/businesses/:businessId` | `platform.business.read` |
| `GET` | `/businesses/:businessId/modules` | `platform.modules.read` |
| `GET` | `/businesses/:businessId/health` | `platform.health.read` |
| `POST` | `/businesses/:businessId/modules/operations/preview` | `platform.modules.read` |
| `POST` | `/businesses/:businessId/modules/operations` | `platform.modules.write` |
| `POST` | `/businesses/:businessId/presets/:presetKey/apply` | `platform.modules.write` |

El middleware `verifyControlPlaneRequest` valida `Authorization: Bearer`, algoritmo `EdDSA`, issuer, audience, expiración, `iat`, `jti`, ambiente y scopes. El `businessId` solo identifica el recurso; no reemplaza los controles de autenticación del token ni el alcance concedido a la integración.

## Idempotencia

`POST /businesses` y las operaciones de módulos exigen `Idempotency-Key`. El Core persiste la operación en `control_plane_idempotency` con `client_id`, hash del body, operación, estado, respuesta y expiración. La misma key con el mismo body puede reusar la respuesta; la misma key con un body distinto devuelve `409 IDEMPOTENCY_CONFLICT`.

## Feature flags

Las operaciones activan o desactivan `business_modules` usando el plan topológico del registry. Los presets resuelven dependencias antes de escribir. La desactivación rechaza dependientes activos salvo que se solicite `cascade`. Cada operación genera `audit_events`.

## Variables

Las variables `CONTROL_PLANE_PUBLIC_KEY`, `CONTROL_PLANE_ISSUER`, `CONTROL_PLANE_AUDIENCE` y `CONTROL_PLANE_ENVIRONMENT` son server-only y se exigen en producción. Nunca deben tener prefijo `VITE_`.

## Migración

`drizzle/migrations/0007_zippy_nekra.sql` añade `businesses.environment`, `businesses.external_project_id`, `businesses.public_url`, el índice único por proyecto/ambiente y `control_plane_idempotency`.
