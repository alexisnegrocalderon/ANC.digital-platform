"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { useGsap, prefersReducedMotion, gsap } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";

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
    <section id="contacto" ref={scope} className="relative py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,_rgba(215,255,61,0.14),_transparent_70%)] blur-3xl" />
      </div>

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
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-shadow hover:shadow-[0_0_32px_-4px_var(--color-accent)]"
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
              className="group inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-fg transition-colors hover:bg-[rgba(245,244,240,0.08)]"
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
