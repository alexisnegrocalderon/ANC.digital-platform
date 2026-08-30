import type { IRouter } from "express";

/**
 * Accepts either the root Express app or a sub-Router it's mounted on (see BASE_PATH in
 * server/index.ts). `IRouter` is the common get/post/use surface both implement — using the
 * `Express | Router` union directly confuses overload resolution on `.get`/`.post`.
 */
export type RouteTarget = IRouter;
