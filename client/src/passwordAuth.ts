async function readJson(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data.error === "string" ? data.error : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  const response = await fetch("/api/auth/password/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await readJson(response);
}

export async function setupAdminAccount(input: {
  secret: string;
  email: string;
  password: string;
  name: string;
}): Promise<void> {
  const response = await fetch("/api/auth/password/setup", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  await readJson(response);
}
