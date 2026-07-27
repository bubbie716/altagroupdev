import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)));

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("TanStack Start CSRF middleware wiring", () => {
  it("protects server functions with createCsrfMiddleware in start.ts", () => {
    const start = read("start.ts");
    assert.match(start, /createCsrfMiddleware/);
    assert.match(start, /handlerType\s*===\s*["']serverFn["']/);
    assert.match(start, /requestMiddleware:\s*\[[^\]]*csrfMiddleware/);
    assert.match(start, /errorMiddleware/);
    // Must not merely silence the warning without installing CSRF protection.
    assert.doesNotMatch(start, /disableCsrfMiddlewareWarning:\s*true/);
  });

  it("exports csrfMiddleware for inspection and keeps error page middleware", () => {
    const start = read("start.ts");
    assert.match(start, /export const csrfMiddleware/);
    assert.match(start, /renderErrorPage/);
  });
});
