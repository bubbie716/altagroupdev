import { readCookie, getSessionCookieName } from "@/server/session";
import { loadUserBySessionToken } from "@/server/session.service";
import type { AltaUser } from "@/lib/auth/types";

export async function requireAuthFromRequest(request: Request): Promise<AltaUser> {
  const token = readCookie(getSessionCookieName(), request.headers.get("cookie"));
  if (!token) throw new Error("UNAUTHORIZED");

  const user = await loadUserBySessionToken(token);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ ok: false, message }, { status });
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
