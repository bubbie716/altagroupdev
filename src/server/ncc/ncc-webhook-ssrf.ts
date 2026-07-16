/**
 * SSRF protections for NCC webhook delivery destinations.
 * Validates URL shape, resolves DNS once, and returns a pinned public address
 * for connection. Delivery must connect only to that address (no second resolve).
 */

import type { LookupAddress } from "node:dns";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const u = n >>> 0;
  if (((u & 0xff000000) >>> 0) === 0x00000000) return true;
  if (((u & 0xff000000) >>> 0) === 0x0a000000) return true;
  if (((u & 0xff000000) >>> 0) === 0x7f000000) return true;
  if (((u & 0xffff0000) >>> 0) === 0xa9fe0000) return true;
  if (((u & 0xfff00000) >>> 0) === 0xac100000) return true;
  if (((u & 0xffff0000) >>> 0) === 0xc0a80000) return true;
  if (((u & 0xf0000000) >>> 0) === 0xe0000000) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  // Hex-form IPv4-mapped (e.g. ::ffff:a9fe:a9fe) — decode and evaluate as IPv4
  const hexMapped = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMapped) {
    const hi = Number.parseInt(hexMapped[1]!, 16);
    const lo = Number.parseInt(hexMapped[2]!, 16);
    if (!Number.isFinite(hi) || !Number.isFinite(lo)) return true;
    const ip = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
    return isPrivateIpv4(ip);
  }
  return false;
}

export type WebhookUrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; code: string; reason: string };

export function validateWebhookUrlShape(
  rawUrl: string,
  options?: { requireHttps?: boolean },
): WebhookUrlValidationResult {
  const requireHttps = options?.requireHttps ?? true;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Malformed URL" };
  }

  if (url.username || url.password) {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Embedded credentials are not allowed" };
  }
  if (requireHttps && url.protocol !== "https:") {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "HTTPS is required" };
  }
  if (!requireHttps && url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Unsupported URL scheme" };
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Hostname is not allowed" };
  }
  if (host === "metadata" || host.endsWith(".internal")) {
    return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Hostname is not allowed" };
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIpv4(host)) {
      return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Private IPv4 addresses are not allowed" };
    }
  }
  if (host.includes(":")) {
    if (isBlockedIpv6(host)) {
      return { ok: false, code: "WEBHOOK_URL_REJECTED", reason: "Private/reserved IPv6 addresses are not allowed" };
    }
  }

  return { ok: true, url };
}

export function isBlockedResolvedAddress(address: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) return isPrivateIpv4(address);
  return isBlockedIpv6(address);
}

export type WebhookDnsResolver = (hostname: string) => Promise<LookupAddress[]>;

let testDnsResolver: WebhookDnsResolver | null = null;

/** Test-only DNS injection — do not use in production paths. */
export function setWebhookDnsResolverForTests(resolver: WebhookDnsResolver | null): void {
  testDnsResolver = resolver;
}

async function resolveHostname(hostname: string): Promise<LookupAddress[]> {
  if (testDnsResolver) return testDnsResolver(hostname);
  const dns = await import("node:dns/promises");
  return dns.lookup(hostname, { all: true, verbatim: true });
}

export type PinnedWebhookDestination = {
  url: URL;
  hostname: string;
  pinnedAddress: string;
  family: 4 | 6;
};

async function reject(code: string, reason: string): Promise<never> {
  const { NccApiError } = await import("@/lib/ncc/ncc-api-errors");
  throw new NccApiError(code, reason, 400);
}

/**
 * Validate URL + resolve DNS once. Returns a pinned public address for connection.
 * Rejects if any resolved address is prohibited (mixed results fail closed).
 */
export async function resolvePinnedWebhookDestination(
  rawUrl: string,
  options?: { requireHttps?: boolean },
): Promise<PinnedWebhookDestination> {
  const shape = validateWebhookUrlShape(rawUrl, options);
  if (shape.ok === false) {
    return await reject(shape.code, shape.reason);
  }
  const url = shape.url;
  const hostname = url.hostname;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    if (isBlockedResolvedAddress(hostname)) {
      await reject("WEBHOOK_URL_REJECTED", "Private IPv4 addresses are not allowed");
    }
    return { url, hostname, pinnedAddress: hostname, family: 4 };
  }
  if (hostname.includes(":")) {
    if (isBlockedResolvedAddress(hostname)) {
      await reject("WEBHOOK_URL_REJECTED", "Private/reserved IPv6 addresses are not allowed");
    }
    return {
      url,
      hostname,
      pinnedAddress: hostname.replace(/^\[|\]$/g, ""),
      family: 6,
    };
  }

  let results: LookupAddress[];
  try {
    results = await resolveHostname(hostname);
  } catch {
    return await reject("WEBHOOK_URL_REJECTED", "Hostname could not be validated");
  }

  if (!results.length) {
    return await reject("WEBHOOK_URL_REJECTED", "Hostname could not be resolved");
  }

  for (const result of results) {
    if (isBlockedResolvedAddress(result.address)) {
      return await reject("WEBHOOK_URL_REJECTED", "Hostname resolves to a prohibited address");
    }
  }

  const chosen = results[0]!;
  const family = (chosen.family === 6 ? 6 : 4) as 4 | 6;
  return {
    url,
    hostname,
    pinnedAddress: chosen.address,
    family,
  };
}

/** @deprecated Prefer resolvePinnedWebhookDestination — kept for call-site compatibility. */
export async function assertWebhookUrlSafeForDelivery(
  rawUrl: string,
  options?: { requireHttps?: boolean },
): Promise<URL> {
  const pinned = await resolvePinnedWebhookDestination(rawUrl, options);
  return pinned.url;
}
