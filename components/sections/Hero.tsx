"use client";

import { useRef } from "react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

const LINE_1 = "No hacemos sitios web.";
const LINE_2 = "Hacemos primeras impresiones.";

export function Hero() {
  const scope = useRef<HTMLElement>(null);
  const blobARef = useRef<HTMLDivElement>(null);
  const blobBRef = useRef<HTMLDivElement>(null);

  useGsap(
    () => {
      const reduced = prefersReducedMotion();

      const tl = gsap.timeline({
        defaults: { ease: "power4.out" },
      });

      tl.from("[data-hero-eyebrow]", {
        opacity: 0,
        y: 12,
        duration: reduced ? 0.01 : 0.6,
      })
        .from(
          "[data-hero-line]",
          {
            yPercent: 120,
            opacity: 0,
            duration: reduced ? 0.01 : 0.9,
            stagger: 0.12,
          },
          "-=0.3",
        )
        .from(
          "[data-hero-sub]",
          { opacity: 0, y: 16, duration: reduced ? 0.01 : 0.7 },
          "-=0.5",
        )
        .from(
          "[data-hero-cta]",
          { opacity: 0, y: 16, duration: reduced ? 0.01 : 0.7 },
          "-=0.5",
        )
        .from(
          "[data-hero-scroll]",
          { opacity: 0, duration: reduced ? 0.01 : 0.6 },
          "-=0.4",
        );

      if (reduced) return;

      const quickA = {
        x: gsap.quickTo(blobARef.current, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(blobARef.current, "y", { duration: 0.8, ease: "power3.out" }),
      };
      const quickB = {
        x: gsap.quickTo(blobBRef.current, "x", { duration: 1.1, ease: "power3.out" }),
        y: gsap.quickTo(blobBRef.current, "y", { duration: 1.1, ease: "power3.out" }),
      };

      function onPointerMove(event: PointerEvent) {
        const { innerWidth, innerHeight } = window;
        const relX = event.clientX / innerWidth - 0.5;
        const relY = event.clientY / innerHeight - 0.5;
        quickA.x(relX * 60);
        quickA.y(relY * 60);
        quickB.x(relX * -40);
        quickB.y(relY * -40);
      }

      window.addEventListener("pointermove", onPointerMove);
      return () => window.removeEventListener("pointermove", onPointerMove);
    },
    [],
    scope,
  );

  return (
    <section
      id="top"
      ref={scope}
      className="relative flex min-h-svh items-center overflow-hidden pt-28 pb-20"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          ref={blobARef}
          className="absolute left-1/4 top-1/3 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,_rgba(245,244,240,0.14),_transparent_70%)] blur-3xl"
        />
        <div
          ref={blobBRef}
          className="absolute right-1/4 bottom-1/4 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(215,255,61,0.12),_transparent_70%)] blur-3xl"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,var(--color-bg)_92%)]" />
      </div>

      <Container className="relative">
        <span
          data-hero-eyebrow
          className="glass mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-muted"
        >
          Diseño · UX/UI · Motion
        </span>

        <h1 className="font-display max-w-4xl text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.98] tracking-tight text-fg">
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              {LINE_1}
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line className="block text-muted">
              {LINE_2}
            </span>
          </span>
        </h1>

        <p
          data-hero-sub
          className="mt-8 max-w-lg text-lg text-muted sm:text-xl"
        >
          Diseño, UX/UI y motion a medida para marcas que quieren destacar —
          no otra plantilla genérica armada con IA.
        </p>

        <div data-hero-cta className="mt-10 flex flex-wrap items-center gap-4">
          <Button href="#contacto">Empezar mi proyecto</Button>
          <Button href="#portfolio" variant="ghost">
            Ver portfolio
          </Button>
        </div>
      </Container>

      <div
        data-hero-scroll
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted sm:flex"
      >
        <span>Scroll</span>
        <span className="h-10 w-px animate-pulse bg-[linear-gradient(to_bottom,var(--color-muted),transparent)]" />
      </div>
    </section>
  );
}
