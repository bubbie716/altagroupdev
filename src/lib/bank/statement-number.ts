import { randomInt } from "node:crypto";

/** Extract short account segment from AB-####-###### for statement numbers. */
export function accountShortCode(accountNumber: string): string {
  const digits = accountNumber.replace(/\D/g, "");
  return digits.slice(-6).padStart(6, "0");
}

/** Format: STMT-[YEAR][MONTH]-[ACCOUNT_SHORT]-[RANDOM] e.g. STMT-202606-482913-7742 */
export function formatStatementNumber(
  periodEnd: Date,
  accountNumber: string,
  randomSuffix?: string,
): string {
  const year = periodEnd.getUTCFullYear();
  const month = String(periodEnd.getUTCMonth() + 1).padStart(2, "0");
  const short = accountShortCode(accountNumber);
  const random = randomSuffix ?? String(randomInt(1000, 9999));
  return `STMT-${year}${month}-${short}-${random}`;
}
