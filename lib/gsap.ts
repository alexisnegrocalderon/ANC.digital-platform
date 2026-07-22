"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, type DependencyList, type RefObject } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs a GSAP animation setup scoped to `scope`, cleaned up automatically on unmount/HMR. */
export function useGsap(
  callback: (context: gsap.Context) => void,
  deps: DependencyList,
  scope?: RefObject<Element | null>,
) {
  useLayoutEffect(() => {
    const ctx = gsap.context(callback, scope?.current ?? undefined);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export { gsap, ScrollTrigger };
