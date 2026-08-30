import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { BASE_PATH } from "./lib/basePath";

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined";
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function registerPasskey(): Promise<void> {
  const optionsResponse = await fetch(`${BASE_PATH}/api/webauthn/register/options`, {
    method: "POST",
    credentials: "include",
  });
  const options = await readJson(optionsResponse);

  const attestation = await startRegistration({ optionsJSON: options });

  const verifyResponse = await fetch(`${BASE_PATH}/api/webauthn/register/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(attestation),
  });
  await readJson(verifyResponse);
}

export async function loginWithPasskey(): Promise<void> {
  const optionsResponse = await fetch(`${BASE_PATH}/api/webauthn/login/options`, {
    method: "POST",
    credentials: "include",
  });
  const options = await readJson(optionsResponse);

  const assertion = await startAuthentication({ optionsJSON: options });

  const verifyResponse = await fetch(`${BASE_PATH}/api/webauthn/login/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(assertion),
  });
  await readJson(verifyResponse);
}
