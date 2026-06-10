export const CURRENCY_SYMBOL = "R";

export function formatMoney(amount: number | string | null | undefined): string {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0);
  if (!Number.isFinite(n)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}
