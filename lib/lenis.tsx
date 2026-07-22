"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect } from "react";
import { gsap, ScrollTrigger, prefersReducedMotion } from "@/lib/gsap";

function LenisGsapSync() {
  const lenis = useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    if (!lenis) return;

    function update(time: number) {
      lenis?.raf(time * 1000);
    }

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(update);
  }, [lenis]);

  return null;
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = prefersReducedMotion();

  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        lerp: reduced ? 1 : 0.1,
        duration: reduced ? 0 : 1.1,
        syncTouch: false,
        anchors: true,
      }}
    >
      <LenisGsapSync />
      {children}
    </ReactLenis>
  );
}
