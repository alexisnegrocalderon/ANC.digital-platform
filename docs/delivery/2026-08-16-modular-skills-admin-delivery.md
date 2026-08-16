# Entrega: catálogo modular, 20 skills y admin por cliente

**Proyecto:** ANC Platform Core  
**Repositorio:** `alexisnegrocalderon/ANC.digital-platform`  
**Commit:** `518a810`  
**Estado:** Entregado y sincronizado en `main`.

## Resumen

ANC Platform ahora tiene un catálogo documentado de 20 módulos, metadata técnica enriquecida en el registry y catálogo Neon, 20 skills reutilizables específicas y un panel administrativo integrado al shell para revisar y activar capacidades por negocio.

La skill transversal `modulo-whatsapp` se conserva. Las skills de módulos no reemplazan al código runtime: explican cómo construir y adaptar cada módulo, mientras que el acople real se realiza mediante manifests, dependencias, routers, servicios, migraciones, UI, `business_modules` y auditoría.

## Catálogo de 20 módulos

| Familia | Módulos |
|---|---|
| Oferta y datos base | Catálogo, precios, sucursales |
| Comercio y transacciones | Pedidos, pagos, POS, inventario, facturación, delivery, billetera |
| Clientes y relación | CRM, campañas, fidelización, notificaciones, reseñas |
| Operación y atención | Reservas, acceso, ticketera |
| Inteligencia y control | Reportes, automatizaciones |

La lista canónica quedó en `docs/modules/module-catalog.md`, con nombre comercial, key estable, grupo, dependencias, skill, madurez, configuración requerida, verticales y siguientes pasos.

## Skills entregadas

Se crearon y validaron:

```text
modulo-catalogo
modulo-precios
modulo-pedidos
modulo-pagos
modulo-pos
modulo-inventario
modulo-facturacion
modulo-crm
modulo-campanas
modulo-fidelizacion
modulo-notificaciones
modulo-resenas
modulo-reservas
modulo-acceso
modulo-ticketera
modulo-billetera
modulo-delivery
modulo-sucursales
modulo-reportes
modulo-automatizaciones
```

Todas siguen un workflow común de auditoría, contrato, implementación, setup, seguridad, pruebas y entrega. Cada una declara el alcance real y no presenta un manifest como si fuera una implementación completa.

## Cambios del runtime

El `ModuleManifest` ahora contiene `category`, `skillKey`, `maturity`, `requiresSetup`, `setupChecklist` y `capabilities`. El catálogo Neon sincroniza estos valores dentro de `module_catalog.metadata`.

Se agregó el namespace tRPC `admin` con consultas y mutaciones para listar negocios, consultar catálogo, obtener un plan de activación, habilitar/deshabilitar módulos, actualizar settings, consultar health y leer auditoría de cambios. La activación resuelve dependencias; la desactivación bloquea dependientes activos; los settings se validan contra el manifest.

El panel `ModuleAdminPanel` permite seleccionar cliente, agrupar módulos, revisar madurez, ver dependencias, consultar checklist de setup, aplicar la selección y desactivar módulos individuales. El admin funciona en el preview de desarrollo con el negocio demo. El contexto admin falla cerrado en producción si no existe sesión autenticada.

El módulo de reservas quedó normalizado con el namespace canónico `reservations`, manteniendo aliases de compatibilidad para el código histórico en `modules/bookings`.

## Estado real

| Capacidad | Estado |
|---|---|
| Core, registry y activación | `implemented-hardening`; falta auth/memberships productivos y admin de permisos real. |
| Pagos | `implemented-hardening`; falta sandbox real, reconciliación MercadoPago, refunds, chargebacks y observabilidad. |
| Reservas | `implemented-hardening`; falta auth, reprogramación completa y certificar concurrencia estable. |
| Notificaciones/WhatsApp | `implemented-hardening`; falta WABA sandbox, consentimiento operativo, monitoreo y autorización productiva. |
| Eventos | `implemented-hardening` como preset/vertical compuesto. |
| Otros módulos | `contract-ready`, `scaffolded` o `planned` según el catálogo. |

## Validaciones

| Validación | Resultado |
|---|---|
| `pnpm test` | 31 tests aprobados en 9 archivos. |
| `pnpm run modules:catalog-validate` | 20 keys exactas, sin duplicados, extras, faltantes ni dependencias desconocidas. |
| `pnpm run check` | TypeScript aprobado. |
| `pnpm run build` | Frontend y backend compilados. |
| Skills | 20 skills oficiales validadas con `quick_validate.py`. |
| Calidad de skills | Sin placeholders de plantilla; cada skill enlaza contrato e integraciones relacionadas. |
| Neon | Catálogo sincronizado: 20 filas y 14 módulos activos en `anc-demo`. |
| Preview | Catálogo admin visible, agrupado, con madurez, dependencias, setup y plan de activación. |
| Secretos | Escaneo sin credenciales fuera de archivos locales ignorados y placeholders documentales. |
| Repo activa de eventos | No fue modificada. |

## Límites importantes

Las skills se encuentran creadas y reutilizables, pero solo `payments`, `reservations`, `notifications/WhatsApp` y el vertical Eventos tienen una base runtime funcional en este momento. Los restantes módulos deben implementarse por prioridad, no activarse ante clientes como si estuvieran listos.

La autorización administrativa real todavía depende de terminar autenticación, membresías y roles. El preview usa contexto demo solo en desarrollo; producción bloquea el admin sin sesión. Antes de vender activación autónoma por cliente deben agregarse roles de plataforma, roles de negocio, rate limiting, historial de settings versionado y health checks específicos de cada módulo.

## Siguiente prioridad

El siguiente paso recomendado es completar autenticación/memberships/roles y conectar esos roles al namespace `admin`. Después conviene implementar CRM como dependencia transversal, finalizar sandbox y conciliación de pagos, y convertir catálogo/pedidos en módulos runtime genéricos antes de abrir POS, inventario, facturación y delivery.

## Archivos principales

```text
docs/modules/module-catalog.md
docs/architecture/module-contract.md
docs/audits/2026-08-16-module-admin-preview.md
client/src/components/admin/ModuleAdminPanel.tsx
server/adminRouter.ts
server/services/moduleAdmin.ts
modules/core/registry.ts
modules/core/activation.ts
modules/reservations/router.ts
modules/reservations/service.ts
scripts/validate-module-catalog.ts
```
