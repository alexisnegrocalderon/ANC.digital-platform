"use client";

import { useRef } from "react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const STEPS = [
  {
    number: "01",
    title: "Descubrimiento",
    description:
      "Entendemos tu marca, tu audiencia y qué necesitás lograr con el sitio antes de tocar una sola línea de diseño.",
  },
  {
    number: "02",
    title: "Diseño",
    description:
      "Prototipo visual con la dirección de arte, UX y motion definidos — vos apruebas antes de que se programe nada.",
  },
  {
    number: "03",
    title: "Desarrollo",
    description:
      "Construimos el sitio real: rápido, responsive y con las animaciones ya integradas de punta a punta.",
  },
  {
    number: "04",
    title: "Lanzamiento",
    description:
      "Publicamos, conectamos tu dominio y te dejamos el sitio listo para recibir clientes.",
  },
];

export function Process() {
  const scope = useRef<HTMLElement>(null);

  useGsap(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-step]", {
        opacity: 0,
        x: -32,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: scope.current,
          start: "top 70%",
        },
      });

      gsap.from("[data-step-line]", {
        scaleY: 0,
        transformOrigin: "top",
        duration: 1.2,
        ease: "power2.inOut",
        scrollTrigger: {
          trigger: scope.current,
          start: "top 60%",
          end: "bottom 80%",
          scrub: 0.5,
        },
      });
    },
    [],
    scope,
  );

  return (
    <section id="proceso" ref={scope} className="py-28 sm:py-36">
      <Container>
        <SectionHeading
          eyebrow="Proceso"
          title="Cómo trabajamos, sin sorpresas"
          description="Cuatro pasos claros para pasar de la idea a un sitio en producción."
        />

        <div className="relative mt-16 flex flex-col gap-12 sm:pl-4">
          <span
            data-step-line
            className="absolute top-2 bottom-2 left-4 hidden w-px bg-border sm:block"
          />

          {STEPS.map((step) => (
            <div key={step.number} data-step className="relative flex gap-6 sm:pl-10">
              <span className="font-display absolute -left-1 top-0 hidden text-sm text-accent sm:block">
                {step.number}
              </span>
              <div className="flex flex-col gap-2 sm:hidden">
                <span className="font-mono text-xs text-accent">{step.number}</span>
              </div>
              <div>
                <h3 className="font-display text-2xl text-fg">{step.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
