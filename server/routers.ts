import { MODULE_MANIFESTS, BUSINESS_PRESETS } from "../modules/core/registry";
import { publicProcedure, router } from "./trpc";

export const appRouter = router({
  system: router({
    health: publicProcedure.query(({ ctx }) => ({
      ok: true,
      service: "anc-platform",
      database: ctx.database,
      timestamp: new Date().toISOString(),
    })),
  }),
  modules: router({
    list: publicProcedure.query(() =>
      Object.values(MODULE_MANIFESTS).map(({ key, version, displayName, description, dependencies, verticals }) => ({
        key,
        version,
        displayName,
        description,
        dependencies,
        verticals,
      })),
    ),
    get: publicProcedure.input((value: unknown) => {
      if (typeof value !== "object" || value === null || !("key" in value)) {
        throw new Error("Module key is required");
      }
      const key = (value as { key: unknown }).key;
      if (typeof key !== "string" || !(key in MODULE_MANIFESTS)) {
        throw new Error("Unknown module key");
      }
      return { key: key as keyof typeof MODULE_MANIFESTS };
    }).query(({ input }) => MODULE_MANIFESTS[input.key]),
  }),
  presets: router({
    list: publicProcedure.query(() => BUSINESS_PRESETS),
  }),
});

export type AppRouter = typeof appRouter;
