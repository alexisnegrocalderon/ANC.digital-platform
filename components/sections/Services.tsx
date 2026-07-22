"use client";

import { useRef } from "react";
import { Sparkles, LayoutTemplate, Bot, Wand2 } from "lucide-react";
import { gsap, useGsap, prefersReducedMotion } from "@/lib/gsap";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

const SERVICES = [
  {
    icon: LayoutTemplate,
    title: "Diseño web a medida",
    description:
      "Landings y sitios pensados desde cero para tu marca, sin templates ni bloques genéricos.",
  },
  {
    icon: Sparkles,
    title: "UX/UI",
    description:
      "Interfaces claras y cuidadas que guían al usuario y convierten visitas en clientes.",
  },
  {
    icon: Bot,
    title: "IA & automatización",
    description:
      "Flujos y asistentes con IA que ahorran tiempo y hacen crecer tu negocio en piloto automático.",
  },
  {
    icon: Wand2,
    title: "Motion",
    description:
      "Animaciones y transiciones con GSAP que le dan a tu sitio ese factor WOW que se recuerda.",
  },
];

export function Services() {
  const scope = useRef<HTMLElement>(null);

  useGsap(
    () => {
      if (prefersReducedMotion()) return;

      gsap.from("[data-service-card]", {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.12,
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
    <section id="servicios" ref={scope} className="py-28 sm:py-36">
      <Container>
        <SectionHeading
          eyebrow="Servicios"
          title="Todo lo que necesitás para destacar online"
          description="De la idea al sitio en producción, con diseño, contenido y automatización pensados para vender."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {SERVICES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              data-service-card
              className="rounded-2xl border border-border bg-bg-elevated p-8 shadow-[0_4px_24px_-8px_rgba(14,14,16,0.08)] transition-[border-color,box-shadow] duration-300 hover:border-[rgba(255,61,154,0.35)] hover:shadow-[0_16px_40px_-12px_rgba(123,77,255,0.25)]"
            >
              <Icon className="text-accent" size={28} strokeWidth={1.5} />
              <h3 className="font-display mt-6 text-xl text-fg">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
