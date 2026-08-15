export type ModuleKey =
  | "catalogue"
  | "pricing"
  | "orders"
  | "payments"
  | "pos"
  | "inventory"
  | "billing"
  | "crm"
  | "campaigns"
  | "loyalty"
  | "notifications"
  | "reviews"
  | "reservations"
  | "access"
  | "ticketing"
  | "wallet"
  | "delivery"
  | "branches"
  | "reporting"
  | "automations";

export type ModulePermission = {
  key: string;
  label: string;
  description: string;
};

export type ModuleNavigationItem = {
  label: string;
  href: string;
  icon?: string;
  permission?: string;
};

export type ModuleManifest = {
  key: ModuleKey;
  version: string;
  displayName: string;
  description: string;
  dependencies: ModuleKey[];
  permissions: ModulePermission[];
  navigation: ModuleNavigationItem[];
  defaultSettings: Record<string, unknown>;
  verticals: string[];
};

export type BusinessPreset = {
  key: string;
  displayName: string;
  description: string;
  moduleKeys: ModuleKey[];
  terminology: Record<string, string>;
};
