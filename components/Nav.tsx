"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { href: "#servicios", label: "Servicios" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#proceso", label: "Proceso" },
  { href: "#precios", label: "Precios" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="glass flex w-full max-w-6xl items-center justify-between rounded-full px-5 py-3">
        <a
          href="#top"
          className="font-display text-lg tracking-tight text-fg"
        >
          Negro Calderón
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button href="#contacto" className="!px-5 !py-2 text-xs">
            Hablemos
          </Button>
        </div>

        <button
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center text-fg md:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div
        className={cn(
          "glass-nav absolute inset-x-4 top-[calc(100%+0.5rem)] flex flex-col gap-1 rounded-3xl p-4 transition-all duration-300 md:hidden",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className="rounded-xl px-3 py-2.5 text-sm text-fg/90 hover:bg-[rgba(14,14,16,0.06)]"
          >
            {link.label}
          </a>
        ))}
        <a
          href="#contacto"
          onClick={() => setOpen(false)}
          className="mt-1 rounded-xl bg-[linear-gradient(135deg,var(--color-aurora-magenta),var(--color-aurora-violet))] px-3 py-2.5 text-center text-sm font-medium text-accent-foreground"
        >
          Hablemos
        </a>
      </div>
    </header>
  );
}
