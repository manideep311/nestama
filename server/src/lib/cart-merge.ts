import { MAX_LINE_QUANTITY } from "@nestama/shared";

export interface MergeLine {
  variantId: string;
  quantity: number;
}

/**
 * Folds a guest cart into a user's cart on sign-in: quantities for the same variant are summed and
 * capped at both available stock and the per-line maximum; sold-out or unknown variants are dropped.
 * The user's existing lines keep their order, new guest lines follow.
 */
export function mergeCartLines(
  guest: MergeLine[],
  user: MergeLine[],
  stockByVariant: Map<string, number>,
  max = MAX_LINE_QUANTITY,
): MergeLine[] {
  const totals = new Map<string, number>();
  for (const line of [...user, ...guest]) totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);

  const merged: MergeLine[] = [];
  for (const [variantId, quantity] of totals) {
    const cap = Math.min(stockByVariant.get(variantId) ?? 0, max);
    if (cap > 0) merged.push({ variantId, quantity: Math.min(quantity, cap) });
  }
  return merged;
}
