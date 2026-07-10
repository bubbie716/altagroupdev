import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(readFileSync(join(root, "typescript-baseline.json"), "utf8"));

let output = "";
try {
  execFileSync("npx", ["tsc", "--noEmit", "-p", "tsconfig.typecheck.json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  const err = error;
  output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
}

const match = output.match(/error TS/g);
const count = match ? match.length : 0;

if (count > baseline.errorCount) {
  console.error(
    `TypeScript error count ${count} exceeds baseline ${baseline.errorCount}. Fix new errors or update baseline intentionally.`,
  );
  if (output.trim()) console.error(output);
  process.exit(1);
}

if (count === 0) {
  console.log("Typecheck passed with zero errors.");
} else {
  console.log(`Typecheck within baseline (${count}/${baseline.errorCount} errors).`);
}

process.exit(0);
