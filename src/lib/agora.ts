const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type AgoraSourceChain = "base" | "solana";

export type AgoraLifecycleStatus =
  | "allocation_created"
  | "smart_wallet_approval_burn"
  | "attesting"
  | "minting_on_arc"
  | "finalize_bridge_deposit"
  | "waiting_to_be_deployed"
  | "deployed"
  | "assigned"
  | "claimable"
  | "failed"
  | "retryable";

export interface AgoraRegistry {
  arcChain: string;
  metaVaultAddress: string | null;
  receiverAddress: string | null;
  basePathReady: boolean;
  solanaPathReady: boolean;
  demoMode: boolean;
}

export interface AgoraVaultState {
  totalAllocated: number;
  netCredited: number;
  pendingShares: number;
  activeShares: number;
  status: AgoraLifecycleStatus;
  currentEpoch: number | null;
  activationEpoch: number | null;
  claimablePremiums: number;
  autoCompound: boolean | null;
  selectedDeployment: string | null;
  selectedStrategy: string | null;
  updatedAt: string | null;
}

export interface AgoraHistoryItem {
  id: string;
  createdAt: string;
  sourceChain: AgoraSourceChain;
  sourceWallet: string;
  amount: number;
  status: AgoraLifecycleStatus;
  burnTxHash: string | null;
  arcReceiveTxHash: string | null;
  finalizeTxHash: string | null;
  agentDecisionHash: string | null;
  selectedQuoteId: string | null;
  selectedChain: string | null;
  selectedAsset: string | null;
  selectedStrategy: string | null;
  failureReason: string | null;
}

export interface AgoraAgentDecision {
  id: string;
  createdAt: string;
  policyProfile: "demo" | "production" | string;
  opportunitiesEvaluated: number;
  eligibleOpportunities: number;
  rejectionCounts: Record<string, number>;
  selectedChain: string | null;
  selectedAsset: string | null;
  selectedStrategy: string | null;
  quoteId: string | null;
  size: number | null;
  expectedPremium: number | null;
  score: number | null;
  decisionHash: string | null;
  trace: string[];
}

export interface AgoraSnapshot {
  registry: AgoraRegistry;
  vault: AgoraVaultState;
  history: AgoraHistoryItem[];
  agent: {
    latest: AgoraAgentDecision | null;
    decisions: AgoraAgentDecision[];
  };
  source: "api" | "demo";
}

export interface AgoraAllocationRequest {
  userId: string | null;
  sourceChain: AgoraSourceChain;
  sourceWallet: string;
  amount: number;
  receiverAddress: string | null;
  metaVaultAddress: string | null;
}

export interface AgoraPreparedAllocation {
  id: string;
  mode: "api" | "demo";
  status: AgoraLifecycleStatus;
  sourceChain: AgoraSourceChain;
  sourceWallet: string;
  amount: number;
  receiverAddress: string | null;
  metaVaultAddress: string | null;
  createdAt: string;
  lifecycle: AgoraLifecycleStatus[];
}

export const AGORA_LIFECYCLE: AgoraLifecycleStatus[] = [
  "allocation_created",
  "smart_wallet_approval_burn",
  "attesting",
  "minting_on_arc",
  "finalize_bridge_deposit",
  "waiting_to_be_deployed",
];

export function agoraStatusLabel(status: AgoraLifecycleStatus): string {
  switch (status) {
    case "allocation_created":
      return "Allocation created";
    case "smart_wallet_approval_burn":
      return "Smart wallet approval / burn";
    case "attesting":
      return "Circle attesting";
    case "minting_on_arc":
      return "Minting on Arc";
    case "finalize_bridge_deposit":
      return "MetaVault finalizing";
    case "waiting_to_be_deployed":
      return "Waiting to be deployed";
    case "deployed":
      return "Deployed";
    case "assigned":
      return "Assigned";
    case "claimable":
      return "Claimable";
    case "failed":
      return "Failed";
    case "retryable":
      return "Retryable";
  }
}

export function buildDemoRegistry(): AgoraRegistry {
  return {
    arcChain: "Arc Testnet",
    metaVaultAddress: process.env.NEXT_PUBLIC_ARC_METAVAULT_ADDRESS ?? null,
    receiverAddress: process.env.NEXT_PUBLIC_ARC_RECEIVER_ADDRESS ?? null,
    basePathReady: true,
    solanaPathReady: process.env.NEXT_PUBLIC_AGORA_SOLANA_READY === "true",
    demoMode: true,
  };
}

export function buildDemoSnapshot(): AgoraSnapshot {
  const registry = buildDemoRegistry();
  const latestDecision: AgoraAgentDecision = {
    id: "demo-decision-latest",
    createdAt: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    policyProfile: "demo",
    opportunitiesEvaluated: 18,
    eligibleOpportunities: 4,
    rejectionCounts: {
      stale_quote: 5,
      low_premium: 6,
      chain_disabled: 3,
    },
    selectedChain: "Base",
    selectedAsset: "ETH",
    selectedStrategy: "Patient wheel put allocation",
    quoteId: "demo-eth-put-arc-01",
    size: 500,
    expectedPremium: 8.4,
    score: 0.82,
    decisionHash: "0xdemo6f2a9c4b7e1d3",
    trace: [
      "Scanned active b1nary quotes across enabled chains.",
      "Rejected stale or under-collateralized opportunities.",
      "Selected the highest score allocation that keeps vault liquidity available.",
    ],
  };

  return {
    registry,
    vault: {
      totalAllocated: 0,
      netCredited: 0,
      pendingShares: 0,
      activeShares: 0,
      status: "waiting_to_be_deployed",
      currentEpoch: 2,
      activationEpoch: 3,
      claimablePremiums: 0,
      autoCompound: true,
      selectedDeployment: "Agent-managed Patient Wheel MetaVault",
      selectedStrategy: latestDecision.selectedStrategy,
      updatedAt: new Date().toISOString(),
    },
    history: [],
    agent: {
      latest: latestDecision,
      decisions: [latestDecision],
    },
    source: "demo",
  };
}

export function buildDemoPreparedAllocation(
  request: AgoraAllocationRequest,
): AgoraPreparedAllocation {
  const idParts = [
    "prepared",
    request.sourceChain,
    request.sourceWallet.slice(0, 6),
    Math.round(request.amount * 1_000_000).toString(16),
  ];
  return {
    id: idParts.join("-"),
    mode: "demo",
    status: "allocation_created",
    sourceChain: request.sourceChain,
    sourceWallet: request.sourceWallet,
    amount: request.amount,
    receiverAddress: request.receiverAddress,
    metaVaultAddress: request.metaVaultAddress,
    createdAt: new Date().toISOString(),
    lifecycle: AGORA_LIFECYCLE,
  };
}

async function fetchOptional<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getAgoraSnapshot(userAddress?: string): Promise<AgoraSnapshot> {
  const query = userAddress ? `?user=${encodeURIComponent(userAddress)}` : "";
  const apiSnapshot = await fetchOptional<AgoraSnapshot>(`/agora/snapshot${query}`);
  if (apiSnapshot) return { ...apiSnapshot, source: "api" };

  const demo = buildDemoSnapshot();
  const [registry, vault, history, agent] = await Promise.all([
    fetchOptional<AgoraRegistry>("/agora/registry"),
    userAddress ? fetchOptional<AgoraVaultState>(`/agora/vault${query}`) : null,
    userAddress ? fetchOptional<AgoraHistoryItem[]>(`/agora/history${query}`) : null,
    fetchOptional<AgoraSnapshot["agent"]>(`/agora/agent/decisions${query}`),
  ]);

  return {
    registry: registry ?? demo.registry,
    vault: vault ?? demo.vault,
    history: history ?? demo.history,
    agent: agent ?? demo.agent,
    source: registry || vault || history || agent ? "api" : "demo",
  };
}

export async function prepareAgoraAllocation(
  request: AgoraAllocationRequest,
): Promise<AgoraPreparedAllocation> {
  const prepared = await fetchOptional<AgoraPreparedAllocation>(
    "/agora/allocations/prepare",
    {
      method: "POST",
      body: JSON.stringify({
        user_id: request.userId,
        source_chain: request.sourceChain,
        source_wallet: request.sourceWallet,
        amount: request.amount,
        receiver_address: request.receiverAddress,
        metavault_address: request.metaVaultAddress,
      }),
    },
  );
  return prepared ?? buildDemoPreparedAllocation(request);
}
