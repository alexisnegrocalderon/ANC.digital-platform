"use client";

import { useRef } from "react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { cn } from "@/lib/cn";

export function AuroraBackground({
  className,
  parallax = true,
}: {
  className?: string;
  parallax?: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  useGsap(() => {
    if (!parallax || prefersReducedMotion() || !layerRef.current) return;

    const quick = {
      x: gsap.quickTo(layerRef.current, "x", { duration: 1.2, ease: "power3.out" }),
      y: gsap.quickTo(layerRef.current, "y", { duration: 1.2, ease: "power3.out" }),
    };

    function onPointerMove(event: PointerEvent) {
      const { innerWidth, innerHeight } = window;
      quick.x((event.clientX / innerWidth - 0.5) * 40);
      quick.y((event.clientY / innerHeight - 0.5) * 40);
    }

    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [parallax]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div ref={layerRef} className="aurora-bg absolute -inset-10" />
    </div>
  );
}
