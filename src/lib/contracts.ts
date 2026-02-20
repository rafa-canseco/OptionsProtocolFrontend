import { type Address, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const CHAIN = baseSepolia;

export const ADDRESSES = {
  addressBook: "0x2530248C7F5fD76edCA8706225747cD914bD5Bc7" as Address,
  controller: "0x54Dd9eBF1eC5D1a9DFd66bF84e23bA7b097C4cfe" as Address,
  marginPool: "0xDBF9BD7b51287DF4C04375e6299F4A1713FD2155" as Address,
  oTokenFactory: "0x235B51B00Ea8C989D10537CBd4A27E315d4aA0F2" as Address,
  oracle: "0xA4d4D2ac1b14E1031F8ae16553Df95C20C9cAfe0" as Address,
  whitelist: "0x510A4CC3d9BFf05d6BcBc05c26cBcE8Ab6ee7d20" as Address,
  batchSettler: "0x409f4C0c8b91FeaE64F54617481668e9d8cFb658" as Address,
  priceSheet: "0xE26ECA2365E0eb56099ef04984B22c1049434C43" as Address,
  usdc: "0xDa97d8aec7aAD92F9Cba114Abd97a259FdCBC0e3" as Address, // MockUSD (LUSD)
  weth: "0x931927a1B911D72862518e0Ea3815D335df87919" as Address, // MockETH (LETH)
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
