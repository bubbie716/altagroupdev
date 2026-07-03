/** Format amounts in Alta florins for notifications and server-side copy. */
export function formatFlorin(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  return `${sign}ƒ${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
