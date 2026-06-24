function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

export async function signValue(payload: string): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

export async function verifySignedValue(payload: string, signature: string): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) return false;
  try {
    const key = await importKey(secret);
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature) as BufferSource,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

export async function sealJson<T>(data: T): Promise<string | null> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
  const signature = await signValue(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

export async function unsealJson<T>(token: string): Promise<T | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const valid = await verifySignedValue(payload, signature);
  if (!valid) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toBase64Url(arr);
}
