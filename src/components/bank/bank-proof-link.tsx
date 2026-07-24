import { formatActivityDateTime } from "@/lib/format-datetime";
import { getProofFileUrl, hasStoredProof } from "@/lib/storage/proof-upload.constants";

export function BankProofStatus({
  proofImageUrl,
  proofFileName,
  proofUploadedAt,
  hasProof,
  transactionId,
  variant = "internal",
}: {
  proofImageUrl: string | null;
  proofFileName?: string | null;
  proofUploadedAt?: string | null;
  hasProof?: boolean;
  transactionId?: string;
  variant?: "internal" | "user";
}) {
  const url = getProofFileUrl(proofImageUrl, transactionId ? { transactionId } : undefined);
  const uploaded = hasProof === true || Boolean(url) || hasStoredProof(proofImageUrl);

  if (!uploaded) {
    return <span className="text-[12px] text-muted-foreground">No proof attached</span>;
  }

  return (
    <div className="space-y-1">
      <span className="text-[12px] text-[var(--success)]">Proof uploaded</span>
      {variant === "internal" && proofFileName ? (
        <p className="font-mono text-[10px] text-muted-foreground">{proofFileName}</p>
      ) : null}
      {variant === "internal" && proofUploadedAt ? (
        <p className="text-[10px] text-muted-foreground">
          {formatActivityDateTime(proofUploadedAt)}
        </p>
      ) : null}
      {url ? (
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className="inline-block rounded border border-gold/30 bg-gold/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
        >
          View proof
        </button>
      ) : null}
    </div>
  );
}

export function BankProofIndicator({ hasProof }: { hasProof: boolean }) {
  if (!hasProof) return null;
  return (
    <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
      · Proof
    </span>
  );
}
