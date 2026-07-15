export type VaultPositionState =
  | "empty"
  | "pending"
  | "active"
  | "exiting"
  | "claimable-usdc"
  | "claimable-weth";

export type VaultAvailability = "open" | "coming-soon";

export type VaultId = "eth-csp" | "weth-covered-call" | "patient-wheel";

export type VaultConfig = {
  id: VaultId;
  name: string;
  description: string;
  asset: "USDC" | "WETH" | "USDC + WETH";
  icon: "usdc" | "eth" | "wheel";
  availability: VaultAvailability;
  balance: number | null;
  balanceUsd: number | null;
  totalManagedUsd: number | null;
  availableBalance: number | null;
  strategySummary: string;
  strategyFlow: readonly {
    label: string;
    detail: string;
  }[];
  strategySteps: readonly string[];
  riskNote: string;
};

export type VaultPosition = {
  state: VaultPositionState;
  activeUsd: number;
  activeShares: number;
  pendingUsd: number;
  pendingWithdrawalShares: number;
  claimableUsdc: number;
  claimableWeth: number;
};

export const VAULTS: readonly VaultConfig[] = [
  {
    id: "eth-csp",
    name: "USDC CSP",
    description: "Earn premium by selling ETH puts.",
    asset: "USDC",
    icon: "usdc",
    availability: "open",
    balance: null,
    balanceUsd: null,
    totalManagedUsd: null,
    availableBalance: null,
    strategySummary:
      "This vault uses your USDC as collateral to sell ETH put options. In plain terms, the vault gets paid for offering to buy ETH at a set price if the market moves down.",
    strategyFlow: [
      { label: "Deposit USDC", detail: "Cash backs the position." },
      { label: "Sell ETH puts", detail: "Vault earns option premium." },
      { label: "Settle cycle", detail: "Market checks the strike." },
      { label: "USDC or WETH", detail: "You keep USDC or receive WETH." },
    ],
    strategySteps: [
      "You deposit USDC into the vault.",
      "The vault sells ETH puts using that USDC as the cash backing.",
      "If ETH stays above the strike, the vault keeps the premium and your position stays in USDC.",
      "If ETH finishes below the strike, the vault may receive WETH instead of USDC.",
    ],
    riskNote:
      "Main risk: you can end up holding WETH after a down move, and the WETH may be worth less than the USDC you started with.",
  },
  {
    id: "weth-covered-call",
    name: "WETH Covered Call",
    description: "Earn premium on your WETH.",
    asset: "WETH",
    icon: "eth",
    availability: "coming-soon",
    balance: null,
    balanceUsd: null,
    totalManagedUsd: null,
    availableBalance: null,
    strategySummary:
      "This vault uses your WETH to sell ETH call options. In plain terms, the vault gets paid for agreeing to sell ETH at a set higher price if the market rallies.",
    strategyFlow: [
      { label: "Deposit WETH", detail: "ETH backs the position." },
      { label: "Sell ETH calls", detail: "Vault earns option premium." },
      { label: "Settle cycle", detail: "Market checks the strike." },
      { label: "WETH or USDC", detail: "You keep WETH or settle in USDC." },
    ],
    strategySteps: [
      "You deposit WETH into the vault.",
      "The vault sells ETH calls backed by that WETH.",
      "If ETH stays below the strike, the vault keeps the premium and your position stays in WETH.",
      "If ETH finishes above the strike, some WETH may be sold at the strike and settle as USDC.",
    ],
    riskNote:
      "Main risk: your upside is capped. If ETH rallies hard, you may miss part of the move because the vault sold calls.",
  },
  {
    id: "patient-wheel",
    name: "The Wheel",
    description: "Cycle between USDC puts and WETH calls.",
    asset: "USDC + WETH",
    icon: "wheel",
    availability: "coming-soon",
    balance: null,
    balanceUsd: null,
    totalManagedUsd: null,
    availableBalance: null,
    strategySummary:
      "The Wheel moves between the two strategies automatically: it starts from USDC puts, and if the vault receives WETH, it can switch to covered calls.",
    strategyFlow: [
      { label: "Start USDC", detail: "Sell ETH puts." },
      { label: "Receive WETH", detail: "If ETH moves below strike." },
      { label: "Sell calls", detail: "Earn premium on WETH." },
      { label: "Back to USDC", detail: "If WETH is called away." },
    ],
    strategySteps: [
      "The vault starts with USDC and sells ETH puts.",
      "If it receives WETH, it can switch to selling ETH covered calls.",
      "If WETH is called away, the vault moves back to USDC.",
      "The cycle repeats based on whether the vault is holding USDC or WETH.",
    ],
    riskNote:
      "Main risk: the strategy can lag a strong one-way ETH move because it sells options instead of simply holding spot ETH.",
  },
] as const;

export const EMPTY_VAULT_POSITION: VaultPosition = {
  state: "empty",
  activeUsd: 0,
  activeShares: 0,
  pendingUsd: 0,
  pendingWithdrawalShares: 0,
  claimableUsdc: 0,
  claimableWeth: 0,
};

export const VAULT_STATE_COPY: Record<
  VaultPositionState,
  { label: string; action: string }
> = {
  empty: { label: "Ready to deposit", action: "Start earning" },
  pending: { label: "Joining next cycle", action: "View deposit" },
  active: { label: "Earning", action: "Manage position" },
  exiting: { label: "Exit requested", action: "View exit" },
  "claimable-usdc": { label: "USDC ready", action: "Claim USDC" },
  "claimable-weth": { label: "WETH ready", action: "Claim WETH" },
};
