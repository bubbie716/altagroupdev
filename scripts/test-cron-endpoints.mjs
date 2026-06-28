import { readFileSync } from "node:fs";

const env = readFileSync(".env", "utf8");
const secretMatch = env.match(/^CRON_SECRET=(.+)$/m);
const raw = secretMatch?.[1]?.trim() ?? "";
const secret = raw.replace(/^["']|["']$/g, "");
if (!secret) {
  console.error("CRON_SECRET not set in .env");
  process.exit(1);
}

const base = process.env.CRON_TEST_BASE ?? "http://localhost:3000";
const paths = [
  "/api/cron/scheduled-transfers",
  "/api/cron/daily-servicing",
  "/api/cron/relationship-intelligence",
];

for (const path of paths) {
  const start = Date.now();
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 200);
    }
    const elapsed = Date.now() - start;
    console.log(`\n=== ${path} ===`);
    console.log(`HTTP ${res.status} · ${elapsed}ms`);
    console.log(typeof body === "object" ? JSON.stringify(body, null, 2).slice(0, 800) : body);
    if (!res.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`\n=== ${path} === FAILED`);
    console.error(error);
    process.exitCode = 1;
  }
}
