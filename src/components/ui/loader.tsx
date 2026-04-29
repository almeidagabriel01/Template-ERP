"use client";

import { cn } from "@/lib/utils";

/**
 * <Loader /> — single loading primitive. Use instead of Loader2 + animate-spin everywhere.
 *
 * PROHIBITED:
 * - Loader inside a virtualised list cell (use skeleton on the parent)
 * - Loader inside map() with >20 items (use 1 Loader contained on the parent)
 * - Loader in a button without using <Button loading> (don't duplicate the pattern)
 */

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  variant?: "inline" | "button" | "page" | "contained";
  className?: string;
  label?: string;
}

const sizeClass: Record<NonNullable<LoaderProps["size"]>, string> = {
  sm: "h-3 w-3",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

export function Loader({
  size = "md",
  variant = "inline",
  className,
  label = "Carregando",
}: LoaderProps) {
  const ring = (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-flex shrink-0", sizeClass[size], className)}
    >
      <span
        className="absolute inset-0 rounded-full animate-spin"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--primary) 270deg, var(--primary) 360deg)",
        }}
      />
      <span className="absolute inset-[2px] rounded-full bg-background" />
    </span>
  );

  if (variant === "contained") {
    return (
      <div className="flex items-center justify-center min-h-[200px] w-full">
        <Loader size="md" label={label} />
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="bg-card border border-border/50 shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <Loader size="lg" label={label} className="relative z-10" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
      </div>
    );
  }

  return ring;
}
