"use client";

import { useRef } from "react";
import { Check } from "lucide-react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { cn } from "@/lib/cn";

const PLANS = [
  {
    name: "Landing WOW",
    tagline: "Una página, todo el impacto.",
    features: [
      "Diseño 100% a medida",
      "Copy y estructura optimizados",
      "Animaciones con GSAP",
      "Responsive + SEO básico",
    ],
    featured: false,
  },
  {
    name: "Sitio Completo",
    tagline: "Tu marca, con todas las de la ley.",
    features: [
      "Todo lo de Landing WOW",
      "Múltiples secciones/páginas",
      "Integraciones (formularios, CRM, IA)",
      "Soporte post-lanzamiento",
    ],
    featured: true,
  },
  {
    name: "A Medida",
    tagline: "Proyectos grandes, sin límites.",
    features: [
      "E-commerce y plataformas",
      "Automatización con IA",
      "Arquitectura definida a tu medida",
      "Acompañamiento continuo",
    ],
    featured: false,
  },
];

export function Pricing() {
  const scope = useRef<HTMLElement>(null);

  useGsap(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-plan-card]", {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.12,
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
    <section id="precios" ref={scope} className="relative overflow-hidden py-28 sm:py-36">
      <AuroraBackground className="opacity-60" parallax={false} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-bg),transparent_15%,transparent_85%,var(--color-bg))]" />

      <Container className="relative">
        <SectionHeading
          eyebrow="Planes"
          title="Un plan para cada etapa de tu negocio"
          description="Precios a medida según el alcance — cada proyecto se cotiza según lo que tu marca realmente necesita."
          align="center"
          className="mx-auto"
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              data-plan-card
              className={cn(
                "flex flex-col rounded-3xl border p-8",
                plan.featured
                  ? "glass-strong border-transparent lg:-translate-y-4"
                  : "border-border bg-bg-elevated",
              )}
            >
              {plan.featured && (
                <span className="mb-4 w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  Recomendado
                </span>
              )}
              <h3 className="font-display text-2xl text-fg">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted">{plan.tagline}</p>

              <ul className="mt-8 flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-fg/90">
                    <Check size={16} className="mt-0.5 shrink-0 text-accent" />
                    {feature}
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-sm text-muted">Precio a cotizar según alcance</p>

              <Button
                href="#contacto"
                variant={plan.featured ? "solid" : "ghost"}
                className="mt-6 justify-center"
              >
                Cotizar
              </Button>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
