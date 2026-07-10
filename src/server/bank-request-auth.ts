import { readCookie, getSessionCookieName } from "@/server/session";
import { loadUserBySessionToken } from "@/server/session.service";
import type { AltaUser } from "@/lib/auth/types";

export async function requireAuthFromRequest(request: Request): Promise<AltaUser> {
  const token = readCookie(getSessionCookieName(), request.headers.get("cookie"));
  if (!token) throw new Error("UNAUTHORIZED");

  const user = await loadUserBySessionToken(token);
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.accountStatus === "frozen" || user.accountStatus === "restricted") {
    throw new Error("ACCOUNT_RESTRICTED");
  }
  return user;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, message }, { status });
}

/** Map auth errors from `requireAuthFromRequest` to HTTP responses. */
export function authRequestErrorResponse(error: unknown): Response | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") return jsonError("Authentication required.", 401);
  if (message === "FORBIDDEN") return jsonError("You do not have access.", 403);
  if (message === "ACCOUNT_RESTRICTED") {
    return jsonError("Your account is restricted.", 403);
  }
  return null;
}

/** Inline preview for images/PDFs in browser; attachment for explicit downloads. */
export function attachmentContentDisposition(
  request: Request,
  contentType: string,
  fileName: string,
): string {
  const url = new URL(request.url);
  const dest = request.headers.get("sec-fetch-dest")?.toLowerCase();
  const inline =
    url.searchParams.get("inline") === "1" ||
    dest === "image" ||
    dest === "iframe" ||
    dest === "document" ||
    (contentType.startsWith("image/") && dest !== "download");
  const mode = inline ? "inline" : "attachment";
  return `${mode}; filename="${encodeURIComponent(fileName)}"`;
}

export function parseFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function parseProofFile(formData: FormData): File | null {
  const value = formData.get("proof");
  if (!value || !(value instanceof File) || value.size <= 0) {
    return null;
  }
  return value;
}
