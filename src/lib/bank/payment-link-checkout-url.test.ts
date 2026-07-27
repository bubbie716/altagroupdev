import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  absolutePaymentLinkCheckoutUrl,
  paymentLinkCheckoutPath,
} from "./payment-link-checkout-url.ts";

describe("payment-link checkout URL hydration safety", () => {
  it("keeps a stable relative path for display (SSR == initial client)", () => {
    assert.equal(paymentLinkCheckoutPath("yfkgqgzf"), "/pay/yfkgqgzf");
    assert.equal(paymentLinkCheckoutPath("/pay/yfkgqgzf"), "/pay/yfkgqgzf");
  });

  it("builds an absolute URL only when an origin is supplied (copy action)", () => {
    assert.equal(
      absolutePaymentLinkCheckoutUrl("/pay/yfkgqgzf", "http://127.0.0.1:3000"),
      "http://127.0.0.1:3000/pay/yfkgqgzf",
    );
    assert.equal(
      absolutePaymentLinkCheckoutUrl("yfkgqgzf", "https://bank.example/"),
      "https://bank.example/pay/yfkgqgzf",
    );
  });

  it("detail and workflow panels do not read window during render", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const detail = readFileSync(
      join(root, "components/bank/payment-links/payment-link-detail-panel.tsx"),
      "utf8",
    );
    const workflow = readFileSync(
      join(root, "components/bank/payment-links/payment-link-workflow.tsx"),
      "utf8",
    );
    assert.match(detail, /absolutePaymentLinkCheckoutUrl/);
    assert.match(workflow, /absolutePaymentLinkCheckoutUrl/);
    assert.doesNotMatch(detail, /fullCheckoutUrl\s*\(/);
    assert.doesNotMatch(workflow, /fullCheckoutUrl\s*\(/);
    assert.doesNotMatch(
      detail,
      /typeof window !== "undefined"[\s\S]{0,80}window\.location\.origin/,
    );
    assert.doesNotMatch(
      workflow,
      /typeof window !== "undefined"[\s\S]{0,80}window\.location\.origin/,
    );
  });
});
