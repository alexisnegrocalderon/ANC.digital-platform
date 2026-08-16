import type {
  BusinessPreset,
  ModuleCapability,
  ModuleCategory,
  ModuleKey,
  ModuleManifest,
  ModuleMaturity,
} from "../../shared/module";

type ModuleMetadata = {
  category: ModuleCategory;
  skillKey: string;
  maturity: ModuleMaturity;
  requiresSetup: boolean;
  setupChecklist: string[];
  capabilities: ModuleCapability[];
};

const MODULE_METADATA: Record<ModuleKey, ModuleMetadata> = {
  catalogue: { category: "offer", skillKey: "modulo-catalogo", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Definir productos o servicios", "Crear categorías"], capabilities: ["public", "admin", "storage"] },
  pricing: { category: "offer", skillKey: "modulo-precios", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Definir moneda", "Configurar reglas de precio"], capabilities: ["public", "admin"] },
  orders: { category: "commerce", skillKey: "modulo-pedidos", maturity: "scaffolded", requiresSetup: false, setupChecklist: ["Definir estados de pedido", "Configurar fulfillment"], capabilities: ["public", "admin"] },
  payments: { category: "commerce", skillKey: "modulo-pagos", maturity: "implemented-hardening", requiresSetup: true, setupChecklist: ["Configurar proveedor", "Registrar webhooks", "Probar sandbox"], capabilities: ["public", "admin", "webhooks", "external_api"] },
  pos: { category: "commerce", skillKey: "modulo-pos", maturity: "planned", requiresSetup: true, setupChecklist: ["Crear cajas", "Asignar operadores"], capabilities: ["admin"] },
  inventory: { category: "commerce", skillKey: "modulo-inventario", maturity: "planned", requiresSetup: true, setupChecklist: ["Definir almacenes", "Cargar existencias iniciales"], capabilities: ["admin", "jobs"] },
  billing: { category: "commerce", skillKey: "modulo-facturacion", maturity: "planned", requiresSetup: true, setupChecklist: ["Configurar datos tributarios", "Seleccionar adaptador"], capabilities: ["admin", "external_api", "webhooks"] },
  crm: { category: "customer", skillKey: "modulo-crm", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Definir campos de cliente", "Configurar consentimiento"], capabilities: ["public", "admin"] },
  campaigns: { category: "customer", skillKey: "modulo-campanas", maturity: "planned", requiresSetup: true, setupChecklist: ["Definir consentimiento", "Configurar canal de campaña"], capabilities: ["admin", "jobs", "external_api"] },
  loyalty: { category: "customer", skillKey: "modulo-fidelizacion", maturity: "planned", requiresSetup: true, setupChecklist: ["Definir reglas de puntos", "Configurar niveles"], capabilities: ["public", "admin"] },
  notifications: { category: "customer", skillKey: "modulo-notificaciones", maturity: "implemented-hardening", requiresSetup: true, setupChecklist: ["Seleccionar canales", "Configurar templates", "Definir preferencias"], capabilities: ["admin", "jobs", "webhooks", "external_api"] },
  reviews: { category: "customer", skillKey: "modulo-resenas", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Definir preguntas", "Configurar moderación"], capabilities: ["public", "admin"] },
  reservations: { category: "operations", skillKey: "modulo-reservas", maturity: "implemented-hardening", requiresSetup: true, setupChecklist: ["Crear servicios", "Definir disponibilidad", "Configurar canal de confirmación"], capabilities: ["public", "admin", "jobs"] },
  access: { category: "operations", skillKey: "modulo-acceso", maturity: "scaffolded", requiresSetup: true, setupChecklist: ["Configurar reglas de acceso", "Asignar operadores"], capabilities: ["public", "admin"] },
  ticketing: { category: "operations", skillKey: "modulo-ticketera", maturity: "scaffolded", requiresSetup: true, setupChecklist: ["Definir tipos de ticket", "Configurar reglas de asistencia"], capabilities: ["public", "admin"] },
  wallet: { category: "commerce", skillKey: "modulo-billetera", maturity: "planned", requiresSetup: true, setupChecklist: ["Definir moneda", "Configurar reglas de consumo"], capabilities: ["public", "admin"] },
  delivery: { category: "commerce", skillKey: "modulo-delivery", maturity: "planned", requiresSetup: true, setupChecklist: ["Definir zonas", "Configurar tarifas", "Configurar despacho"], capabilities: ["public", "admin", "jobs", "external_api"] },
  branches: { category: "offer", skillKey: "modulo-sucursales", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Crear sucursales", "Definir horarios"], capabilities: ["admin"] },
  reporting: { category: "intelligence", skillKey: "modulo-reportes", maturity: "contract-ready", requiresSetup: false, setupChecklist: ["Seleccionar indicadores", "Configurar periodos"], capabilities: ["admin", "jobs"] },
  automations: { category: "intelligence", skillKey: "modulo-automatizaciones", maturity: "contract-ready", requiresSetup: true, setupChecklist: ["Definir triggers", "Configurar acciones", "Revisar permisos"], capabilities: ["admin", "jobs", "webhooks", "external_api"] },
};

const manifest = (
  key: ModuleKey,
  displayName: string,
  description: string,
  dependencies: ModuleKey[] = [],
  verticals: string[] = ["general"],
): ModuleManifest => ({
  key,
  version: "0.1.0",
  displayName,
  description,
  ...MODULE_METADATA[key],
  dependencies,
  permissions: [
    {
      key: `${key}.view`,
      label: `Ver ${displayName}`,
      description: `Consultar la información de ${displayName.toLowerCase()}.`,
    },
    {
      key: `${key}.manage`,
      label: `Administrar ${displayName}`,
      description: `Crear, editar y configurar ${displayName.toLowerCase()}.`,
    },
  ],
  navigation: [
    {
      label: displayName,
      href: `/app/${key}`,
      icon: "layers",
      permission: `${key}.view`,
    },
  ],
  defaultSettings: {},
  verticals,
});

export const MODULE_MANIFESTS: Record<ModuleKey, ModuleManifest> = {
  catalogue: manifest(
    "catalogue",
    "Catálogo",
    "Productos, servicios, variantes, categorías e imágenes para vender o presentar la oferta.",
    [],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  pricing: manifest(
    "pricing",
    "Precios y promociones",
    "Reglas de precios, cupones, descuentos y campañas comerciales.",
    ["catalogue"],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  orders: manifest(
    "orders",
    "Pedidos y checkout",
    "Carritos, pedidos, estados de compra, comprobantes y autoservicio del cliente.",
    ["catalogue"],
    ["general", "events", "restaurant", "retail", "services"],
  ),
  payments: manifest(
    "payments",
    "Pagos",
    "Adaptadores de pago, confirmaciones, reembolsos y referencias de conciliación.",
    ["orders"],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  pos: manifest(
    "pos",
    "Caja y POS",
    "Ventas presenciales, cajas, operadores, cierres y comprobantes.",
    ["payments"],
    ["events", "restaurant", "retail"],
  ),
  inventory: manifest(
    "inventory",
    "Inventario",
    "Existencias, movimientos, reservas de stock y alertas de disponibilidad.",
    ["catalogue"],
    ["restaurant", "retail", "events"],
  ),
  billing: manifest(
    "billing",
    "Facturación",
    "Metadatos de boletas, facturas y adaptadores tributarios.",
    ["orders", "payments"],
    ["general", "events", "restaurant", "retail", "services"],
  ),
  crm: manifest(
    "crm",
    "Clientes",
    "Perfiles, historial, consentimientos, etiquetas y línea de actividad.",
    [],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  campaigns: manifest(
    "campaigns",
    "Segmentación y campañas",
    "Audiencias, segmentos guardados y campañas dirigidas.",
    ["crm"],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  loyalty: manifest(
    "loyalty",
    "Fidelización y membresías",
    "Puntos, niveles, membresías, gift cards y saldos.",
    ["crm"],
    ["retail", "salon", "gym", "restaurant", "events"],
  ),
  notifications: manifest(
    "notifications",
    "Notificaciones",
    "Mensajes transaccionales, recordatorios, plantillas y preferencias.",
    [],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  reviews: manifest(
    "reviews",
    "Encuestas y reseñas",
    "Feedback, calificaciones, encuestas y moderación.",
    ["crm"],
    ["general", "restaurant", "retail", "salon", "gym", "services"],
  ),
  reservations: manifest(
    "reservations",
    "Reservas y agenda",
    "Disponibilidad, citas, recursos, confirmaciones y prevención de conflictos.",
    ["crm", "notifications"],
    ["salon", "gym", "services", "restaurant"],
  ),
  access: manifest(
    "access",
    "Acceso y QR",
    "Emisión, escaneo, validación, controles de uso y registros de acceso.",
    ["crm", "notifications"],
    ["events", "gym"],
  ),
  ticketing: manifest(
    "ticketing",
    "Ticketera y asistencia",
    "Eventos, tipos de entrada, cupos, asistentes y recuperación de tickets.",
    ["catalogue", "orders", "access"],
    ["events"],
  ),
  wallet: manifest(
    "wallet",
    "Billetera y consumo",
    "Saldo precargado, consumos autorizados, descuentos y devoluciones.",
    ["crm", "payments", "pos"],
    ["events"],
  ),
  delivery: manifest(
    "delivery",
    "Delivery y despacho",
    "Zonas, direcciones, asignaciones, estados y retiro en local.",
    ["orders"],
    ["restaurant", "retail"],
  ),
  branches: manifest(
    "branches",
    "Sucursales",
    "Ubicaciones, equipos, horarios, inventario y reportes por sede.",
    [],
    ["retail", "restaurant", "salon", "gym", "services"],
  ),
  reporting: manifest(
    "reporting",
    "Reportes y analítica",
    "Indicadores operativos, ventas, clientes, exportaciones y paneles.",
    [],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
  automations: manifest(
    "automations",
    "Automatizaciones",
    "Reglas, eventos, tareas programadas, webhooks y seguimientos.",
    ["notifications"],
    ["general", "events", "restaurant", "retail", "salon", "gym", "services"],
  ),
};

export const BUSINESS_PRESETS: BusinessPreset[] = [
  {
    key: "events",
    displayName: "Eventos",
    description: "Venta, acceso, consumo y reportes para productoras y eventos.",
    moduleKeys: [
      "catalogue",
      "pricing",
      "orders",
      "payments",
      "crm",
      "notifications",
      "access",
      "ticketing",
      "wallet",
      "pos",
      "reporting",
      "automations",
    ],
    terminology: { customer: "asistente", order: "compra", product: "entrada" },
  },
  {
    key: "restaurant",
    displayName: "Restaurante",
    description: "Menú, pedidos, caja, inventario y despacho.",
    moduleKeys: [
      "catalogue",
      "pricing",
      "orders",
      "payments",
      "pos",
      "inventory",
      "crm",
      "notifications",
      "delivery",
      "reporting",
    ],
    terminology: { customer: "cliente", order: "pedido", product: "producto" },
  },
  {
    key: "salon",
    displayName: "Salón o barbería",
    description: "Servicios, agenda, clientes, pagos y fidelización.",
    moduleKeys: [
      "catalogue",
      "payments",
      "crm",
      "notifications",
      "reservations",
      "loyalty",
      "reviews",
      "reporting",
    ],
    terminology: { customer: "cliente", order: "reserva", product: "servicio" },
  },
  {
    key: "retail",
    displayName: "Retail",
    description: "Catálogo, ventas, inventario, promociones y sucursales.",
    moduleKeys: [
      "catalogue",
      "pricing",
      "orders",
      "payments",
      "pos",
      "inventory",
      "crm",
      "loyalty",
      "branches",
      "reporting",
    ],
    terminology: { customer: "cliente", order: "venta", product: "producto" },
  },
  {
    key: "gym",
    displayName: "Gimnasio o bienestar",
    description: "Membresías, agenda, acceso y relación con clientes.",
    moduleKeys: [
      "catalogue",
      "payments",
      "crm",
      "notifications",
      "reservations",
      "loyalty",
      "access",
      "reporting",
    ],
    terminology: { customer: "miembro", order: "inscripción", product: "plan" },
  },
  {
    key: "services",
    displayName: "Servicios profesionales",
    description: "Oferta de servicios, agenda, clientes, reseñas y automatización.",
    moduleKeys: [
      "catalogue",
      "payments",
      "crm",
      "notifications",
      "reservations",
      "reviews",
      "reporting",
      "automations",
    ],
    terminology: { customer: "cliente", order: "reserva", product: "servicio" },
  },
];

export function getModuleManifest(moduleKey: ModuleKey) {
  return MODULE_MANIFESTS[moduleKey];
}

export function getBusinessPreset(presetKey: string) {
  return BUSINESS_PRESETS.find((preset) => preset.key === presetKey);
}
