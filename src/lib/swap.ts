import { encodeFunctionData, type Address } from "viem";
import { SWAP_ROUTER_ABI } from "@/lib/contracts";

/**
 * Encode a Uniswap V3 exactInputSingle swap.
 * Used to convert USDC → WETH when user lacks WETH for call side.
 */
export function encodeSwapExactInput(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee,
      recipient,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: BigInt(0),
    }],
  });
}

/**
 * Compute minimum WETH output for a USDC input, with slippage protection.
 * @param amountInUsdc - USDC amount in raw units (6 decimals)
 * @param spotPrice - USD per ETH (e.g. 2045.50)
 * @param slippageBps - Slippage tolerance in basis points (e.g. 50 = 0.5%)
 * @returns Minimum WETH amount in raw units (18 decimals)
 */
export function computeMinAmountOut(
  amountInUsdc: bigint,
  spotPrice: number,
  slippageBps = 50,
): bigint {
  // expectedWeth = (amountInUsdc / 1e6) / spotPrice * 1e18
  const usdcFloat = Number(amountInUsdc) / 1e6;
  const expectedEth = usdcFloat / spotPrice;
  const expectedWei = BigInt(Math.floor(expectedEth * 1e18));
  return (expectedWei * BigInt(10000 - slippageBps)) / BigInt(10000);
}
