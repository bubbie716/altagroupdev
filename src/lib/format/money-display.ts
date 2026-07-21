export const florin = (n: number) =>
  "ƒ" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const compact = (n: number) =>
  Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);

export const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(2) + "%";
