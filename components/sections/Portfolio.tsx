"use client";

import { useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const PROJECTS = [
  {
    tag: "Landing de producto",
    title: "Sitio con identidad propia",
    description:
      "Storytelling de scroll, motion a medida y una estética que no se confunde con ninguna plantilla.",
    gradient: "from-[#2F6FFF]/25 via-[#00D4E0]/15 to-transparent",
  },
  {
    tag: "Plataforma / SaaS",
    title: "UX pensada para convertir",
    description:
      "Interfaces limpias, flujos claros y un producto que se siente tan bien como se ve.",
    gradient: "from-[#FF3D9A]/25 via-[#7B4DFF]/15 to-transparent",
  },
  {
    tag: "E-commerce",
    title: "Experiencia de compra fluida",
    description:
      "Checkout simple, performance cuidado y animaciones que acompañan sin estorbar.",
    gradient: "from-[#00D4E0]/20 via-[#7B4DFF]/12 to-transparent",
  },
];

export function Portfolio() {
  const scope = useRef<HTMLElement>(null);

  useGsap(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-portfolio-card]", {
        opacity: 0,
        y: 48,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: scope.current,
          start: "top 70%",
        },
      });
    },
    [],
    scope,
  );

  return (
    <section id="portfolio" ref={scope} className="py-28 sm:py-36">
      <Container>
        <SectionHeading
          eyebrow="Portfolio"
          title="Cada proyecto, un caso aparte"
          description="Así se ve un sitio pensado desde cero para una marca — no un molde reciclado. Este espacio está listo para tus próximos casos."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {PROJECTS.map((project) => (
            <a
              key={project.title}
              href="#contacto"
              data-portfolio-card
              className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl border border-border p-8 shadow-[0_4px_24px_-8px_rgba(14,14,16,0.08)] transition-shadow duration-300 hover:shadow-[0_20px_48px_-12px_rgba(123,77,255,0.3)]"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${project.gradient} bg-bg-elevated`}
              />
              <div className="glass absolute inset-0 translate-y-full rounded-3xl p-8 transition-transform duration-500 ease-out group-hover:translate-y-0" />

              <div className="relative z-10">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
                  {project.tag}
                </span>
                <h3 className="font-display mt-4 flex items-center gap-2 text-2xl text-fg">
                  {project.title}
                  <ArrowUpRight
                    className="opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    size={20}
                  />
                </h3>
                <p className="mt-3 max-w-xs text-sm text-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {project.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
