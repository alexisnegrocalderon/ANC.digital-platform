# Auditoría visual del admin de módulos

**Preview:** `http://localhost:3014` expuesto temporalmente  
**Fecha:** 16 de agosto de 2026  

El preview cargó `CORE ONLINE`, el negocio `ANC Platform Demo`, `14 / 20` módulos activos y la sección `04 / PLATFORM ADMIN`. El selector de negocio mostró el demo; el catálogo se agrupó en Oferta y datos base, Comercio y transacciones, Clientes y relación, Operación y atención e Inteligencia y control.

La interfaz mostró nombres comerciales, keys técnicas, dependencias, niveles de madurez, checklists de setup, checkboxes de activación/desactivación y el plan de activación ordenado. La API respondió con metadata persistida desde Neon, incluyendo `category`, `skillKey`, `maturity`, `requiresSetup`, `setupChecklist` y `capabilities`.

Los módulos ya habilitados pero aún no implementados permanecen visibles como `Contrato listo`, `Scaffold parcial` o `Planificado`; esto demuestra que el admin no está presentando el registro como si fuera runtime productivo. Pagos, notificaciones y reservas aparecen como `Implementado / hardening`.

La navegación visual confirmó que el catálogo administrativo ya puede funcionar como punto único para seleccionar capacidades por cliente. La autorización productiva sigue pendiente de auth/memberships/roles: el runtime solo permite el shell demo en desarrollo y bloquea sesiones administrativas anónimas en producción.
