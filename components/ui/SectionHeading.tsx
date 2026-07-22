import { cn } from "@/lib/cn";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-4xl leading-[1.05] tracking-tight text-fg sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-xl text-base text-muted sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
