export type LegalDocCategory =
  | "Alta Group — Corporate"
  | "Alta Group — Legal"
  | "Alta Bank — Corporate"
  | "Alta Bank — Legal"
  | "Alta Terminal — Corporate"
  | "Alta Terminal — Legal";

export type LegalDocKind = "corporate" | "legal" | "template";

export type LegalDocMeta = {
  id: string;
  title: string;
  category: LegalDocCategory;
  entity: string;
  kind: LegalDocKind;
  filename: string;
  description: string;
};

const DOC_ID_PATTERN = /^([A-Z]+-(?:COR|LEGAL)-\d+)/;

function parseDocId(filename: string): string | null {
  const match = filename.match(DOC_ID_PATTERN);
  return match?.[1] ?? null;
}

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.md$/, "");
  const parts = withoutExt.split("-");
  const titleParts = parts.slice(3);
  return titleParts
    .join(" ")
    .replace(/\bv(\d+(?:\.\d+)?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryForId(id: string): LegalDocCategory | null {
  if (id.startsWith("AG-COR-")) return "Alta Group — Corporate";
  if (id.startsWith("AG-LEGAL-")) return "Alta Group — Legal";
  if (id.startsWith("AB-COR-")) return "Alta Bank — Corporate";
  if (id.startsWith("AB-LEGAL-")) return "Alta Bank — Legal";
  if (id.startsWith("AT-COR-")) return "Alta Terminal — Corporate";
  if (id.startsWith("AT-LEGAL-")) return "Alta Terminal — Legal";
  // Legacy AE-* documents are not part of the public catalog.
  return null;
}

function entityForId(id: string): string {
  if (id.startsWith("AG-")) return "Alta Group N.V.";
  if (id.startsWith("AB-")) return "Alta Bank N.V.";
  if (id.startsWith("AT-")) return "Alta Terminal";
  return "Alta Group N.V.";
}

function kindForId(id: string, title: string): LegalDocKind {
  if (title.toLowerCase().includes("template")) return "template";
  return id.includes("-COR-") ? "corporate" : "legal";
}

function descriptionFor(meta: Pick<LegalDocMeta, "id" | "title" | "kind">): string {
  if (meta.kind === "template") {
    return "Per-customer agreement template with customizable fields.";
  }
  if (meta.id.includes("-COR-")) {
    return "Corporate governance charter, ownership, and operating authority.";
  }
  if (meta.title.toLowerCase().includes("fee schedule")) {
    return "Published fee schedule for Alta services.";
  }
  if (meta.title.toLowerCase().includes("rules")) {
    return "Operating and conduct rules for platform participants.";
  }
  if (meta.title.toLowerCase().includes("privacy")) {
    return "Platform-wide privacy and data handling policy.";
  }
  if (meta.title.toLowerCase().includes("terms")) {
    return "Platform-wide terms governing use of Alta services.";
  }
  return "Legal agreement, policy, or disclosure for Alta services.";
}

function metaFromPath(path: string): LegalDocMeta | null {
  const filename = path.split("/").pop() ?? "";
  const id = parseDocId(filename);
  if (!id) return null;
  const category = categoryForId(id);
  if (!category) return null;

  const title = titleFromFilename(filename);
  const kind = kindForId(id, title);
  return {
    id,
    title,
    category,
    entity: entityForId(id),
    kind,
    filename,
    description: descriptionFor({ id, title, kind }),
  };
}

/** Lazy loaders — bodies are fetched per document instead of bundled globally. */
const docLoaders = import.meta.glob<string>("../../content/legal-docs/*.md", {
  query: "?raw",
  import: "default",
});

const docLoaderById = new Map<string, () => Promise<string>>();
for (const [path, loader] of Object.entries(docLoaders)) {
  const meta = metaFromPath(path);
  if (meta) docLoaderById.set(meta.id, loader);
}
// Legacy deep-link ID for the Terminal customer agreement.
docLoaderById.set("AE-LEGAL-001", docLoaderById.get("AT-LEGAL-001")!);

export const legalDocsCatalog: LegalDocMeta[] = Object.keys(docLoaders)
  .map(metaFromPath)
  .filter((meta): meta is LegalDocMeta => meta !== null)
  .sort((a, b) => a.id.localeCompare(b.id));

export const legalDocsByCategory = legalDocsCatalog.reduce<
  Record<LegalDocCategory, LegalDocMeta[]>
>(
  (acc, doc) => {
    acc[doc.category].push(doc);
    return acc;
  },
  {
    "Alta Group — Corporate": [],
    "Alta Group — Legal": [],
    "Alta Bank — Corporate": [],
    "Alta Bank — Legal": [],
    "Alta Terminal — Corporate": [],
    "Alta Terminal — Legal": [],
  },
);

export const legalDocCategoryOrder: LegalDocCategory[] = [
  "Alta Group — Corporate",
  "Alta Group — Legal",
  "Alta Bank — Corporate",
  "Alta Bank — Legal",
  "Alta Terminal — Corporate",
  "Alta Terminal — Legal",
];

export function getLegalDocMeta(id: string): LegalDocMeta | undefined {
  if (id === "AE-LEGAL-001") return legalDocsCatalog.find((doc) => doc.id === "AT-LEGAL-001");
  return legalDocsCatalog.find((doc) => doc.id === id);
}

export async function getLegalDoc(id: string): Promise<{ meta: LegalDocMeta; body: string } | null> {
  const meta = getLegalDocMeta(id);
  if (!meta) return null;

  const loader = docLoaderById.get(id) ?? docLoaderById.get(meta.id);
  if (!loader) return null;

  const body = await loader();
  return { meta, body };
}

export async function hasLegalDocBody(id: string): Promise<boolean> {
  return Boolean(docLoaderById.get(id) ?? (id === "AE-LEGAL-001" && docLoaderById.get("AT-LEGAL-001")));
}
