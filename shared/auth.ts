export const BUSINESS_ROLE_KEYS = ["owner", "admin", "manager", "staff", "viewer"] as const;
export type BusinessRole = (typeof BUSINESS_ROLE_KEYS)[number];

export const PLATFORM_ROLE_KEYS = ["user", "platform_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLE_KEYS)[number];

export const BUSINESS_ADMIN_ROLES: readonly BusinessRole[] = ["owner", "admin"];
export const BUSINESS_MANAGER_ROLES: readonly BusinessRole[] = ["owner", "admin", "manager"];
export const BUSINESS_WRITE_ROLES: readonly BusinessRole[] = ["owner", "admin", "manager", "staff"];

export type SessionUser = {
  id: number;
  authSubject: string;
  email: string | null;
  name: string | null;
  platformRole: PlatformRole;
};

export type ActiveMembership = {
  businessId: number;
  roleKey: BusinessRole;
};
