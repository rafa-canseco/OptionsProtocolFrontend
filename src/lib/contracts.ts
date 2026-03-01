import { type Address, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;

export const ADDRESSES = {
  addressBook: "0x2043b48D7Cb9ED1b983c51F805E3D364230cbAd3" as Address,
  controller: "0x5f3fAb42F74ce2455732e7d2F444ABbD6C5AAd2e" as Address,
  marginPool: "0xA1832B3bf28272Ae9F1Fa28288Bb894b47491D44" as Address,
  oTokenFactory: "0x29f897775ccFcFc7382929e0EC9580756041E4FE" as Address,
  oracle: "0x7843A0b0288DeEceCef333b8764342eA4Fc439D9" as Address,
  whitelist: "0xe188f203650425AcFF343bD64F7FF5bd8c89AB43" as Address,
  batchSettler: "0x29bb32c014aC3378FfbE335804B94cED48f2afc4" as Address,
  usdc: "0x5A2972d3390ABe3E57010272c8032BfC84E2077b" as Address, // LUSD
  weth: "0x8C259D169378B705ae62AA697F3233C8dc3774Da" as Address, // LETH
} as const;

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
if (!rpcUrl && typeof window !== "undefined") {
  console.warn("[contracts] NEXT_PUBLIC_RPC_URL is not set. Falling back to default public RPC, which may be rate-limited.");
}

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});

// Minimal ABIs — only the functions the frontend needs to call/read

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const OTOKEN_ABI = [
  {
    type: "function",
    name: "strikePrice",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "expiry",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isPut",
    inputs: [],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "underlying",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collateralAsset",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  ...ERC20_ABI,
] as const;

export const CONTROLLER_ABI = [
  {
    type: "function",
    name: "getVault",
    inputs: [
      { name: "owner", type: "address" },
      { name: "vaultId", type: "uint256" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "shortOtoken", type: "address" },
          { name: "shortAmount", type: "uint256" },
          { name: "collateralAsset", type: "address" },
          { name: "collateralAmount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vaultCount",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const BATCH_SETTLER_ABI = [
  {
    type: "function",
    name: "executeOrder",
    inputs: [
      {
        name: "quote",
        type: "tuple",
        components: [
          { name: "oToken", type: "address" },
          { name: "bidPrice", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "quoteId", type: "uint256" },
          { name: "maxAmount", type: "uint256" },
          { name: "makerNonce", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
      { name: "amount", type: "uint256" },
      { name: "collateral", type: "uint256" },
    ],
    outputs: [{ name: "vaultId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

