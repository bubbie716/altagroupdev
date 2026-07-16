import { randomToken } from "@/server/crypto";
import { NccApiError, messageForNccApiCode } from "@/lib/ncc/ncc-api-errors";

export function createRequestId(): string {
  return `req_${randomToken(12)}`;
}

export function apiSuccessResponse<T>(
  data: T,
  requestId: string,
  init?: { status?: number; headers?: HeadersInit },
): Response {
  return Response.json(
    {
      data,
      requestId,
      timestamp: new Date().toISOString(),
    },
    {
      status: init?.status ?? 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...init?.headers,
      },
    },
  );
}

export function apiErrorResponse(
  code: string,
  requestId: string,
  options?: { status?: number; message?: string; headers?: HeadersInit },
): Response {
  const status = options?.status ?? (code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 400);
  return Response.json(
    {
      error: {
        code,
        message: options?.message ?? messageForNccApiCode(code),
      },
      requestId,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        ...options?.headers,
      },
    },
  );
}

export function apiErrorFromException(error: unknown, requestId: string): Response {
  if (error instanceof NccApiError) {
    return apiErrorResponse(error.code, requestId, {
      status: error.httpStatus,
      message: error.message,
    });
  }
  console.error("[ncc-api]", requestId, error instanceof Error ? error.message : error);
  return apiErrorResponse("INTERNAL_ERROR", requestId, { status: 500 });
}
