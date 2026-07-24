import { FadeIn } from "@/components/ui/fade-in";
import { Check } from "lucide-react";
import { Card } from "@/components/page-shell";
import type { EntityOverviewItem, EntityProduct, EntityStatus } from "@/lib/governance/content";

function statusTone(status: EntityStatus): string {
  if (status === "Operational") return "text-[var(--success)]";
  return "text-muted-foreground";
}

function isMutedStatus(status: EntityStatus): boolean {
  return (
    status === "Planned" ||
    status === "In Development" ||
    status === "Release Candidate"
  );
}

function EntityCardHeader({ entity }: { entity: EntityOverviewItem }) {
  const Icon = entity.icon;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-gold">
          <Icon className="size-4" />
        </div>
        <div className="text-right">
          <span className="type-meta">
            {entity.code}
          </span>
          <div
            className={`mt-1 font-mono text-[9px] uppercase tracking-[0.18em] ${statusTone(entity.status)}`}
          >
            {entity.status}
          </div>
        </div>
      </div>

      <h3 className="mt-6 text-xl font-semibold tracking-tight">{entity.name}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{entity.description}</p>
    </>
  );
}

function EntityServicesList({ services }: { services: string[] }) {
  return (
    <div className="mt-6 border-t border-border/60 pt-5">
      <div className="type-meta">
        Services
      </div>
      <ul className="mt-3 space-y-2">
        {services.map((s) => (
          <li key={s} className="flex items-center gap-2 text-[13px] text-foreground/90">
            <Check className="size-3 shrink-0 text-gold" strokeWidth={2.5} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntityProductsSection({ products }: { products: EntityProduct[] }) {
  return (
    <>
      <div className="type-meta">
        Products
      </div>
      {products.map((product) => (
        <div
          key={product.name}
          className="mt-4 rounded-lg border border-gold/25 bg-gold/5 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-semibold tracking-tight">{product.name}</div>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
              Product
            </span>
          </div>
          <div className="mt-1 type-meta">
            {product.subtitle}
          </div>
          <p className="mt-2 text-[13px] font-medium tracking-tight text-foreground">
            {product.tagline}
          </p>
          <ul className="mt-3 space-y-1.5">
            {product.services.map((s) => (
              <li key={s} className="flex items-center gap-2 text-[12px] text-foreground/90">
                <Check className="size-3 shrink-0 text-gold" strokeWidth={2.5} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function EntityCard({
  entity,
  index,
}: {
  entity: EntityOverviewItem;
  index: number;
}) {
  const muted = isMutedStatus(entity.status);

  return (
    <FadeIn delay={0.05 + index * 0.08} className="h-full">
      <Card className={`flex h-full flex-col !p-7 ${muted ? "opacity-90" : ""}`}>
        <EntityCardHeader entity={entity} />
        <EntityServicesList services={entity.services} />
        {entity.products && entity.products.length > 0 && (
          <div className="mt-6 border-t border-border/60 pt-5">
            <EntityProductsSection products={entity.products} />
          </div>
        )}
      </Card>
    </FadeIn>
  );
}

/** Peer entity cards under Alta Group (Bank, Terminal). */
export function EntityOverview({ entities }: { entities: EntityOverviewItem[] }) {
  const cols =
    entities.length <= 1
      ? "grid-cols-1"
      : entities.length === 2
        ? "sm:grid-cols-2"
        : entities.length === 3
          ? "md:grid-cols-3"
          : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={`grid items-stretch gap-6 ${cols}`}>
      {entities.map((entity, i) => (
        <EntityCard key={entity.code} entity={entity} index={i} />
      ))}
    </div>
  );
}
