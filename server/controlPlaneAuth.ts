import { jwtVerify, importSPKI, type JWTPayload } from "jose";
import type { Request } from "express";

export const CONTROL_PLANE_SCOPES = [
  "platform.business.read",
  "platform.business.write",
  "platform.modules.read",
  "platform.modules.write",
  "platform.health.read",
  "platform.webhooks.manage",
] as const;

export type ControlPlaneScope = (typeof CONTROL_PLANE_SCOPES)[number];

export type ControlPlaneClaims = JWTPayload & {
  iss: string;
  aud: string | string[];
  scope?: string[] | string;
  environment?: string;
  client_id?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for control-plane authentication.`);
  return value;
}

async function verificationKey() {
  return importSPKI(requiredEnv("CONTROL_PLANE_PUBLIC_KEY"), "EdDSA");
}

function scopesFromClaims(claims: ControlPlaneClaims): string[] {
  if (Array.isArray(claims.scope)) return claims.scope;
  if (typeof claims.scope === "string") return claims.scope.split(" ").filter(Boolean);
  return [];
}

export async function verifyControlPlaneRequest(request: Request): Promise<ControlPlaneClaims> {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new ControlPlaneAuthError(401, "INVALID_TOKEN", "Bearer token is required.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new ControlPlaneAuthError(401, "INVALID_TOKEN", "Bearer token is empty.");

  try {
    const expectedIssuer = requiredEnv("CONTROL_PLANE_ISSUER");
    const expectedAudience = requiredEnv("CONTROL_PLANE_AUDIENCE");
    const { payload } = await jwtVerify(token, await verificationKey(), {
      algorithms: ["EdDSA"],
      issuer: expectedIssuer,
      audience: expectedAudience,
      clockTolerance: "30s",
    });

    const claims = payload as ControlPlaneClaims;
    if (!claims.jti || !claims.sub || !claims.exp || !claims.iat) {
      throw new ControlPlaneAuthError(401, "INVALID_TOKEN", "Token is missing required claims.");
    }

    const expectedEnvironment = process.env.CONTROL_PLANE_ENVIRONMENT?.trim();
    if (expectedEnvironment && claims.environment !== expectedEnvironment) {
      throw new ControlPlaneAuthError(403, "INVALID_ENVIRONMENT", "Token environment is not allowed.");
    }

    return claims;
  } catch (error) {
    if (error instanceof ControlPlaneAuthError) throw error;
    throw new ControlPlaneAuthError(401, "INVALID_TOKEN", "Token signature or claims are invalid.");
  }
}

export function requireControlPlaneScope(claims: ControlPlaneClaims, scope: ControlPlaneScope) {
  if (!scopesFromClaims(claims).includes(scope)) {
    throw new ControlPlaneAuthError(403, "INSUFFICIENT_SCOPE", `Scope ${scope} is required.`);
  }
}

export function controlPlaneClientId(claims: ControlPlaneClaims) {
  const value = claims.client_id ?? claims.sub;
  if (!value) throw new ControlPlaneAuthError(401, "INVALID_TOKEN", "Token client identity is missing.");
  return value;
}

export function requestId(request: Request) {
  return request.header("x-anc-request-id")?.trim() || crypto.randomUUID();
}

export class ControlPlaneAuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ControlPlaneAuthError";
  }
}
