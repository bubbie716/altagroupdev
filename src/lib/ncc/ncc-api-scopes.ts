/** Explicit institution API scopes — server-enforced only. */
export const NCC_API_SCOPES = [
  "institution:read",
  "routing:read",
  "accounts:read",
  "settlements:read",
  "settlements:create",
  "settlements:cancel",
  "settlements:reverse",
  "webhooks:read",
  "webhooks:write",
  "api_logs:read",
] as const;

export type NccApiScope = (typeof NCC_API_SCOPES)[number];

export const NCC_API_SCOPE_SET = new Set<string>(NCC_API_SCOPES);

export function isNccApiScope(value: string): value is NccApiScope {
  return NCC_API_SCOPE_SET.has(value);
}

export function assertScopesSupported(scopes: string[]): NccApiScope[] {
  const out: NccApiScope[] = [];
  for (const scope of scopes) {
    if (!isNccApiScope(scope)) {
      throw new Error(`UNSUPPORTED_SCOPE:${scope}`);
    }
    if (!out.includes(scope)) out.push(scope);
  }
  return out;
}

export const ROUTE_REQUIRED_SCOPES = {
  "GET /institution": ["institution:read"] as const,
  "GET /institution/routing-numbers": ["routing:read"] as const,
  "GET /institution/settlement-accounts": ["accounts:read"] as const,
  "POST /settlements": ["settlements:create"] as const,
  "GET /settlements": ["settlements:read"] as const,
  "GET /settlements/:reference": ["settlements:read"] as const,
  "POST /settlements/:reference/cancel": ["settlements:cancel"] as const,
  "POST /settlements/:reference/reverse": ["settlements:reverse"] as const,
} as const;
