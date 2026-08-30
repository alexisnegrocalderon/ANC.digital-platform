// Import the pre-bundled server (built by `npm run build`'s esbuild step) rather than the raw
// TypeScript source tree. `server/index.ts` transitively pulls in files spread across
// `server/`, `modules/`, `drizzle/`, and `shared/`; Vercel's Node file tracer failed to include
// all of them when this re-exported the TS source directly, crashing with
// ERR_MODULE_NOT_FOUND at runtime. The esbuild bundle is a single self-contained file, so only
// this one path needs to be traced/included.
export { default } from "../server-dist/index.js";
