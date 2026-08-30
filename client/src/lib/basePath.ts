// Derived from Vite's `base` config (see vite.config.ts's VITE_BASE_PATH). "/" locally and on
// a standalone deploy -> "", or "/admin/" when proxied under ancdigital.cl/admin -> "/admin".
const raw = import.meta.env.BASE_URL || "/";
export const BASE_PATH = raw.endsWith("/") ? raw.slice(0, -1) : raw;
