# Conexión Neon de ANC Platform

## Proyecto seleccionado

ANC Platform utiliza un proyecto Neon separado del proyecto archivado `Danceroom` de la plataforma de eventos. El proyecto nuevo tiene el identificador `frosty-flower-33713545`, branch principal `br-little-glade-aua5btay` y base `neondb`.

El proyecto `Danceroom` (`flat-darkness-81425539`) se inspeccionó en modo lectura. Su branch `production` está archivado y no se utiliza para ANC Platform. Esta separación evita modificar o mezclar la base de la productora de eventos con el nuevo producto multisectorial.

## Variables locales

Las credenciales viven solamente en `.env`, que está incluido en `.gitignore` y no se debe commitear. El runtime usa `DATABASE_URL` con el endpoint pooled de Neon. Drizzle Kit y las tareas administrativas usan `DIRECT_DATABASE_URL` con el endpoint directo. No se guardan cadenas de conexión en este documento, README, commits, logs ni frontend.

| Variable | Uso | Estado |
|---|---|---|
| `DATABASE_URL` | Runtime web y tRPC mediante `neon-http`. | Configurada localmente. |
| `DIRECT_DATABASE_URL` | Migraciones y administración. | Configurada localmente. |
| `TEST_DATABASE_URL` | Pruebas aisladas futuras. | Pendiente de crear cuando se requiera un branch de test. |

## Validación ejecutada

La prueba `pnpm run neon:smoke` devolvió una respuesta válida desde la base `neondb` usando `@neondatabase/serverless`. La migración inicial se aplicó con Drizzle y fue verificada desde Neon: existen las diez tablas del core en el esquema `public`, además de `drizzle.__drizzle_migrations`.

Las tablas aplicadas son `businesses`, `users`, `memberships`, `module_catalog`, `business_modules`, `site_settings`, `files`, `audit_events`, `domain_events` y `notification_preferences`. La validación confirma conectividad, creación de esquema y separación de la base nueva respecto de Danceroom.

## Regla operativa

Las migraciones deben ejecutarse con la conexión directa. El servidor web debe usar la conexión pooled. Las pruebas destructivas nunca deben apuntar a producción; cuando se agreguen pruebas de integración se debe crear un branch o base aislada y registrar su ciclo de vida.
