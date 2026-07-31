import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  d,
  serializeCryptoMoney,
  serializeCryptoPrice,
  serializeCryptoQuantity,
} from "./crypto-decimal";

const repoRoot = process.cwd();
const cryptoLib = join(repoRoot, "src/lib/terminal/crypto");
const componentsRoot = join(repoRoot, "src/components");
const routesRoot = join(repoRoot, "src/routes");

const CLIENT_FORBIDDEN_IMPORT =
  /from\s+["']@\/lib\/terminal\/crypto\/(crypto-decimal|crypto-constants|crypto-curve-math|crypto-pricing|crypto-market-read\.service|crypto-ops-read\.service|crypto-activation-readiness\.service|terminal-crypto-execution\.service)["']/;

const DANGEROUS_LITERAL_SERIALIZE =
  /serializeCrypto(?:Money|Price|Quantity)\(\s*0\s*\)|serializeCrypto(?:Money|Price|Quantity)\([^)]*\?\?\s*0\b/;

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTsFiles(full, out);
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function isLikelyClientModule(path: string, src: string): boolean {
  if (src.includes('"use client"') || src.includes("'use client'")) return true;
  // Route/page modules and components hydrate in the browser.
  if (path.includes(`${join("src", "components")}${join("/", "")}`)) return true;
  if (path.includes(`${join("src", "routes")}${join("/", "")}`) && path.endsWith(".tsx")) {
    return true;
  }
  return false;
}

describe("crypto production safety guards", () => {
  it("presentation serializers tolerate accidental JS number zero", () => {
    assert.equal(serializeCryptoMoney(0), "0.00");
    assert.equal(serializeCryptoPrice(0), "0.000000000000");
    assert.equal(serializeCryptoQuantity(0), "0.00000000");
    assert.equal(serializeCryptoMoney(12.345), "12.34");
  });

  it("authoritative d() still rejects raw JS numbers", () => {
    assert.throws(() => d(0), /rejects JavaScript number/);
    assert.throws(() => d(1.5), /rejects JavaScript number/);
  });

  it("does not leave serializeCrypto*(0) / ?? 0 landmines in crypto lib", () => {
    const offenders: string[] = [];
    for (const file of walkTsFiles(cryptoLib)) {
      if (file.endsWith(".test.ts")) continue;
      const src = readFileSync(file, "utf8");
      if (DANGEROUS_LITERAL_SERIALIZE.test(src)) {
        offenders.push(file.replace(repoRoot + "/", ""));
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("keeps Prisma/Decimal server modules out of client component imports", () => {
    const offenders: string[] = [];
    for (const root of [componentsRoot, routesRoot]) {
      for (const file of walkTsFiles(root)) {
        const src = readFileSync(file, "utf8");
        if (!isLikelyClientModule(file, src)) continue;
        // Allow type-only imports.
        const withoutTypeImports = src
          .replace(/import\s+type\s+[^;]+;/g, "")
          .replace(/import\s*\{[^}]*\}\s*from\s+["'][^"']+["']\s*;/g, (block) =>
            /\btype\s+\w+/.test(block) && !/\b(?!type\b)\w+\s*,/.test(block.replace(/\btype\s+\w+/g, ""))
              ? ""
              : block,
          );
        // Simpler: flag value imports of forbidden modules.
        for (const line of src.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("import type ")) continue;
          if (trimmed.startsWith("//")) continue;
          if (CLIENT_FORBIDDEN_IMPORT.test(trimmed)) {
            // import { type Foo } from '...' with only types is ok-ish; still avoid service modules.
            if (/import\s*\{\s*type\s+/.test(trimmed) && !/,\s*(?!type\b)[A-Za-z]/.test(trimmed)) {
              continue;
            }
            offenders.push(`${file.replace(repoRoot + "/", "")}: ${trimmed}`);
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("crypto-impact-ack stays browser-safe (no crypto-decimal)", () => {
    const src = readFileSync(join(cryptoLib, "crypto-impact-ack.ts"), "utf8");
    const imports = src
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("import "));
    for (const line of imports) {
      assert.doesNotMatch(line, /crypto-decimal|@prisma\/client/);
    }
  });

  it("crypto-format stays browser-safe (no prisma / constants / decimal)", () => {
    const src = readFileSync(join(cryptoLib, "crypto-format.ts"), "utf8");
    const fromClauses = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    for (const mod of fromClauses) {
      assert.doesNotMatch(mod, /@prisma\/client|crypto-decimal|crypto-constants/);
    }
    assert.ok(fromClauses.some((m) => m.includes("crypto-symbols")));
  });
});
