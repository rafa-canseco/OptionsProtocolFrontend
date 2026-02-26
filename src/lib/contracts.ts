import { type Address, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;

export const ADDRESSES = {
  addressBook: "0x87247F9378f966834Fc90fA38A4230d31786642f" as Address,
  controller: "0x15945776Ff184e9798BC2505129e2E4f7f404D3F" as Address,
  marginPool: "0x9193f3a8b875749d3d5e4342BB2BECb1B15dEbDf" as Address,
  oTokenFactory: "0x40A1CcA80b2E0408C72698e9a04777efe546bE0a" as Address,
  oracle: "0xea3Ae72b85C130798fdBFD23C817913cC884816f" as Address,
  whitelist: "0x43b512dA5b4938f4FE1B1Ae199Cd2324cA2478FC" as Address,
  batchSettler: "0xF87958fDE6F4D721b9C732DE79572E1937687eEF" as Address,
  usdc: "0x7fC7F74e5ED3a4ff03eDc310919779DD59D9C17A" as Address, // LUSD
  weth: "0x45f3B57231bB03Ba7213a50FBe03f1B3De71412B" as Address, // LETH
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

