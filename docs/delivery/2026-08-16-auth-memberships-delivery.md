# Entrega: autenticación, memberships y roles seguros

**Proyecto:** ANC Platform Core  
**Repositorio:** `alexisnegrocalderon/ANC.digital-platform`  
**Estado:** Implementado, validado y listo para sincronizar.

## Alcance implementado

ANC Platform ahora usa Manus OAuth como identidad externa, sincroniza usuarios en Neon mediante `users.auth_subject`, firma una sesión JWT server-side en cookie HttpOnly y resuelve el negocio activo contra `memberships` antes de ejecutar procedimientos de negocio.

El callback `/api/oauth/callback` valida un nonce de un solo uso en la cookie host-only `__Host-oauth_state` antes de intercambiar el código. El frontend inicia login mediante `/api/auth/login?origin=<window.location.origin>`; no hardcodea dominios ni manipula cookies desde React.

## Roles

| Capa | Roles | Uso |
|---|---|---|
| Plataforma | `user`, `platform_admin` | El segundo puede administrar catálogo, módulos y memberships entre negocios. |
| Negocio | `owner`, `admin`, `manager`, `staff`, `viewer` | Control granular sobre cada tenant mediante una membership activa. |

`platformAdminProcedure` protege el panel global. `businessProcedure` exige sesión y membership en producción. `businessAdminProcedure` limita activación/desactivación de módulos del negocio a `owner` y `admin`.

## Memberships

Se agregaron servicios y endpoints admin para listar miembros por negocio, asignar o cambiar `role_key` y revocar una membership. Cada cambio inserta un `audit_event` con actor, negocio, entidad, acción y metadata. Los endpoints son `admin.memberships.list`, `admin.memberships.setRole` y `admin.memberships.revoke`.

El panel `MembershipAdminPanel` muestra usuarios, email, estado y selector de rol. La UI no concede permisos; únicamente llama procedimientos que vuelven a validar rol y sesión en el backend.

## Migración

La migración `drizzle/migrations/0005_aspiring_warhawk.sql` añade:

```sql
ALTER TABLE "users" ADD COLUMN "platform_role" varchar(32) DEFAULT 'user' NOT NULL;
```

Fue aplicada y verificada en el proyecto Neon separado `ANC Platform Core` (`frosty-flower-33713545`). La tabla `users` contiene la columna `platform_role` con default `user` y restricción `NOT NULL`.

## Seguridad validada

| Prueba | Resultado |
|---|---|
| JWT válido con app id correcto | Aprobado. |
| JWT inválido o de otra app | Rechazado. |
| OAuth state nonce | Round-trip aprobado; state malformado falla cerrado. |
| Cookie HTTPS | HttpOnly, Secure, SameSite y Path verificados. |
| Header `x-business-id` sin sesión en producción | Contexto nulo; acceso rechazado. |
| Admin sin sesión en producción simulada | HTTP `403`. |
| Origin HTTP no local en login | HTTP `400`. |
| Tests | 38 aprobados en 11 archivos. |
| TypeScript y build | Aprobados. |
| Preview | Botón `Ingresar`, panel admin y memberships visibles sin sesión; mutaciones siguen protegidas. |

## Variables necesarias

En producción deben configurarse `VITE_APP_ID`, `OAUTH_SERVER_URL` HTTPS, `VITE_OAUTH_PORTAL_URL` HTTPS y `JWT_SECRET`, además de las variables existentes de Neon, pagos y jobs. El arranque falla cerrado si falta una de estas variables, si queda activo `DEV_BUSINESS_CONTEXT_ENABLED` o si `PUBLIC_APP_URL` no es HTTPS.

## Paso operativo inicial

Después de configurar OAuth, el primer usuario debe ser promovido a `platform_admin` mediante un procedimiento operativo protegido en Neon o una migración controlada. Esa promoción no está expuesta en el frontend ni en el router público.

## Límites actuales

No se ejecutó un login OAuth real en esta sesión porque las credenciales `VITE_APP_ID`, `OAUTH_SERVER_URL` y `VITE_OAUTH_PORTAL_URL` no están configuradas en el entorno local. Se probó el flujo estructural, la firma JWT, el rechazo de origins inseguros y el fail-closed de producción. Antes de publicar se debe probar el callback con una aplicación OAuth real y verificar el dominio de retorno en Manus.

La autenticación protege el admin global y el contexto de negocio. La autorización de permisos finos por cada módulo aún debe ampliarse desde los roles base hacia permisos específicos como `payments.configure`, `reservations.manage` o `crm.export`.

## Archivos principales

```text
server/auth.ts
server/context.ts
server/trpc.ts
server/services/memberships.ts
server/adminRouter.ts
shared/auth.ts
shared/const.ts
client/src/auth.ts
client/src/hooks/useAuth.ts
client/src/components/admin/MembershipAdminPanel.tsx
drizzle/migrations/0005_aspiring_warhawk.sql
docs/architecture/auth-memberships.md
```
