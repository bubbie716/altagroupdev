/** Terminal-specific money and percent formatting. */

export function formatTerminalMoney(value: number, opts?: { signed?: boolean }): string {
  const abs = Math.abs(value);
  const formatted =
    "ƒ" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (!opts?.signed) return value < 0 ? `-${formatted}` : formatted;
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatTerminalPrice(value: number): string {
  const digits = value >= 100 ? 2 : value >= 1 ? 2 : 4;
  return (
    "ƒ" +
    value.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatTerminalPercent(value: number, opts?: { signed?: boolean }): string {
  const signed = opts?.signed !== false;
  const body = `${Math.abs(value).toFixed(2)}%`;
  if (!signed) return value < 0 ? `-${body}` : body;
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

export function formatCompactVolume(value: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(
    value,
  );
}

export function formatMarketCap(value: number | null): string {
  if (value == null) return "—";
  return `ƒ${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}
