# ANC Client Discovery Kit

## Propósito

Este documento convierte una reunión de descubrimiento en información accionable para crear una plataforma personalizada sin modificar el Core base. El resultado esperado es un `clientBlueprint`, un preset de módulos, una lista de integraciones, un mapa de roles, una matriz de datos y un plan de staging.

La reunión no debe comenzar por preguntar qué módulo quiere el cliente. Debe comenzar por entender cómo funciona actualmente su negocio, qué procesos generan ingresos, qué tareas se repiten, qué información necesita proteger y qué resultado quiere lograr. Los módulos se seleccionan después de mapear esos procesos.

## 1. Identificación del negocio

| Campo | Respuesta |
|---|---|
| Nombre comercial | |
| Razón social | |
| País, ciudad y zona horaria | |
| Rubro principal | |
| Rubros secundarios | |
| Persona responsable | |
| Correo y teléfono | |
| Dominio actual o dominio deseado | |
| Fecha objetivo de staging | |
| Fecha objetivo de producción | |
| Nivel de soporte esperado | |

## 2. Modelo de negocio

Describir qué vende el negocio, a quién vende, por qué canal vende, cuándo se concreta una venta y cómo se entrega el producto o servicio. Registrar las tres fuentes principales de ingresos y las tres operaciones que más tiempo consumen al equipo.

| Pregunta | Respuesta |
|---|---|
| ¿Qué productos, servicios, entradas o membresías vende? | |
| ¿La venta es presencial, online, por WhatsApp, por redes sociales o mixta? | |
| ¿La venta requiere agenda, stock, cupos o validación de acceso? | |
| ¿Hay pagos parciales, anticipos, cuotas, reembolsos o comisiones? | |
| ¿Cómo se confirma actualmente una venta o reserva? | |
| ¿Cómo se entrega el producto o se presta el servicio? | |
| ¿Qué ocurre cuando el cliente cancela, no asiste o solicita devolución? | |
| ¿Qué indicadores utiliza actualmente para saber si el negocio funciona? | |

## 3. Procesos operativos

Dibujar el flujo real desde que llega una persona hasta que termina la compra o servicio. Para cada paso registrar responsable, sistema actual, información generada, decisiones y fallos frecuentes.

| Proceso | Paso actual | Responsable | Sistema actual | Problema | Resultado deseado |
|---|---|---|---|---|---|
| Captación | | | | | |
| Cotización o selección | | | | | |
| Reserva o pedido | | | | | |
| Pago | | | | | |
| Confirmación | | | | | |
| Entrega, acceso o atención | | | | | |
| Seguimiento | | | | | |
| Recompra o fidelización | | | | | |

## 4. Clientes, usuarios y permisos

Registrar quién opera la plataforma y qué puede hacer cada persona. No crear cuentas compartidas. Cada usuario debe tener identidad individual, rol y negocio asociado.

| Tipo de persona | Cantidad estimada | Acciones permitidas | Datos que puede ver | Rol propuesto |
|---|---:|---|---|---|
| Dueño | | | | `owner` |
| Administrador | | | | `admin` |
| Encargado operativo | | | | `manager` |
| Operador | | | | `staff` |
| Cliente final | | | | `customer` |

## 5. Datos y migración

Determinar qué información debe iniciar la plataforma y cuál puede comenzar vacía. Ofrecer primero importadores estándar CSV/Excel. Las integraciones directas con sistemas anteriores deben registrarse como alcance adicional.

| Entidad | ¿Existe hoy? | Volumen aproximado | Fuente | ¿Importar? | Formato | Responsable de validar |
|---|---:|---:|---|---:|---|---|
| Clientes | | | | | | |
| Productos o servicios | | | | | | |
| Precios | | | | | | |
| Pedidos o ventas | | | | | | |
| Reservas | | | | | | |
| Inventario | | | | | | |
| Historial | | | | | | |

## 6. Marca y experiencia

Solicitar logo en formatos disponibles, colores, tipografías, referencias visuales, tono de comunicación, imágenes, textos, favicon y reglas de uso. Separar lo que ANC configura de lo que el cliente debe entregar.

| Activo | Recibido | Pendiente | Formato o especificación | Aprobado por |
|---|---:|---:|---|---|
| Logo principal | | | | |
| Logo alternativo | | | | |
| Paleta de colores | | | | |
| Tipografías | | | | |
| Fotografías | | | | |
| Textos legales | | | | |
| Catálogo inicial | | | | |
| Dominio | | | | |

## 7. Integraciones y cuentas del cliente

Las integraciones con consumo o credenciales deben pertenecer al cliente. ANC debe guardar referencias y secretos solo server-side, cifrados y auditados. Nunca solicitar credenciales por chat.

| Integración | ¿La necesita? | Dueño de la cuenta | Estado | Próximo paso |
|---|---:|---|---|---|
| Mercado Pago | | Cliente | `manual_required` | Autorizar OAuth desde la cuenta del cliente |
| Stripe | | Cliente | `manual_required` | Conectar cuenta y probar sandbox |
| WhatsApp Cloud API | | Cliente | `manual_required` | Configurar WABA, templates y webhook |
| Correo transaccional | | Cliente/ANC | `manual_required` | Autorizar proveedor |
| Dominio/DNS | | Cliente | `manual_required` | Agregar CNAME o dominio personalizado |
| Analytics | | Cliente | `optional` | Definir medición |
| Almacenamiento | | ANC/Cliente | `optional` | Confirmar política |

## 8. Selección de módulos

La selección debe partir del proceso y no de una lista aislada. Para cada módulo registrar necesidad, prioridad, dependencia, estado de madurez y decisión.

| Módulo | Necesidad observada | Prioridad | Dependencias | Madurez | Decisión | Responsable |
|---|---|---:|---|---|---|---|
| Catálogo | | P0/P1/P2 | — | | | |
| Precios | | P0/P1/P2 | Catálogo | | | |
| Pedidos | | P0/P1/P2 | Catálogo | | | |
| Pagos | | P0/P1/P2 | Pedidos | | | |
| Clientes/CRM | | P0/P1/P2 | — | | | |
| Notificaciones | | P0/P1/P2 | — | | | |
| Reservas | | P0/P1/P2 | CRM, Notificaciones | | | |
| Ticketera | | P0/P1/P2 | Catálogo, Pedidos, Acceso | | | |
| Acceso/QR | | P0/P1/P2 | CRM, Notificaciones | | | |
| Reportes | | P0/P1/P2 | — | | | |
| Automatizaciones | | P0/P1/P2 | Notificaciones | | | |
| Inventario | | P0/P1/P2 | Catálogo | | | |
| Delivery | | P0/P1/P2 | Pedidos | | | |
| Sucursales | | P0/P1/P2 | — | | | |
| Reseñas | | P0/P1/P2 | CRM | | | |
| Fidelización | | P0/P1/P2 | CRM | | | |
| POS | | P0/P1/P2 | Pagos | | | |
| Facturación | | P0/P1/P2 | Pedidos, Pagos | | | |
| Billetera | | P0/P1/P2 | CRM, Pagos, POS | | | |
| Campañas | | P0/P1/P2 | CRM | | | |

Un módulo con madurez `planned`, `scaffolded` o `contract-ready` no debe entrar automáticamente a producción. Puede registrarse como necesidad del cliente y quedar en `roadmap`, `manual_required` o `custom_scope`.

## 9. Preset y manifest preliminar

| Campo | Valor |
|---|---|
| Preset recomendado | |
| Versión del preset | |
| Módulos base activos | `catalogue`, `crm`, `notifications`, `reporting` |
| Módulos adicionales | |
| Módulos solicitados pero bloqueados | |
| Integraciones pendientes | |
| Límites personalizados | |
| Tipo de extensión requerida | `none`, `ANC-reusable`, `client-exclusive` |
| Versión inicial del Core | |
| Branch Neon staging | |
| Subdominio técnico | |
| Estado del blueprint | `draft` |

## 10. Aprobaciones

Antes de provisionar staging, ANC debe aprobar el blueprint técnico y la condición comercial. Antes de producción, el cliente debe aprobar branding, contenido, dominio, usuarios iniciales, integraciones y comportamiento principal.

| Gate | Aprobado por | Fecha | Evidencia |
|---|---|---|---|
| Datos del negocio completos | ANC | | |
| Blueprint y preset | ANC | | |
| Recursos técnicos provisionados | ANC | | |
| Branding y contenido | Cliente | | |
| Integraciones | Cliente/ANC | | |
| Pruebas de aceptación | Cliente/ANC | | |
| Publicación producción | ANC + Cliente | | |

## Resultado de la reunión

La reunión debe terminar con un resumen de una página: problema principal, flujo de negocio, módulos P0, integraciones, datos iniciales, riesgos, información pendiente y próxima decisión. No se debe prometer un módulo solo porque aparece en el catálogo. El catálogo expresa capacidad planificada; el blueprint expresa la configuración deseada; el runtime y los gates expresan lo que realmente puede publicarse.
