import { type Address, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;

export const ADDRESSES = {
  addressBook: "0x485d560DC8f985215E6E2d4e97F1151769E0802d" as Address,
  controller: "0xa310adf4F16097d36404840bb9008e05C93B8255" as Address,
  marginPool: "0x152a8C67c012272B405814e4b7A6B31204f55Ed5" as Address,
  oTokenFactory: "0xb4c1Dc56b7A241a06E601882B688c8c358DFB8B3" as Address,
  oracle: "0x71CB8C75F3F197716c94eBd786C13304bC3974a9" as Address,
  whitelist: "0x34e762Dc0d32892FB1237fcFC7A1caDd02703584" as Address,
  batchSettler: "0x2C49E77E6E97E15f2Df31cF5E404702589eD2cA3" as Address,
  priceSheet: "0x92E3072bc36DAe82203fa1fA94E26d13a404D50E" as Address,
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address,
  weth: "0x4200000000000000000000000000000000000006" as Address,
} as const;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
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
      { name: "oToken", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "collateral", type: "uint256" },
    ],
    outputs: [{ name: "vaultId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export const PRICE_SHEET_ABI = [
  {
    type: "function",
    name: "getQuote",
    inputs: [{ name: "oToken", type: "address" }],
    outputs: [
      { name: "bidPrice", type: "uint256" },
      { name: "askPrice", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
      { name: "filledAmount", type: "uint256" },
      { name: "isValid", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;
