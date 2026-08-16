# Auditoría visual del sistema de feature flags

**Preview:** `http://localhost:3018` expuesto temporalmente  
**Fecha:** 16 de agosto de 2026  

El preview cargó el admin con el selector de negocio `ANC Platform Demo`, el selector `Preset inicial` y las opciones Eventos, Restaurante, Salón o barbería, Retail, Gimnasio o bienestar y Servicios profesionales. También se muestra el botón `Aplicar preset` junto a `Aplicar selección`.

El catálogo presenta 20 módulos, sus estados de madurez, dependencias, checklist y el plan ordenado de activación. El negocio demo muestra `14 / 20` módulos activos. La agenda y Eventos continúan cargando desde Neon, por lo que el nuevo flujo no rompe los módulos existentes.

La UI confirma el objetivo operativo: seleccionar negocio, escoger preset para armar una base inicial con dependencias y luego activar/desactivar capacidades individuales. La autorización real continúa en el backend; el parámetro `admin_modules=1` solo habilita la vista de preview y no concede permisos de mutación.
