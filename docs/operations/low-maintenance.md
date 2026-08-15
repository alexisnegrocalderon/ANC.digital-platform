# Operación de bajo mantenimiento

## Principio

ANC Platform debe operar como un servicio web único y un proyecto Neon por ambiente o cliente cuando el volumen lo justifique. No se introducirán microservicios, colas propias ni servidores persistentes mientras el problema no lo requiera. La modularidad se resuelve en código, esquema y configuración; la infraestructura permanece pequeña y fácil de reemplazar.

## Ambientes

El ambiente local usa `.env` ignorado y el proyecto Neon de desarrollo. El ambiente de preview debe usar variables separadas y, cuando se necesiten pruebas destructivas o migraciones experimentales, una branch temporal de Neon con expiración. Producción debe usar un proyecto o branch protegido diferente, `NODE_ENV=production`, `DATABASE_URL` pooled, `DIRECT_DATABASE_URL` solo para operaciones administrativas y el contexto demo deshabilitado.

| Componente | Desarrollo | Producción inicial |
|---|---|---|
| Código | Repo ANC Platform, branch de trabajo. | Branch `main` desplegada después de checks. |
| Base | Proyecto Neon ANC Platform Core. | Proyecto o branch productiva aislada por cliente o grupo de clientes. |
| Runtime | `DEV_BUSINESS_CONTEXT_ENABLED=true` permitido. | Autenticación real obligatoria; header demo bloqueado. |
| Migraciones | `pnpm run db:generate` y `pnpm run db:migrate`. | Migración revisada con conexión directa y ventana controlada. |
| Datos | Seeds de core y Eventos. | Sin datos demo; carga mediante onboarding. |

## Neon y control de costos

El plan Free de Neon no tiene costo mensual, pero publica límites de proyectos, branches, cómputo, almacenamiento, transferencia e historial. También suspende el cómputo cuando se alcanza un límite del periodo, por lo que se debe presentar comercialmente como una base para desarrollo, demos y negocios pequeños dentro de su capacidad, no como una promesa de gratuidad productiva ilimitada.[1] [2]

El control de costos recomendado es mantener el scale-to-zero donde corresponda, borrar branches temporales, evitar almacenar binarios en PostgreSQL, optimizar consultas con índices por `businessId`, limitar cargas de archivos y revisar almacenamiento/transferencia antes de incorporar un cliente de alto tráfico. Cuando un cliente supera la capacidad gratuita, el producto debe migrar a un plan pagado o a un proyecto aislado sin modificar la aplicación.

## Migraciones y rollback

Toda modificación de esquema se genera desde `drizzle/schema.ts` y se guarda en `drizzle/migrations/`. El runtime nunca debe ejecutar migraciones automáticamente al arrancar. Antes de migrar producción, se debe generar la migración, aplicarla en un branch aislado, inspeccionar las tablas y ejecutar `pnpm test`, `pnpm run check`, `pnpm run build` y la prueba de smoke de Neon.

El plan Free ofrece un historial corto y snapshots limitados; por eso una política de backup comercial no debe depender exclusivamente de Neon Free. Para clientes productivos se debe definir un plan de respaldo, exportación y recuperación que corresponda al volumen y a las obligaciones del negocio.[1] [2]

## Checklist de release

| Control | Criterio |
|---|---|
| Seguridad | No existen credenciales fuera de `.env`; el contexto demo está bloqueado en producción. |
| Integridad | Todas las mutaciones aplican `businessId` y las tablas nuevas tienen restricciones. |
| Calidad | Tests, TypeScript y build pasan en CI antes de desplegar. |
| Base | Migración probada en branch o entorno aislado y aplicada con conexión directa. |
| Costos | Se revisan almacenamiento, transferencia, cómputo y branches de Neon. |
| Rollback | Existe una migración reversible o un procedimiento de restauración documentado para el cliente. |

## Referencias

[1]: https://neon.com/pricing "Neon Pricing Plans"

[2]: https://neon.com/docs/introduction/plans "Neon Plans and Billing"

[3]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"
