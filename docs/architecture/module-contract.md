# Contrato estándar de módulos y skills

## Separación de responsabilidades

Cada módulo de ANC Platform se compone de una **skill reutilizable** y un **paquete runtime**. La skill explica cómo implementar y adaptar la capacidad; el paquete runtime contiene el código que el core puede activar por negocio. Una skill no se considera evidencia de que el módulo runtime esté listo.

## Manifest obligatorio

Cada entrada del registry debe expresar, como mínimo:

| Campo | Uso |
|---|---|
| `key` | Identificador técnico estable en inglés. Nunca cambia por idioma comercial. |
| `version` | Versión del contrato runtime. |
| `displayName` | Nombre visible en el admin. |
| `description` | Explicación corta para el dueño del negocio. |
| `category` | Grupo comercial: oferta, comercio, clientes, operación o inteligencia. |
| `dependencies` | Otras keys que deben activarse primero. |
| `skillKey` | Nombre técnico de la skill `modulo-*`. |
| `maturity` | `implemented`, `implemented-hardening`, `scaffolded`, `contract-ready` o `planned`. |
| `requiresSetup` | Si necesita configuración antes de considerarse activo para el cliente. |
| `setupChecklist` | Pasos verificables de onboarding. |
| `permissions` | Acciones de lectura y administración. |
| `navigation` | Entradas del panel y permiso requerido. |
| `defaultSettings` | Configuración inicial validable del negocio. |
| `capabilities` | Capacidades expuestas: `public`, `admin`, `jobs`, `webhooks`, `storage`, `external_api`. |
| `verticals` | Presets compatibles. |

## Ciclo de vida por negocio

1. El admin muestra el catálogo global y el negocio seleccionado.
2. El usuario elige un preset o módulos individuales.
3. El core resuelve dependencias y presenta el plan ordenado antes de escribir.
4. La activación crea/actualiza `business_modules` dentro de una operación atómica y registra auditoría.
5. El módulo queda en `pending_setup` si falta un requisito, o en `active` si el health check mínimo pasa.
6. Los settings se validan contra el contrato del manifest y se guardan por negocio.
7. La desactivación revisa módulos dependientes, muestra impacto y bloquea la operación si deja un plan inválido.
8. Los cambios de configuración y estado quedan en `audit_events`.

## Estado administrativo

El estado visible para el dueño del negocio no debe confundirse con `business_modules.enabled`:

| Estado admin | Significado |
|---|---|
| `active` | Habilitado y configuración mínima verificada. |
| `pending_setup` | Habilitado, pero falta completar onboarding o credenciales. |
| `blocked` | No se puede activar por dependencia, permiso o madurez insuficiente. |
| `error` | Se activó, pero el health check detecta un fallo corregible. |
| `disabled` | No está activo para el negocio. |

`business_modules.enabled` sigue siendo el flag técnico de activación. El estado administrativo puede derivarse temporalmente de `settings` y metadata, pero debe migrarse a columnas explícitas si se requiere filtrar o monitorear a escala.

## Estructura runtime

```text
modules/<key>/
  manifest.ts
  service.ts
  router.ts
  tests/
client/src/components/<key>/
docs/architecture/<key>.md
docs/operations/<key>.md
```

El esquema puede vivir en `drizzle/schema.ts` mientras el proyecto mantenga un schema central; `modules/<key>/schema.ts` es opcional y solo debe usarse si el equipo define una estrategia de composición clara. Cada migración debe ser versionada y tener smoke test cuando toca Neon.

## Estructura de skill

```text
/home/ubuntu/skills/modulo-<nombre>/
  SKILL.md
  references/        # solo cuando existan variantes o APIs complejas
  templates/         # solo boilerplate realmente reutilizable
  scripts/           # solo automatizaciones deterministas probadas
```

El `SKILL.md` debe incluir cuándo activar la skill, auditoría del target, decisiones de alcance, contrato de datos, integración con core, seguridad, pruebas, documentación y criterios de entrega. Las referencias deben cargarse progresivamente y no duplicar el cuerpo principal.

## Regla de madurez

La skill puede existir antes que el runtime. El admin debe mostrar la madurez real y evitar prometer una capacidad productiva solo porque exista un manifest o una skill. Para pasar a `implemented`, el módulo debe tener código de dominio, migración, router/servicio, pruebas, documentación y un flujo verificable en el ambiente correspondiente.
