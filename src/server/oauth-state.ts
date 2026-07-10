import { createHash } from "node:crypto";
import {
  buildClearCookie,
  buildSetCookie,
  getOAuthStateCookieName,
  oauthStateMaxAgeSec,
  readCookie,
} from "@/server/session";
import { randomToken } from "@/server/crypto";

export type OAuthStatePayload = {
  returnTo: string;
  returnOrigin: string;
  nonce: string;
};

export function hashOAuthStateNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export function buildOAuthStateCookie(nonce: string, requestHost?: string): string {
  return buildSetCookie(
    getOAuthStateCookieName(),
    hashOAuthStateNonce(nonce),
    oauthStateMaxAgeSec(),
    requestHost,
  );
}

export function readOAuthStateCookie(request: Request): string | null {
  return readCookie(getOAuthStateCookieName(), request.headers.get("cookie"));
}

export function validateOAuthStateCookie(request: Request, nonce: string | undefined): boolean {
  if (!nonce?.trim()) return false;
  const cookieValue = readOAuthStateCookie(request);
  if (!cookieValue) return false;
  return cookieValue === hashOAuthStateNonce(nonce);
}

export function generateOAuthStateNonce(): string {
  return randomToken(16);
}

export function clearOAuthStateCookie(requestHost?: string): string {
  return buildClearCookie(getOAuthStateCookieName(), requestHost);
}
