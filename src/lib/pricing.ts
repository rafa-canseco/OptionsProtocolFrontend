/** Convert an asset amount to USD using spot prices. */
export function toUsd(
  amount: number,
  asset: string,
  ethSpot: number | undefined,
  btcSpot: number | undefined,
): number {
  if (asset === "usdc") return amount;
  if (asset === "eth") return amount * (ethSpot ?? 0);
  if (asset === "btc") return amount * (btcSpot ?? 0);
  return 0;
}
