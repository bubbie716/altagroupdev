export type AssetAllocationInput = {
  cash: number;
  equities: number;
  privateCredit: number;
  alternativeAssets: number;
};

export type AssetAllocationItem = {
  id: string;
  label: string;
  value: number;
  percent: number;
};

type AssetClassDefinition = {
  id: keyof AssetAllocationInput;
  label: string;
};

/** Ordered asset classes shown in the home portfolio allocation card. */
export const ASSET_ALLOCATION_CLASSES: readonly AssetClassDefinition[] = [
  { id: "cash", label: "Cash" },
  { id: "equities", label: "Equities" },
  { id: "privateCredit", label: "Private Credit" },
  { id: "alternativeAssets", label: "Alternative Assets" },
] as const;

/** Integer percents that always sum to 100 when total value is positive. */
export function normalizeAllocationPercents(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const raw = values.map((value) => (value / total) * 100);
  const floored = raw.map((percent) => Math.floor(percent));
  let remainder = 100 - floored.reduce((sum, percent) => sum + percent, 0);

  const order = raw
    .map((percent, index) => ({ index, fraction: percent - floored[index] }))
    .sort((a, b) => b.fraction - a.fraction);

  const normalized = [...floored];
  for (const entry of order) {
    if (remainder <= 0) break;
    normalized[entry.index] += 1;
    remainder -= 1;
  }

  return normalized;
}

export function computeAssetAllocation(input: AssetAllocationInput): AssetAllocationItem[] {
  const values = ASSET_ALLOCATION_CLASSES.map((assetClass) => input[assetClass.id]);
  const percents = normalizeAllocationPercents(values);

  return ASSET_ALLOCATION_CLASSES.map((assetClass, index) => ({
    id: assetClass.id,
    label: assetClass.label,
    value: values[index],
    percent: percents[index],
  }));
}

/** Demo split for signed-out / mock portfolio preview. */
export function demoAssetAllocation(netWorth: number): AssetAllocationItem[] {
  return computeAssetAllocation({
    cash: netWorth * 0.82,
    equities: netWorth * 0.12,
    privateCredit: netWorth * 0.04,
    alternativeAssets: netWorth * 0.02,
  });
}

export function assetAllocationFromSnapshot(snapshot: {
  florinBalance: number;
  portfolioValue: number;
}): AssetAllocationItem[] {
  return computeAssetAllocation({
    cash: snapshot.florinBalance,
    equities: snapshot.portfolioValue,
    privateCredit: 0,
    alternativeAssets: 0,
  });
}
