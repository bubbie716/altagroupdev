import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(type.eyebrow, className)}>{children}</p>;
}

export function DisplayTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn(type.display, className)}>{children}</h1>;
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn(type.sectionTitle, className)}>{children}</h2>;
}

export function MetaLabel({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return <span className={cn(accent ? type.metaAccent : type.meta, className)}>{children}</span>;
}

export function FinanceValue({
  children,
  size = "lg",
  className,
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? type.financeSm
      : size === "md"
        ? type.financeMd
        : size === "xl"
          ? type.financeXl
          : size === "hero"
            ? type.financeHero
            : type.financeLg;
  return <span className={cn(sizeClass, className)}>{children}</span>;
}
