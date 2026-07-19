import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonProps = {
  href: string;
  variant?: "solid" | "ghost";
  className?: string;
  children: React.ReactNode;
  external?: boolean;
};

export function Button({
  href,
  variant = "solid",
  className,
  children,
  external,
}: ButtonProps) {
  const classes = cn(
    "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-tight transition-all duration-300",
    variant === "solid" &&
      "bg-accent text-accent-foreground hover:shadow-[0_0_0_1px_var(--color-accent),0_0_32px_-4px_var(--color-accent)]",
    variant === "ghost" &&
      "glass text-fg hover:bg-[rgba(245,244,240,0.12)]",
    className,
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
