import { cn } from "@/lib/utils";

/** Institutional typography tokens — see styles.css @layer components. */
export const type = {
  eyebrow: "type-eyebrow",
  display: "type-display",
  displayGovernance: "type-display-governance",
  sectionTitle: "type-section-title",
  meta: "type-meta",
  metaAccent: "type-meta-accent",
  metaSm: "type-meta-sm",
  body: "type-body",
  bodySm: "type-body-sm",
  nav: "type-nav",
  subnav: "type-subnav",
  subnavMono: "type-subnav-mono",
  uiLabel: "type-ui-label",
  finance: "type-finance",
  financeSm: "type-finance-sm",
  financeMd: "type-finance-md",
  financeLg: "type-finance-lg",
  financeXl: "type-finance-xl",
  financeHero: "type-finance-hero",
} as const;

/** Form field labels (Bank, Exchange, Internal). */
export const formFieldLabelClass = type.uiLabel;

export function financeValue(className?: string) {
  return cn(type.finance, className);
}

export function metaLabel(className?: string) {
  return cn(type.meta, className);
}
