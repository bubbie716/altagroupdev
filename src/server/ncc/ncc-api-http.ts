import {
  apiErrorFromException,
  apiErrorResponse,
  apiSuccessResponse,
  createRequestId,
} from "@/lib/ncc/ncc-api-response";
import { NccApiError } from "@/lib/ncc/ncc-api-errors";
import type { NccApiScope } from "@/lib/ncc/ncc-api-scopes";
import {
  authenticateNccApiRequest,
  requireApiScope,
  requireLiveForFinancialMutation,
  type AuthenticatedNccApiContext,
} from "@/server/ncc/ncc-api-auth.service";
import {
  enforceNccApiRateLimit,
  rateLimitHeaders,
  type NccRateLimitClass,
} from "@/server/ncc/ncc-api-rate-limit.service";
import { hashIpForLog, writeNccApiRequestLog } from "@/server/ncc/ncc-api-request-log.service";

export type NccApiHandler = (
  ctx: AuthenticatedNccApiContext,
  request: Request,
  params: Record<string, string>,
) => Promise<unknown>;

export async function handleNccApiRequest(input: {
  request: Request;
  route: string;
  method: string;
  requiredScope: NccApiScope;
  rateLimitClass: NccRateLimitClass;
  requireLive?: boolean;
  params?: Record<string, string>;
  handler: NccApiHandler;
}): Promise<Response> {
  const requestId = createRequestId();
  const started = Date.now();
  let ctx: AuthenticatedNccApiContext | null = null;
  let errorCode: string | null = null;
  let status = 200;

  try {
    // Reject credentials in query strings.
    const url = new URL(input.request.url);
    for (const key of url.searchParams.keys()) {
      if (/auth|secret|token|key/i.test(key)) {
        throw new NccApiError("INVALID_REQUEST", "Credentials must not be supplied in query strings.", 400);
      }
    }

    ctx = await authenticateNccApiRequest(input.request, requestId);
    requireApiScope(ctx, input.requiredScope);
    if (input.requireLive) requireLiveForFinancialMutation(ctx);

    const ipHash = await hashIpForLog(input.request);
    try {
      await enforceNccApiRateLimit({
        className: input.rateLimitClass,
        credentialId: ctx.credentialId,
        institutionId: ctx.institutionId,
        ipHash,
      });
    } catch (error) {
      if (error instanceof NccApiError && error.code === "RATE_LIMITED") {
        status = 429;
        errorCode = "RATE_LIMITED";
        const response = apiErrorResponse("RATE_LIMITED", requestId, {
          status: 429,
          headers: rateLimitHeaders(error.retryAfterMs ?? 60_000),
        });
        await writeNccApiRequestLog({
          requestId,
          institutionId: ctx.institutionId,
          credentialId: ctx.credentialId,
          environment: ctx.environment,
          method: input.method,
          route: input.route,
          responseStatus: 429,
          errorCode: "RATE_LIMITED",
          latencyMs: Date.now() - started,
          idempotencyKey: input.request.headers.get("idempotency-key"),
          sourceIpHash: ipHash,
          userAgent: input.request.headers.get("user-agent"),
        });
        return response;
      }
      throw error;
    }

    const data = await input.handler(ctx, input.request, input.params ?? {});
    const response = apiSuccessResponse(data, requestId);
    status = response.status;
    await writeNccApiRequestLog({
      requestId,
      institutionId: ctx.institutionId,
      credentialId: ctx.credentialId,
      environment: ctx.environment,
      method: input.method,
      route: input.route,
      responseStatus: status,
      errorCode: null,
      latencyMs: Date.now() - started,
      idempotencyKey: input.request.headers.get("idempotency-key"),
      sourceIpHash: ipHash,
      userAgent: input.request.headers.get("user-agent"),
    });
    return response;
  } catch (error) {
    const response = apiErrorFromException(error, requestId);
    status = response.status;
    errorCode = error instanceof NccApiError ? error.code : "INTERNAL_ERROR";
    if (ctx) {
      await writeNccApiRequestLog({
        requestId,
        institutionId: ctx.institutionId,
        credentialId: ctx.credentialId,
        environment: ctx.environment,
        method: input.method,
        route: input.route,
        responseStatus: status,
        errorCode,
        latencyMs: Date.now() - started,
        idempotencyKey: input.request.headers.get("idempotency-key"),
        sourceIpHash: await hashIpForLog(input.request),
        userAgent: input.request.headers.get("user-agent"),
      });
    }
    return response;
  }
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: Request,
  allowedKeys: string[],
): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new NccApiError("INVALID_REQUEST", "Content-Type must be application/json.", 400);
  }
  const text = await request.text();
  if (text.length > 64_000) {
    throw new NccApiError("INVALID_REQUEST", "Request body is too large.", 400);
  }
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new NccApiError("INVALID_REQUEST", "Request body must be valid JSON.", 400);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new NccApiError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }
  const body = parsed as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!allowedKeys.includes(key)) {
      throw new NccApiError("VALIDATION_ERROR", `Unknown field: ${key}`, 400);
    }
  }
  // Reject client-supplied internal fields if present under aliases
  for (const forbidden of [
    "sendingInstitutionId",
    "status",
    "executionStatus",
    "ledgerBalance",
    "settledAt",
    "completedAt",
  ]) {
    if (forbidden in body) {
      throw new NccApiError("VALIDATION_ERROR", `Forbidden field: ${forbidden}`, 400);
    }
  }
  return body as T;
}
