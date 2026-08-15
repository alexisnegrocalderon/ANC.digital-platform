import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: path.resolve(__dirname),
  test: {
    include: ["server/**/*.test.ts", "modules/**/*.test.ts", "shared/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    environment: "node",
  },
});
