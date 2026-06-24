import { formatActivityDateTime } from "@/lib/format-datetime";
import { getProofFileUrl } from "@/lib/storage/proof-upload.constants";

export function BankProofStatus({
  proofImageUrl,
  proofFileName,
  proofUploadedAt,
  hasProof,
  variant = "internal",
}: {
  proofImageUrl: string | null;
  proofFileName?: string | null;
  proofUploadedAt?: string | null;
  hasProof?: boolean;
  variant?: "internal" | "user";
}) {
  const url = getProofFileUrl(proofImageUrl);
  const uploaded = hasProof ?? Boolean(url);

  if (!uploaded || !url) {
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
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        View proof
      </a>
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
