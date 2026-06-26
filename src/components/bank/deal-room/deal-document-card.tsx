import { FileText, Download, Trash2, RefreshCw } from "lucide-react";
import type { DealRoomDocumentRow } from "@/lib/bank/deal-room-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export function DealDocumentCard({
  document,
  onDelete,
  onReplace,
}: {
  document: DealRoomDocumentRow;
  onDelete?: (id: string) => void;
  onReplace?: (id: string) => void;
}) {
  return (
    <article className="rounded-lg border border-border/70 bg-surface-2/20 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-1 text-muted-foreground">
          <FileText className="size-4" strokeWidth={1.5} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {document.documentTypeLabel}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-medium">{document.originalFileName}</div>
            </div>
            <StatusPill status={document.statusLabel} />
          </div>

          <dl className="mt-2 grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Uploaded by </span>
              {document.uploadedByName}
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Date </span>
              {formatActivityDateTime(document.createdAt)}
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Size </span>
              <span className="tabular font-mono">{document.fileSizeLabel}</span>
            </div>
            {document.visibility === "internal_only" && (
              <div className="text-amber-600 dark:text-amber-400">Internal only</div>
            )}
          </dl>

          {document.description && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{document.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {document.canDownload && (
              <a
                href={document.downloadUrl}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium hover:bg-surface-1"
              >
                <Download className="size-3" aria-hidden />
                Download
              </a>
            )}
            {document.canReplace && onReplace && (
              <button
                type="button"
                onClick={() => onReplace(document.id)}
                className="inline-flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium"
              >
                <RefreshCw className="size-3" aria-hidden />
                Replace
              </button>
            )}
            {document.canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(document.id)}
                className="inline-flex items-center gap-1.5 rounded border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive"
              >
                <Trash2 className="size-3" aria-hidden />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="rounded-md border border-border bg-surface-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {status}
    </span>
  );
}

export function DealDocumentGroupSection({
  title,
  documents,
  onDelete,
  onReplace,
}: {
  title: string;
  documents: DealRoomDocumentRow[];
  onDelete?: (id: string) => void;
  onReplace?: (id: string) => void;
}) {
  if (documents.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-3">
        {documents.map((doc) => (
          <DealDocumentCard
            key={doc.id}
            document={doc}
            onDelete={onDelete}
            onReplace={onReplace}
          />
        ))}
      </div>
    </div>
  );
}

export function DealDocumentChecklist({
  items,
  variant,
}: {
  items: import("@/lib/bank/deal-room-types").DealRoomDocumentRequestRow[];
  variant: "user" | "internal";
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-surface-2/10 p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Required document checklist
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 text-[13px]">
            <ChecklistIcon status={variant === "user" ? item.applicantStatus : item.status} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {variant === "user" ? item.applicantStatusLabel : item.statusLabel}
              </div>
              {item.requestNote && variant === "user" && (
                <p className="mt-1 text-[12px] text-muted-foreground">{item.requestNote}</p>
              )}
              {item.reviewNote && variant === "internal" && item.applicantStatus === "needs_attention" && (
                <p className="mt-1 text-[12px] text-destructive/90">{item.reviewNote}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChecklistIcon({
  status,
}: {
  status: string;
}) {
  const done = status === "approved" || status === "accepted";
  const warn = status === "rejected" || status === "needs_attention";
  const partial = status === "received" || status === "reviewed" || status === "uploaded";

  return (
    <span
      className={cn(
        "mt-0.5 grid size-4 shrink-0 place-items-center rounded border font-mono text-[10px]",
        done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
        warn && "border-destructive/40 bg-destructive/10 text-destructive",
        partial && !done && !warn && "border-gold/40 bg-gold/10 text-gold",
        !done && !warn && !partial && "border-border bg-surface-1 text-muted-foreground",
      )}
      aria-hidden
    >
      {done ? "✓" : warn ? "!" : partial ? "·" : ""}
    </span>
  );
}
