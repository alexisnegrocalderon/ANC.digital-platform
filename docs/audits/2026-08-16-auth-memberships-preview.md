# Auditoría visual de autenticación y memberships

**Preview:** `http://localhost:3016` expuesto temporalmente  
**Fecha:** 16 de agosto de 2026  

El preview cargó `CORE ONLINE` y mostró el botón `Ingresar` en el topbar cuando no existe una sesión OAuth. El panel `04 / PLATFORM ADMIN` siguió visible porque el query string `admin_modules=1` habilita únicamente el preview visual; las mutaciones y consultas administrativas siguen protegidas server-side por `platformAdminProcedure`.

La sección `05 / MEMBERSHIPS & ROLES` cargó el selector de negocio y mostró `0 miembros` para `ANC Platform Demo`, con el mensaje `No hay memberships para este negocio.`. Esto confirma que el frontend no fabrica usuarios ni roles y que el listado depende de la consulta admin.

La prueba HTTP de producción simulada confirmó `403` para `admin.businesses.list` sin sesión y `400` para `/api/auth/login` con origin HTTP no local. La prueba de contexto confirmó que `x-business-id: 1` no crea acceso en producción sin usuario/membership; el contexto demo solo funciona fuera de producción con `DEV_BUSINESS_CONTEXT_ENABLED=true`.
