# Feature flags y composición dinámica por negocio

## Objetivo

Cada cliente debe poder recibir una plataforma compuesta desde el mismo core, sin forks ni despliegues separados. El admin selecciona un negocio, muestra los 20 módulos disponibles, resuelve dependencias y aplica el plan con un clic. El frontend y backend consultan el mismo estado de flags por negocio.

> La fuente de verdad del runtime es `business_modules`; el registry describe la capacidad disponible y el catálogo Neon conserva metadata para el admin. Una skill documenta cómo implementar el módulo, pero no activa código por sí sola.

## Modelo de estado

| Estado | Significado | ¿Permite runtime? | Acción admin |
|---|---|---:|---|
| `disabled` | El negocio no tiene el módulo habilitado. | No | Activar si el módulo está disponible. |
| `active` | Habilitado y configuración mínima lista. | Sí | Configurar o desactivar. |
| `pending_setup` | Habilitado, pero falta completar setup. | Parcial/guarded | Abrir checklist y completar settings. |
| `blocked` | Seleccionado o persistido, pero su runtime no está listo. | No | Mostrar motivo; no venderlo como disponible. |
| `error` | Falló health/configuración/integración. | No o degradado | Revisar health y auditoría. |
| `archived` | El módulo dejó de ofrecerse a nuevos clientes, pero se conserva historial. | Solo lectura si aplica | No permitir nuevas activaciones. |

El campo `business_modules.enabled` representa la activación base. El estado derivado combina `enabled`, madurez del manifest, setup requerido, configuración, dependencias y health. Para una fase posterior conviene añadir `lifecycle_status`, `rollout_percent` y `last_health_at` cuando se necesite rollout gradual.

## Contrato de activación

La operación admin recibe `businessId` y una lista de `moduleKeys` deseados. El backend nunca confía en la lista final enviada por el navegador: valida keys contra el registry, calcula el cierre transitivo de dependencias, rechaza módulos `planned`, `contract-ready` o `scaffolded`, verifica que el actor sea `platform_admin` y persiste la operación de forma idempotente.

El plan devuelto debe incluir `requested`, `ordered`, `alreadyEnabled`, `willEnable`, `blocked`, `missingSetup` y `warnings`. El orden topológico se muestra antes de confirmar para que el administrador entienda por qué se activan módulos adicionales.

## Un clic seguro

1. El administrador selecciona el cliente.
2. El frontend obtiene el catálogo y flags actuales.
3. Al marcar un módulo, consulta el plan de dependencias.
4. El admin muestra un resumen: módulos solicitados, dependencias nuevas, módulos bloqueados y setup pendiente.
5. `Aplicar selección` llama una mutación server-side con idempotency key.
6. El servicio revalida actor, keys, madurez, dependencias y entitlements dentro de una transacción.
7. Se actualizan `business_modules`, `enabledAt`, `disabledAt`, settings por defecto y `audit_events`.
8. El frontend invalida catálogo, health, navegación y estado del tenant.

## Desactivación

Desactivar un módulo no borra datos. El backend rechaza la operación si existen dependientes activos, salvo que el administrador use una operación explícita de cascada que muestre todos los módulos afectados y confirme la acción. Los módulos que guardan historial deben conservar datos y exponerlos en modo lectura cuando corresponda.

## Entitlements comerciales

La activación técnica no debe confundirse con autorización comercial. Un entitlement futuro puede incluir `planKey`, `validFrom`, `validUntil`, `maxUsers`, `maxBranches`, `maxMonthlyTransactions` y `features`. La regla recomendada es:

```text
canActivate = platformAdmin && moduleAvailable && maturityAllowed && entitlementAllows && dependenciesSatisfied
canUse = membershipAllows && featureFlagActive && setupComplete && healthOk
```

En esta primera implementación, el registry y la madurez controlan disponibilidad. El modelo queda preparado para añadir una tabla `business_entitlements` sin reescribir los routers.

## Composición del frontend

Las rutas, navegación, widgets y llamadas tRPC deben consultar flags por negocio. No se debe ocultar un módulo solo en React y asumir seguridad: cada router y servicio debe aplicar un `moduleEnabledProcedure` o un guard de dominio que confirme `business_modules.enabled` y el permiso de la membership.

El shell puede construir navegación desde `navigation` del manifest, filtrando por `enabled`, `setupComplete`, permiso y health. El tenant se puede publicar con una configuración de branding y preset, pero no requiere generar un bundle nuevo por cliente.

## Composición del backend

Los procedimientos por negocio deben resolver el business context desde sesión/membership. Los procedimientos de módulo deben añadir un guard de feature flag. Las operaciones admin globales usan `platformAdminProcedure`; las operaciones del cliente usan `businessAdminProcedure` o permisos específicos.

Los cambios de flags y settings deben generar auditoría con actor, negocio, módulo, estado anterior, estado nuevo, idempotency key y origen. Los jobs y webhooks deben consultar el flag antes de ejecutar efectos externos para evitar enviar mensajes o procesar integraciones de un módulo desactivado.

## Regla comercial para ANC

El admin debe mostrar siempre la diferencia entre `Implementado / hardening`, `Contrato listo`, `Scaffold parcial` y `Planificado`. Solo los dos primeros estados implementados pueden ofrecerse como activación funcional sin advertencia; un módulo no debe activarse para un cliente únicamente porque aparece en el catálogo.
