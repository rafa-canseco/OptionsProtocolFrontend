import { type Address, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;

export const ADDRESSES = {
  addressBook: "0xa183C0CBf142a2896Cb249F9305F3A6ACF3Abd79" as Address,
  controller: "0xc8279f77D96a64AC3ebe4CB83BeA845d8869843B" as Address,
  marginPool: "0x1f76058e5816BA21B9082b439e87F34402cA5792" as Address,
  oTokenFactory: "0xAce19988105D495f95F5D57b06C48094ccCaBbAf" as Address,
  oracle: "0x8dc0065c80342B5F6c830dB2f50896E15F10d022" as Address,
  whitelist: "0x3719Dd9004d8D9d303C589eC8Fd9540f30775D05" as Address,
  batchSettler: "0x7824ba774e0C45e31D3c75867be1566073bfF7A7" as Address,
  priceSheet: "0xb68C684337abC77e5C67836A1B5E4560270163CB" as Address,
  usdc: "0x96bD1505c91A162AD2b6b26faB0F2fe60b8FCFcb" as Address, // MockUSD (LUSD)
  weth: "0x94f1c230777891a669a0820b8ad125473a61AA7E" as Address, // MockETH (LETH)
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
