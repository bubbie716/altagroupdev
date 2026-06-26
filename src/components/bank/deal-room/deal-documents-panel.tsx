import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  DealDocumentChecklist,
  DealDocumentGroupSection,
} from "@/components/bank/deal-room/deal-document-card";
import {
  deleteDealRoomDocumentRecord,
  requestDealRoomDocumentRecord,
  reviewDealRoomDocumentRequestRecord,
} from "@/lib/bank/deal-room.functions";
import {
  DEAL_ROOM_DOCUMENT_TYPE_LABELS,
  type DealRoomDocumentsContext,
  type DealRoomDocumentTypeCode,
} from "@/lib/bank/deal-room-types";
import {
  ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES,
  MAX_DEAL_ROOM_DOCUMENT_BYTES,
} from "@/lib/storage/deal-room-document.constants";

const UPLOAD_ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx";

const UPLOAD_TYPE_OPTIONS: { value: DealRoomDocumentTypeCode; label: string }[] = [
  { value: "identification", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.identification },
  { value: "income_verification", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.income_verification },
  { value: "bank_statement", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.bank_statement },
  { value: "tax_document", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.tax_document },
  { value: "business_financials", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.business_financials },
  { value: "collateral", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.collateral },
  { value: "supporting_document", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.supporting_document },
  { value: "signed_contract", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.signed_contract },
  { value: "other", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.other },
];

const INTERNAL_TYPE_OPTIONS: { value: DealRoomDocumentTypeCode; label: string }[] = [
  { value: "contract_draft", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.contract_draft },
  { value: "internal_memo", label: DEAL_ROOM_DOCUMENT_TYPE_LABELS.internal_memo },
  ...UPLOAD_TYPE_OPTIONS,
];

const REQUEST_TYPE_OPTIONS: { value: DealRoomDocumentTypeCode; label: string }[] = [
  { value: "identification", label: "Government ID" },
  { value: "business_financials", label: "Business Financial Statements" },
  { value: "collateral", label: "Collateral Photos / Docs" },
  { value: "tax_document", label: "Tax Returns" },
  { value: "bank_statement", label: "Bank Statements" },
  { value: "income_verification", label: "Proof of Income" },
  { value: "supporting_document", label: "Additional Supporting Documents" },
];

export function DealDocumentsPanel({
  dealRoomId,
  documents,
  variant,
  roomClosed = false,
}: {
  dealRoomId: string;
  documents: DealRoomDocumentsContext;
  variant: "user" | "internal";
  roomClosed?: boolean;
}) {
  const router = useRouter();
  const deleteDoc = useServerFn(deleteDealRoomDocumentRecord);
  const requestDoc = useServerFn(requestDealRoomDocumentRecord);
  const reviewRequest = useServerFn(reviewDealRoomDocumentRequestRecord);

  const fileRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [documentType, setDocumentType] = useState<DealRoomDocumentTypeCode>("supporting_document");
  const [visibility, setVisibility] = useState<"shared" | "internal_only">("shared");
  const [description, setDescription] = useState("");
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<DealRoomDocumentTypeCode>("identification");

  const canUpload = variant === "internal" ? documents.canUploadInternal || documents.canUploadShared : documents.canUploadShared;
  const typeOptions = variant === "internal" ? INTERNAL_TYPE_OPTIONS : UPLOAD_TYPE_OPTIONS;

  async function invalidate() {
    await router.invalidate();
  }

  async function handleDelete(documentId: string) {
    if (!confirm("Remove this document from the deal room?")) return;
    setError(null);
    try {
      await deleteDoc({ data: documentId });
      await invalidate();
    } catch (err) {
      setError(parseError(err));
    }
  }

  function startReplace(documentId: string) {
    setReplaceId(documentId);
    setShowUpload(true);
    fileRef.current?.click();
  }

  function uploadFile(file: File) {
    if (file.size > MAX_DEAL_ROOM_DOCUMENT_BYTES) {
      setError("Document must be 15MB or smaller.");
      return;
    }
    if (!ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DEAL_ROOM_DOCUMENT_MIME_TYPES)[number])) {
      setError("Only PDF, PNG, JPG, and DOCX files are accepted.");
      return;
    }

    setError(null);
    setUploadProgress(0);

    const form = new FormData();
    form.append("file", file);
    form.append("documentType", documentType);
    form.append("visibility", visibility);
    if (description.trim()) form.append("description", description.trim());
    if (replaceId) form.append("replaceDocumentId", replaceId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/deal-rooms/${dealRoomId}/documents`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploadProgress(null);
      setReplaceId(null);
      setShowUpload(false);
      setDescription("");

      if (xhr.status >= 200 && xhr.status < 300) {
        void invalidate();
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { message?: string };
        setError(payload.message ?? "Upload failed.");
      } catch {
        setError("Upload failed.");
      }
    };

    xhr.onerror = () => {
      setUploadProgress(null);
      setError("Upload failed. Check your connection and try again.");
    };

    xhr.send(form);
  }

  const hasDocuments = documents.totalActive > 0;

  return (
    <section className="space-y-6 border-b border-border bg-surface-1/30 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[17px] tracking-tight">Documents</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Secure document exchange for this facility — not a general file drive.
          </p>
        </div>
        {canUpload && !roomClosed && (
          <button
            type="button"
            onClick={() => {
              setShowUpload((v) => !v);
              setReplaceId(null);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
          >
            <Upload className="size-3.5" aria-hidden />
            Upload document
          </button>
        )}
      </header>

      <DealDocumentChecklist items={documents.checklist} variant={variant} />

      {variant === "internal" && (
        <div className="rounded-lg border border-border/70 bg-surface-2/10 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Request documentation
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[12px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Document type
              </span>
              <select
                className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-[13px]"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as DealRoomDocumentTypeCode)}
              >
                {REQUEST_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <BankReviewButton
              label="Request document"
              variant="primary"
              onAction={async () => {
                setError(null);
                await requestDoc({ data: { dealRoomId, documentType: requestType } });
                await invalidate();
              }}
            />
          </div>
        </div>
      )}

      {showUpload && canUpload && !roomClosed && (
        <div className="rounded-lg border border-border bg-surface-2/20 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {replaceId ? "Replace document" : "Upload document"}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {!replaceId && (
              <label className="text-[12px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Document type
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px]"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as DealRoomDocumentTypeCode)}
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {variant === "internal" && !replaceId && (
              <label className="text-[12px]">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Visibility
                </span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-[13px]"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "shared" | "internal_only")}
                >
                  <option value="shared">Shared with applicant</option>
                  <option value="internal_only">Internal only</option>
                </select>
              </label>
            )}
            <label className="text-[12px] sm:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Notes (optional)
              </span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            className="mt-3 block w-full text-[13px]"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            PDF, PNG, JPG, or DOCX · max 15 MB
          </p>
          {uploadProgress != null && (
            <div className="mt-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Uploading… {uploadProgress}%
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-gold transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {!hasDocuments && (
        <p className="text-[13px] text-muted-foreground">No documents have been uploaded.</p>
      )}

      <div className="space-y-6">
        {documents.groups.map((group) => (
          <DealDocumentGroupSection
            key={group.key}
            title={group.title}
            documents={group.documents}
            onDelete={canUpload && !roomClosed ? handleDelete : undefined}
            onReplace={canUpload && !roomClosed ? startReplace : undefined}
          />
        ))}
      </div>

      {variant === "internal" && documents.checklist.some((c) => c.canReview && c.linkedDocumentId) && (
        <InternalReviewActions
          checklist={documents.checklist}
          onReview={async (requestId, status) => {
            setError(null);
            await reviewRequest({ data: { requestId, status } });
            await invalidate();
          }}
        />
      )}
    </section>
  );
}

function InternalReviewActions({
  checklist,
  onReview,
}: {
  checklist: DealRoomDocumentsContext["checklist"];
  onReview: (requestId: string, status: "reviewed" | "approved" | "rejected") => Promise<void>;
}) {
  const reviewable = checklist.filter(
    (c) => c.canReview && c.linkedDocumentId && (c.status === "received" || c.status === "reviewed"),
  );
  if (reviewable.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-surface-2/10 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Document review
      </div>
      <ul className="mt-3 space-y-3">
        {reviewable.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span>{item.title}</span>
            <div className="flex flex-wrap gap-1">
              <BankReviewButton label="Mark reviewed" onAction={() => onReview(item.id, "reviewed")} />
              <BankReviewButton
                label="Approve"
                variant="primary"
                onAction={() => onReview(item.id, "approved")}
              />
              <BankReviewButton
                label="Reject"
                variant="danger"
                onAction={() => onReview(item.id, "rejected")}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Action failed";
  if (message.startsWith("BAD_REQUEST:")) return message.slice("BAD_REQUEST:".length);
  if (message === "FORBIDDEN") return "You do not have permission for this action.";
  return message;
}
