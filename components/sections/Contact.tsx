"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { useGsap, prefersReducedMotion, gsap } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";
import { AuroraBackground } from "@/components/ui/AuroraBackground";

export function Contact() {
  const scope = useRef<HTMLElement>(null);

  useGsap(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-contact-reveal]", {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: scope.current,
          start: "top 75%",
        },
      });
    },
    [],
    scope,
  );

  return (
    <section id="contacto" ref={scope} className="relative overflow-hidden py-28 sm:py-36">
      <AuroraBackground className="opacity-70" parallax={false} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-bg),transparent_15%,transparent_85%,var(--color-bg))]" />

      <Container className="relative">
        <div
          data-contact-reveal
          className="glass-strong mx-auto flex max-w-3xl flex-col items-center gap-8 rounded-[2.5rem] px-8 py-16 text-center sm:px-16"
        >
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
            Hablemos
          </span>
          <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl">
            ¿Listo para un sitio que la gente recuerde?
          </h2>
          <p className="max-w-md text-muted">
            Contame sobre tu marca y tu proyecto. Te respondo personalmente
            para ver cómo lo armamos juntos.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="mailto:hola@negrocalderon.com"
              className="group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--color-aurora-magenta),var(--color-aurora-violet))] px-6 py-3 text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-8px_rgba(255,61,154,0.5)] transition-shadow hover:shadow-[0_12px_32px_-6px_rgba(123,77,255,0.55)]"
            >
              Escribime un email
              <ArrowUpRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
            <a
              href="https://wa.me/56900000000"
              target="_blank"
              rel="noopener noreferrer"
              className="glass group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-fg transition-colors hover:bg-[rgba(255,255,255,0.75)]"
            >
              WhatsApp
              <ArrowUpRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
