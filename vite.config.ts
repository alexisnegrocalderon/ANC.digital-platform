import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Matches server/index.ts's BASE_PATH: unset in local dev / a standalone deploy (served at
// "/"), set to e.g. "/admin/" only for the deploy proxied under another domain's path.
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
