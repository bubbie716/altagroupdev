import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertNotUiLabMutation } from "@/lib/internal/ui-lab-mutation-gate";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("UI Lab mutation gate", () => {
  it("documents assertNotUiLabMutation guard strings on server handlers", () => {
    const operations = [
      ["lib/bank/lending.functions.ts", "Begin lending review"],
      ["lib/bank/lending.functions.ts", "Accept lending application"],
      ["lib/bank/lending.functions.ts", "Deny lending application"],
      ["lib/company/company.functions.ts", "Verify company"],
      ["lib/company/company.functions.ts", "Reject company verification"],
      ["lib/company/company.functions.ts", "Revoke company verification"],
      ["lib/internal/user-management.functions.ts", "Change customer standing"],
      ["lib/internal/user-management.functions.ts", "Grant staff access tag"],
      ["lib/internal/user-management.functions.ts", "Revoke staff access tag"],
      ["lib/internal/internal-note.functions.ts", "Add internal note"],
      ["lib/platform/platform-settings.functions.ts", "Maintenance mode update"],
      ["lib/platform/platform-settings.functions.ts", "Credit Desk status change"],
      ["lib/platform/platform-settings.functions.ts", "Commercial plan settings"],
    ] as const;

    for (const [file, operation] of operations) {
      assert.match(read(file), new RegExp(`assertNotUiLabMutation\\("${operation}"\\)`));
    }
  });

  it("allows assertNotUiLabMutation outside UI Lab", () => {
    const prevUiLab = process.env.VITE_UI_LAB_MODE;
    try {
      delete process.env.VITE_UI_LAB_MODE;
      assert.doesNotThrow(() => assertNotUiLabMutation("test"));
    } finally {
      if (prevUiLab === undefined) delete process.env.VITE_UI_LAB_MODE;
      else process.env.VITE_UI_LAB_MODE = prevUiLab;
    }
  });

  it("guards lending, company, customer, and note server mutations", () => {
    const lending = read("lib/bank/lending.functions.ts");
    assert.match(lending, /assertNotUiLabMutation\("Begin lending review"\)/);
    assert.match(lending, /assertNotUiLabMutation\("Accept lending application"\)/);
    assert.match(lending, /assertNotUiLabMutation\("Deny lending application"\)/);

    const company = read("lib/company/company.functions.ts");
    assert.match(company, /assertNotUiLabMutation\("Verify company"\)/);
    assert.match(company, /assertNotUiLabMutation\("Reject company verification"\)/);
    assert.match(company, /assertNotUiLabMutation\("Revoke company verification"\)/);

    const users = read("lib/internal/user-management.functions.ts");
    assert.match(users, /assertNotUiLabMutation\("Change customer standing"\)/);
    assert.match(users, /assertNotUiLabMutation\("Grant staff access tag"\)/);
    assert.match(users, /assertNotUiLabMutation\("Revoke staff access tag"\)/);

    const notes = read("lib/internal/internal-note.functions.ts");
    assert.match(notes, /assertNotUiLabMutation\("Add internal note"\)/);
  });

  it("gates lending, company, customer, and note mutation UIs", () => {
    assert.match(read("components/internal/workspace/lending-application-workspace-view.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/company-verification-actions.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/internal-user-account-status-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/internal-user-tag-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/internal-note-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/credit-desk-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/maintenance-mode-panel.tsx"), /useUiLabMutationGate/);
    assert.match(read("components/internal/commercial-plan-settings-panel.tsx"), /useUiLabMutationGate/);
  });
});
