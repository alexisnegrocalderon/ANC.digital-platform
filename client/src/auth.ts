export function startLogin() {
  const origin = window.location.origin;
  window.location.assign(`/api/auth/login?origin=${encodeURIComponent(origin)}`);
}
