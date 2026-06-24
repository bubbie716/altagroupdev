import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Card } from "@/components/page-shell";
import type { EntityOverviewItem, EntityProduct, EntityStatus } from "@/lib/governance/content";

function statusTone(status: EntityStatus): string {
  if (status === "Operational" || status === "Exchange Product") return "text-[var(--success)]";
  return "text-muted-foreground";
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
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
              Exchange product
            </span>
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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

function SideEntityCard({
  entity,
  index,
  className,
  stretch = false,
}: {
  entity: EntityOverviewItem;
  index: number;
  className?: string;
  stretch?: boolean;
}) {
  const muted = entity.status === "Planned" || entity.status === "In Development";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.08 }}
      className={`${stretch ? "h-full" : ""} ${className ?? ""}`}
    >
      <Card
        className={`flex flex-col !p-7 ${muted ? "opacity-90" : ""} ${stretch ? "h-full" : ""}`}
      >
        <EntityCardHeader entity={entity} />
        <EntityServicesList services={entity.services} />
      </Card>
    </motion.div>
  );
}

function ExchangeFullCard({ entity, index }: { entity: EntityOverviewItem; index: number }) {
  const muted = entity.status === "Planned" || entity.status === "In Development";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.08 }}
      className="lg:hidden"
    >
      <Card className={`flex flex-col !p-7 ${muted ? "opacity-90" : ""}`}>
        <EntityCardHeader entity={entity} />
        <EntityServicesList services={entity.services} />
        {entity.products && entity.products.length > 0 && (
          <div className="mt-6 border-t border-border/60 pt-5">
            <EntityProductsSection products={entity.products} />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function ExchangeTopCard({ entity, index }: { entity: EntityOverviewItem; index: number }) {
  const muted = entity.status === "Planned" || entity.status === "In Development";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.08 }}
      className="hidden h-full lg:col-start-2 lg:row-start-1 lg:block"
    >
      <Card
        className={`flex h-full flex-col !p-7 !pb-7 ${muted ? "opacity-90" : ""} !rounded-b-none !border-b-0`}
      >
        <EntityCardHeader entity={entity} />
        <EntityServicesList services={entity.services} />
      </Card>
    </motion.div>
  );
}

function ExchangeProductsCard({
  entity,
  index,
}: {
  entity: EntityOverviewItem;
  index: number;
}) {
  if (!entity.products || entity.products.length === 0) return null;

  const muted = entity.status === "Planned" || entity.status === "In Development";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08 }}
      className="hidden lg:col-start-2 lg:row-start-2 lg:block"
    >
      <Card
        className={`flex flex-col !p-7 !pt-5 ${muted ? "opacity-90" : ""} -mt-px !rounded-t-none border-t border-border/60`}
      >
        <EntityProductsSection products={entity.products} />
      </Card>
    </motion.div>
  );
}

export function EntityOverview({ entities }: { entities: EntityOverviewItem[] }) {
  const bank = entities.find((e) => e.code === "ALT-BNK");
  const exchange = entities.find((e) => e.code === "ALT-EXC");
  const ncc = entities.find((e) => e.code === "NCC");

  if (!bank || !exchange || !ncc) {
    return (
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {entities.map((entity, i) => (
          <SideEntityCard key={entity.code} entity={entity} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-3 lg:grid-rows-[auto_auto] lg:gap-y-0">
      <SideEntityCard
        entity={bank}
        index={0}
        stretch
        className="lg:col-start-1 lg:row-start-1"
      />
      <ExchangeFullCard entity={exchange} index={1} />
      <ExchangeTopCard entity={exchange} index={1} />
      <ExchangeProductsCard entity={exchange} index={1} />
      <SideEntityCard
        entity={ncc}
        index={2}
        stretch
        className="lg:col-start-3 lg:row-start-1"
      />
    </div>
  );
}
