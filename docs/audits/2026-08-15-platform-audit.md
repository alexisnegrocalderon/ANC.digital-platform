# Auditoría inicial de ANC Platform

**Fecha:** 15 de agosto de 2026  
**Repositorio de implementación:** `alexisnegrocalderon/ANC.digital-platform`  
**Repositorio de referencia protegido:** `alexisnegrocalderon/candylandwebsite`  
**Sitio público existente:** [ancdigital.cl](https://www.ancdigital.cl/)

## 1. Alcance y regla de protección

Esta auditoría establece una separación estricta entre la plataforma activa de la productora de eventos y el nuevo producto ANC Platform. El repositorio `candylandwebsite` fue clonado en un directorio de inspección independiente únicamente para estudiar su estructura, módulos y decisiones técnicas. No se realizaron cambios, commits, pushes, issues, pull requests ni despliegues sobre ese repositorio.

Todo el trabajo nuevo debe realizarse exclusivamente en `ANC.digital-platform`. El sitio público `www.ancdigital.cl` también se considera un producto existente y queda fuera del alcance de modificaciones directas durante la construcción del core. Sus mensajes, módulos comerciales y lenguaje visual se pueden convertir posteriormente en una capa configurada de la nueva plataforma, pero no se debe usar el sitio activo como área de desarrollo.

## 2. Estado de los repositorios

| Elemento | Estado observado | Decisión |
|---|---|---|
| `candylandwebsite` | Plataforma de eventos activa, rama `main`, working tree limpio en la copia local de auditoría. | Solo lectura y referencia. No modificar. |
| `ANC.digital-platform` | Repositorio nuevo con commit inicial y un `README.md` mínimo. No contiene todavía aplicación, base de datos, backend, frontend ni módulos. | Único target para scaffolding, contratos, implementación y commits. |
| `www.ancdigital.cl` | Sitio público ANC Solutions operativo, con narrativa de plataforma propia, módulos, rubros, eventos y contacto. | Mantener activo y separado del core nuevo. |

La conclusión es que ANC Platform debe iniciarse como una base limpia en el repositorio conectado. No conviene intentar convertir la plataforma de eventos en el producto multisectorial, porque sus decisiones actuales están altamente especializadas en eventos, operación presencial y flujos de acceso.

## 3. Lo que ya existe en la plataforma de eventos

La plataforma activa utiliza React, TypeScript, Vite, Express, tRPC, Drizzle, MySQL mediante `mysql2`, autenticación, almacenamiento de archivos, pruebas con Vitest y despliegue compatible con Vercel. El manifiesto también muestra capacidades de QR, PWA, Dexie para persistencia local, Mercado Pago, PDF, mailing, mapas y Three.js. Fuente de inspección: `candylandwebsite/package.json`.

Su modelo de datos ya cubre una operación de eventos bastante amplia. El esquema contiene tablas para eventos, tipos de ticket, stock, pedidos, ítems de pedido, tickets, descuentos, clientes, operadores, cajas, dispositivos, turnos, cocina, lockers, mailing, gastos, referidos, embajadores y funcionalidades sociales de fiestas. Fuente de inspección: `candylandwebsite/drizzle/schema.ts`.

El router tRPC está organizado por dominios funcionales como `events`, `orders`, `tickets`, `puerta`, `cocina`, `caja`, `operators`, `customers`, `mailing`, `ambassadors`, `discounts`, `expenses`, `devices` y `registers`. También contiene rutas de integración para Mercado Pago, recordatorios, webhooks y generación de contenido. Fuente de inspección: `candylandwebsite/server/routers.ts`.

### Clasificación de reutilización

| Tipo de reutilización | Ejemplos | Tratamiento para ANC Platform |
|---|---|---|
| **Conceptual** | Flujo catálogo/ticket → pedido → pago → QR → acceso; cierre de caja; clientes; mailing; reportes. | Reutilizar como referencia de dominio y convertirlo en contratos genéricos. |
| **Visual o de interacción** | Escáner QR, POS, panel operativo, estados de ticket, interfaces de acceso y uso en móvil. | Reimplementar como componentes y shells genéricos, evitando acoplamiento a eventos. |
| **Código potencialmente reusable** | Helpers de QR, validación, reportes, adaptadores de pago, almacenamiento o PWA. | Revisar archivo por archivo, licencia, dependencias y alcance antes de copiar. La licencia declarada del repositorio es MIT, pero eso no elimina la necesidad de verificar autoría, assets de terceros, credenciales, marcas y código generado. |
| **Vertical específico** | Party profiles, playcoins, lockers, cocina, embajadores de eventos, misiones y reglas de acceso concretas. | No llevar al core. Encapsular como módulos de eventos si se necesitan en el primer vertical. |

La recomendación es **reconstruir el core con límites nuevos**. El repositorio de eventos es valioso como fuente de experiencia de negocio y como referencia de módulos ya probados, pero no debe convertirse por copia acumulativa en una plataforma genérica difícil de mantener.

## 4. Estado técnico del target

`ANC.digital-platform` contiene actualmente solo un README que identifica el proyecto como ANC.studio. No existe una decisión de scaffold, no hay `package.json`, no hay `drizzle.config.ts`, no hay `client/`, `server/`, `shared/`, `modules/` ni migraciones. Esto es positivo para el objetivo: podemos definir desde el comienzo la separación entre core, shells, módulos y presets sin arrastrar deuda estructural.

La primera implementación debe conservar la posibilidad de usar el stack React/TypeScript/Express/tRPC/Drizzle que ya demostró funcionar en la plataforma activa, pero deberá cambiar la capa de persistencia de MySQL a PostgreSQL para cumplir la decisión de Neon. No se deben copiar automáticamente las tablas MySQL ni los enums específicos; deben rediseñarse con `pgTable`, tipos PostgreSQL, claves y restricciones orientadas a multi-negocio.

## 5. Decisión Neon PostgreSQL

Neon publica un plan Free permanente de $0 por mes, con límites de proyectos, branches, cómputo, almacenamiento y transferencia. La información oficial revisada indica, entre otros límites actuales, 100 CU-hours por proyecto al mes, 0,5 GB de almacenamiento por proyecto y 5 GB de transferencia pública; cuando se alcanza un límite del plan Free, el cómputo puede quedar suspendido hasta el siguiente ciclo. Por ello, Neon es una buena base para desarrollo, demos, prototipos y negocios pequeños dentro de sus límites, pero no debe venderse como operación productiva ilimitada.[1] [2]

Drizzle ofrece integración nativa con Neon mediante los drivers `neon-http` y `neon-websockets`, con dialecto PostgreSQL. La aplicación debe usar una conexión pooled para las solicitudes web de corta duración y mantener una conexión directa separada para migraciones y operaciones administrativas que requieran estado de sesión.[3] [4]

| Uso | Variable prevista | Conexión recomendada |
|---|---|---|
| Runtime web y procedimientos tRPC | `DATABASE_URL` | URL pooled de Neon, con SSL requerido. |
| Drizzle Kit, migraciones y administración | `DIRECT_DATABASE_URL` | URL directa de Neon, con SSL requerido. |
| Pruebas aisladas | `TEST_DATABASE_URL` o branch efímero | Base o branch separado; nunca ejecutar pruebas destructivas contra producción. |

Antes de crear las tablas del dominio se debe implementar una prueba de conexión mínima que confirme que el proyecto compila, se conecta a Neon en desarrollo, ejecuta una migración, realiza una transacción y funciona con la configuración de despliegue elegida. Esta prueba será el criterio de salida de la siguiente fase.

## 6. Arquitectura objetivo confirmada

La plataforma será un **monolito modular tipado**, no un conjunto inicial de microservicios. El core común manejará identidad, negocios, membresías, permisos, configuración, branding, archivos, auditoría, módulos habilitados, eventos de dominio y contratos API. Cada módulo agregará su propio esquema, router, servicios, pantallas, permisos, configuración, semillas y pruebas.

La estructura base prevista es:

```text
client/
  src/
    components/
    contexts/
    hooks/
    lib/
    pages/
server/
  _core/
  db/
  routers/
  services/
shared/
modules/
  catalogue/
  orders/
  payments/
  customers/
  reservations/
  ticketing/
  access/
  reporting/
drizzle/
docs/
```

La activación de módulos será declarativa y dependiente del negocio. Activar un módulo validará dependencias, creará ajustes iniciales, registrará navegación y permisos, y opcionalmente cargará datos de ejemplo. Desactivarlo ocultará nuevas operaciones sin destruir el historial.

## 7. Primer vertical recomendado

El primer vertical recomendado sigue siendo **Eventos**, porque es el negocio de ANC con mayor evidencia operativa y porque permite probar el core con flujos integrados: catálogo, tipos de entrada, checkout, pagos, clientes, QR, acceso, POS, consumo, notificaciones y reportes. La implementación no debe trasladar la base de datos de eventos tal como está; debe demostrar que los mismos aprendizajes caben dentro de módulos genéricos y que las reglas específicas quedan dentro del preset de eventos.

El primer hito funcional será un flujo completo y comprobable, no veinte pantallas vacías. La secuencia mínima será: crear negocio, activar preset Eventos, configurar evento, publicar tipos de entrada, comprar desde el sitio, registrar pedido y pago, emitir QR, validar acceso y mostrar el resultado en el panel.

## 8. Decisiones pendientes de implementación

La siguiente fase debe resolver, con pruebas ejecutables, la elección final entre `neon-http` y `neon-websockets` para cada tipo de operación, la autenticación compatible con el target, el proveedor de almacenamiento de archivos, el proveedor de pagos que se abstraerá primero y el mecanismo de despliegue que convivirá con el repositorio GitHub.

También debe definirse si el modelo comercial inicial será un proyecto Neon por cliente o una base multi-negocio con aislamiento lógico. Para el producto vendible, la arquitectura debe soportar ambos escenarios, pero la primera demo puede usar un único negocio dentro de una base de desarrollo. Los límites de Neon hacen recomendable separar clientes de mayor volumen y controlar branches, almacenamiento y transferencia antes de ofrecer una modalidad gratuita.

## 9. Criterio de avance

La fase de auditoría queda completa cuando existe este documento en el repositorio target, la copia local del repositorio activo permanece sin cambios, el target conserva su baseline limpio salvo la documentación de auditoría, y la prueba de conexión Neon/PostgreSQL está definida como el siguiente entregable técnico.

## Referencias

[1]: https://neon.com/pricing "Neon Pricing Plans"

[2]: https://neon.com/docs/introduction/plans "Neon Plans and Billing"

[3]: https://orm.drizzle.team/docs/get-started/neon-new "Get Started with Drizzle and Neon"

[4]: https://neon.com/docs/connect/connection-pooling "Neon Connection Pooling"
