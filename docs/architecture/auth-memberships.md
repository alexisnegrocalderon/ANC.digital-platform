# Autenticación, memberships y roles

## Objetivo

ANC Platform usa Manus OAuth como identidad externa y una sesión JWT firmada server-side para mantener la sesión de la aplicación. Neon conserva el usuario sincronizado, sus memberships y los roles específicos de cada negocio.

> El frontend nunca decide el negocio activo ni el permiso. El backend deriva ambos desde la sesión autenticada y una membership activa.

## Capas de identidad

| Capa | Fuente | Uso |
|---|---|---|
| Identidad externa | Manus OAuth `openId` | Login, intercambio de código y user info. |
| Usuario local | `users.auth_subject` | Relación estable con Neon, nombre, email y `platform_role`. |
| Membership | `memberships` | Vincula usuario con negocio, estado y `role_key`. |
| Contexto | `createContext` | Resuelve usuario, negocio y rol antes de cada procedimiento tRPC. |
| Sesión | Cookie `anc_session` | JWT HttpOnly firmado con `JWT_SECRET`, expiración de un año. |

## Roles globales

`users.platform_role` acepta `user` y `platform_admin`. Solo `platform_admin` puede operar el catálogo global, cambiar módulos de cualquier negocio y consultar auditoría cross-tenant. La autorización se aplica en backend mediante `platformAdminProcedure`.

## Roles por negocio

`memberships.role_key` acepta:

| Rol | Permisos esperados |
|---|---|
| `owner` | Control total del negocio, módulos, settings y miembros. |
| `admin` | Administración operativa y configuración de módulos. |
| `manager` | Operación y configuración limitada; no gestiona membresías críticas. |
| `staff` | Operación de módulos autorizados, sin configuración global. |
| `viewer` | Lectura autorizada. |

La primera implementación usa `owner` y `admin` para las mutaciones de módulos del negocio. `manager`, `staff` y `viewer` quedan definidos para aplicar permisos finos por módulo en la siguiente capa.

## Procedimientos protegidos

| Procedimiento | Requisito |
|---|---|
| `protectedProcedure` | Sesión autenticada. |
| `businessProcedure` | Contexto de negocio; en producción también usuario y membership activa. |
| `businessDatabaseProcedure` | Lo anterior más Neon disponible. |
| `businessAdminProcedure` | Membership con rol `owner` o `admin`. |
| `platformAdminProcedure` | `users.platform_role = platform_admin`; el modo demo solo se acepta fuera de producción. |

## Flujo OAuth

1. El frontend inicia `/api/auth/login?origin=<window.location.origin>` desde un evento de usuario.
2. El backend valida el origin, genera redirect URI y nonce, guarda el nonce en cookie `__Host-oauth_state` y redirige al portal OAuth.
3. `/api/oauth/callback` valida el `state` contra la cookie antes de intercambiar el código.
4. El backend intercambia el código con el servidor Manus, obtiene user info, hace upsert de `users` y firma `anc_session`.
5. Cada solicitud tRPC verifica la cookie JWT, carga el usuario y resuelve la membership del `x-business-id` solicitado.
6. El negocio activo solo se acepta si la membership está activa. Un header no puede otorgar acceso a un negocio ajeno.

## Reglas de seguridad

No confiar en `business_id`, `role_key` ni `platform_role` enviados por el cliente. No aceptar redirect origins HTTP fuera de localhost. No intercambiar el código OAuth si falta o no coincide el nonce. Usar cookies HttpOnly, Secure bajo HTTPS, SameSite adecuado y `JWT_SECRET` obligatorio en producción. No registrar tokens, cookies, códigos OAuth ni payloads completos.

El contexto demo queda limitado a desarrollo con `DEV_BUSINESS_CONTEXT_ENABLED=true`. En producción, una solicitud sin sesión o sin membership activa falla cerrado. Las mutaciones del admin global no deben quedar detrás de `businessDatabaseProcedure`; deben usar `platformAdminProcedure`.

## Migración gradual

El esquema existente ya dispone de `users.auth_subject` y `memberships`. La migración añade `users.platform_role` con default `user`. Los usuarios OAuth nuevos se sincronizan como usuarios normales; la promoción a `platform_admin` debe hacerse mediante migración o procedimiento operativo protegido, nunca desde el frontend público.
