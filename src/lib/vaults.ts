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
  icon: "usdc" | "weth" | "wheel";
  availability: VaultAvailability;
  apy: number | null;
  earningsUsd: number;
  balance: number;
  balanceUsd: number;
  totalManagedUsd: number;
  availableBalance: number;
  strategySteps: readonly string[];
  riskNote: string;
};

export type VaultPosition = {
  state: VaultPositionState;
  activeUsd: number;
  pendingUsd: number;
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
    apy: 7.68,
    earningsUsd: 0,
    balance: 0,
    balanceUsd: 0,
    totalManagedUsd: 39_013_196,
    availableBalance: 12_450,
    strategySteps: [
      "Deposit USDC",
      "The vault sells cash-secured ETH puts",
      "Receive USDC or WETH after settlement",
    ],
    riskNote:
      "If ETH settles below the strike, the vault may receive WETH. Returns are not guaranteed.",
  },
  {
    id: "weth-covered-call",
    name: "WETH Covered Call",
    description: "Earn premium on your WETH.",
    asset: "WETH",
    icon: "weth",
    availability: "open",
    apy: 5.84,
    earningsUsd: 0,
    balance: 0,
    balanceUsd: 0,
    totalManagedUsd: 0,
    availableBalance: 0,
    strategySteps: [
      "Deposit WETH",
      "The vault sells covered ETH calls",
      "Receive WETH or USDC after settlement",
    ],
    riskNote:
      "If ETH settles above the strike, the position may be called away and settle in USDC.",
  },
  {
    id: "patient-wheel",
    name: "The Wheel",
    description: "Cycle between USDC puts and WETH calls.",
    asset: "USDC + WETH",
    icon: "wheel",
    availability: "coming-soon",
    apy: null,
    earningsUsd: 0,
    balance: 0,
    balanceUsd: 0,
    totalManagedUsd: 0,
    availableBalance: 0,
    strategySteps: [
      "Start with USDC cash-secured puts",
      "Switch to covered calls after assignment",
      "Repeat as assets move between USDC and WETH",
    ],
    riskNote:
      "The strategy can alternate assets after assignment and may underperform simply holding ETH.",
  },
] as const;

export const EMPTY_VAULT_POSITION: VaultPosition = {
  state: "empty",
  activeUsd: 0,
  pendingUsd: 0,
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
