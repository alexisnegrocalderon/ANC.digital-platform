import { BASE_PATH } from "./lib/basePath";

export function startLogin() {
  const origin = window.location.origin;
  window.location.assign(`${BASE_PATH}/api/auth/login?origin=${encodeURIComponent(origin)}`);
}
