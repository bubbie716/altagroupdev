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

/** Hex-only token — never contains `_`, safe as NCC credential keyPrefix delimiters. */
export function randomHexToken(bytes = 6): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/**
 * Master key for NCC secret encryption and API credential hashing.
 * Production requires NCC_SECRETS_KEY (min 32). SESSION_SECRET / dev pepper are non-prod only.
 */
export function requireNccSecretsKey(): string {
  const dedicated = process.env.NCC_SECRETS_KEY?.trim();
  if (dedicated && dedicated.length >= 32) return dedicated;
  if (isProductionRuntime()) {
    throw new Error(
      "NCC_SECRETS_KEY is required in production (min 32 characters). SESSION_SECRET fallback and the development pepper are not permitted.",
    );
  }
  const session = getSessionSecret();
  if (session) return session;
  return "ncc-dev-pepper-not-for-production-use!!!!";
}

function getSecretsMasterKey(): string {
  return requireNccSecretsKey();
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Authenticated encryption for secrets that must be recoverable (e.g. webhook signing keys). */
export async function encryptSecret(plaintext: string): Promise<string> {
  const master = getSecretsMasterKey();
  const key = await importAesKey(master);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const bytes = new Uint8Array(ciphertext);
  // v1 = key-version metadata for future NCC_SECRETS_KEY rotation migrations.
  return `v1.${toBase64Url(iv)}.${toBase64Url(bytes)}`;
}

export async function decryptSecret(payload: string): Promise<string | null> {
  const master = getSecretsMasterKey();
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  try {
    const key = await importAesKey(master);
    const iv = fromBase64Url(parts[1]!);
    const data = fromBase64Url(parts[2]!);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      data as BufferSource,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** One-way hash for API authentication secrets (high-entropy machine secrets). */
export async function hashApiSecret(secret: string): Promise<string> {
  const pepper = requireNccSecretsKey();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${pepper}:ncc-api:${secret}`),
  );
  return toBase64Url(new Uint8Array(digest));
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) {
    // Still compare to reduce timing leakage on length-mismatched paths.
    let diff = aBytes.length ^ bBytes.length;
    const len = Math.max(aBytes.length, bBytes.length);
    for (let i = 0; i < len; i++) {
      diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
    }
    return diff === 0 && aBytes.length === bBytes.length;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i]! ^ bBytes[i]!;
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { toBase64Url, fromBase64Url };
