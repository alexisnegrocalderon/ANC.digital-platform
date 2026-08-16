# Primera ola runtime: base, Precios, Ticketera y Acceso

## Alcance

Esta entrega convierte los módulos `catalogue`, `crm`, `reporting`, `pricing`, `ticketing` y `access` en capacidades runtime acoplables al Core. Se mantienen separados los procesos de pagos, Mercado Pago, reservas y WhatsApp; esta entrega no cambia sus contratos financieros ni sus credenciales.

## Implementación

| Módulo | Runtime | Persistencia | Router | UI | Estado |
|---|---|---|---|---|---|
| Catálogo | Productos/servicios, búsqueda, estados, archivado | `catalogue_items` | `catalogue.*` | Panel base | `implemented-hardening` |
| CRM | Clientes, búsqueda, consentimiento, etiquetas, archivado | `customers` | `crm.*` | Panel base | `implemented-hardening` |
| Reportes | KPIs de catálogo, clientes, pedidos y citas | Usa tablas del Core | `reporting.*` | Panel base | `implemented-hardening` |
| Precios | Reglas fija, porcentaje y monto; prioridad y ventana de vigencia | `pricing_rules` | `pricing.*` | Contrato runtime | `implemented-hardening` |
| Ticketera | Eventos, tipos de entrada, cupos, órdenes y tickets | Esquema Eventos existente | `events.*` | Panel Eventos | `implemented-hardening` |
| Acceso | Validación QR/uso único y logs de acceso | `access_logs` existente | `access.*` | Operación de acceso | `implemented-hardening` |

## Validación

La migración 0008 creó `catalogue_items` y `customers` en el proyecto Neon `ANC Platform Core`. La migración 0009 creó `pricing_rules`. La verificación administrada de Neon confirmó claves foráneas, índices por `business_id`, unicidad de slug/external key y ventanas de precio.

El smoke de base confirmó creación, lectura, reporte y limpieza de Catálogo/CRM. El smoke de Precios confirmó que una base de `10000` centavos con regla de descuento `1500` puntos base retorna `8500` centavos. El suite completo pasó con 45 pruebas, TypeScript, build y validación exacta de las 20 keys.

## Regla de activación

El admin solo debe activar módulos con madurez `implemented-hardening` y dependencias saludables. `orders`, `inventory`, `delivery`, `reviews`, `branches`, `automations` y los módulos `planned` permanecen visibles como roadmap o preview, pero no son activables productivamente.

## Siguiente ola

El siguiente lote recomendado es `orders` genérico y después `inventory`/`delivery` para comercios y restaurantes. Para el primer cliente real, el kit de descubrimiento debe decidir si se usa Eventos, Servicios/Reservas o solo la base universal antes de activar módulos adicionales.
