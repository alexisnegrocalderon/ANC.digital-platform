# Contratos del core ANC Platform

## Propósito

ANC Platform se implementará como un monolito modular tipado. El core es responsable de las capacidades que todos los negocios necesitan, mientras que cada módulo agrega una capacidad de negocio activable. Los módulos no se convierten en microservicios ni se cargan como código arbitrario en runtime; se registran en el repositorio y se habilitan mediante configuración.

## Contrato de módulo

Cada módulo debe exponer una manifest con `key`, `version`, `displayName`, `description`, `dependencies`, `permissions`, `navigation`, `defaultSettings` y `verticals`. El tipo canónico vive en `shared/module.ts` y el registro inicial vive en `modules/core/registry.ts`.

La activación de un módulo seguirá este orden: validar que la clave existe; comprobar que las dependencias están activas o pueden activarse; crear o actualizar la fila de configuración del negocio; registrar permisos y navegación; cargar ajustes predeterminados; y escribir un evento de auditoría. La desactivación solo impide nuevas operaciones y oculta la navegación; nunca debe borrar la historia de negocio.

## Aislamiento por negocio

Toda tabla de negocio debe incluir `businessId` y una relación hacia `businesses.id`. Toda consulta protegida debe recibir el contexto del negocio y aplicar el filtro en la misma función que ejecuta el acceso a datos. Las funciones que acepten un ID externo deben verificar primero la pertenencia del registro al negocio actual. Los tests negativos de aislamiento son obligatorios para cada módulo.

El primer runtime puede operar con un negocio inicial, pero el esquema debe soportar múltiples negocios desde el comienzo. Esto permite desplegar una instancia aislada por cliente o varias cuentas dentro de una misma aplicación sin rehacer el modelo de datos.

## Identidad y permisos

El core separa la identidad global (`users`) de la pertenencia a un negocio (`memberships`). Los roles comienzan con `owner`, `admin`, `manager`, `staff` y `viewer`, aunque el almacenamiento usa una clave extensible para no bloquear futuros roles sectoriales. Las rutas administrativas deben exigir membresía activa y el permiso específico del módulo, no solo una condición global de administrador.

## Tiempo y dinero

Los timestamps se almacenan como `timestamp with time zone` y se tratan como UTC en la API. Cada negocio conserva su `timezone` para presentación y reglas de agenda. Los importes monetarios se almacenarán como enteros en la unidad mínima de la moneda del negocio, junto con `currency`; no se usarán números flotantes para precios, descuentos, cobros o saldos.

## Neon runtime y migraciones

La aplicación usa `DATABASE_URL` para la conexión pooled de runtime. Drizzle Kit usa preferentemente `DIRECT_DATABASE_URL` para generar y aplicar migraciones, porque la conexión directa es adecuada para operaciones administrativas y evita limitaciones del pool transaccional. En pruebas se usará una base o branch aislado mediante `TEST_DATABASE_URL`.

La ausencia de estas variables no debe impedir `pnpm run check` ni el arranque del shell de desarrollo. Sin embargo, cualquier procedimiento que requiera persistencia debe fallar con un mensaje explícito y seguro, nunca con una conexión silenciosa a una base equivocada.

## Archivos y media

El core conserva metadatos en `files` y referencias a almacenamiento, no bytes binarios dentro de PostgreSQL. Cada archivo pertenece a un negocio y registra quién lo subió, tipo MIME, tamaño, clave de almacenamiento y URL. La implementación del proveedor de almacenamiento debe quedar detrás de un adaptador para que el core no dependa de una única infraestructura.

## Eventos y auditoría

Las mutaciones críticas deben producir un registro de auditoría con actor, negocio, acción, entidad, ID y metadatos mínimos. Los eventos de dominio se almacenan con `eventType`, `aggregateType`, `aggregateId` y payload. Los workflows de notificación y automatización consumirán eventos de dominio de forma idempotente; no se debe depender de polling frecuente para las operaciones normales.

## Referencias

[1]: https://orm.drizzle.team/docs/get-started/neon-new "Get Started with Drizzle and Neon"

[2]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"
