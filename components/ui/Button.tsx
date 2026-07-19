import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

// Motion components must be created once at module scope, not per-render.
const MotionLink = motion.create(Link);

type ButtonProps = {
  href: string;
  variant?: "solid" | "ghost";
  className?: string;
  children: React.ReactNode;
  external?: boolean;
};

const TAP_PROPS = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export function Button({
  href,
  variant = "solid",
  className,
  children,
  external,
}: ButtonProps) {
  const classes = cn(
    "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-tight transition-shadow duration-300",
    variant === "solid" &&
      "bg-[linear-gradient(135deg,var(--color-aurora-magenta),var(--color-aurora-violet))] text-accent-foreground shadow-[0_8px_24px_-8px_rgba(255,61,154,0.5)] hover:shadow-[0_12px_32px_-6px_rgba(123,77,255,0.55)]",
    variant === "ghost" && "glass text-fg hover:bg-[rgba(255,255,255,0.7)]",
    className,
  );

  if (external) {
    return (
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
        {...TAP_PROPS}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <MotionLink href={href} className={classes} {...TAP_PROPS}>
      {children}
    </MotionLink>
  );
}
