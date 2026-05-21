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
  activePositionCollateral?: number | null;
  active_position_collateral?: number | string | null;
  historicalPositionCollateral?: number | null;
  historical_position_collateral?: number | string | null;
  activePositionCount?: number | null;
  active_position_count?: number | string | null;
  totalPositionsOpened?: number | null;
  total_positions_opened?: number | string | null;
  accruedPremiums?: number | null;
  accrued_premiums?: number | string | null;
  grossPremiums?: number | null;
  gross_premiums?: number | string | null;
  protocolFees?: number | null;
  protocol_fees?: number | string | null;
  status: AgoraLifecycleStatus;
  currentEpoch: number | null;
  activationEpoch: number | null;
  claimablePremiums: number;
  userClaimablePremiums?: number | null;
  user_claimable_premiums?: number | string | null;
  vaultPremiumsCollected?: number | null;
  vault_premiums_collected?: number | string | null;
  totalPremiumsCollected?: number | null;
  total_premiums_collected?: number | string | null;
  autoCompound: boolean | null;
  selectedDeployment: string | null;
  selectedStrategy: string | null;
  updatedAt: string | null;
}

export interface AgoraHistoryItem {
  id: string;
  created_at?: string;
  createdAt: string;
  completed_at?: string | null;
  source_chain?: AgoraSourceChain;
  sourceChain: AgoraSourceChain;
  source_wallet?: string;
  sourceWallet: string;
  amount: number;
  amount_usdc?: number | string | null;
  status: AgoraLifecycleStatus;
  burn_tx_hash?: string | null;
  burnTxHash: string | null;
  arc_receive_tx_hash?: string | null;
  arcReceiveTxHash: string | null;
  finalize_tx_hash?: string | null;
  finalizeTxHash: string | null;
  destinationTx?: string | null;
  destination_tx?: string | null;
  destinationTxHash?: string | null;
  destination_tx_hash?: string | null;
  deploymentTxHash?: string | null;
  deployment_tx_hash?: string | null;
  txHash?: string | null;
  tx_hash?: string | null;
  agent_decision_hash?: string | null;
  agentDecisionHash: string | null;
  selected_quote_id?: string | null;
  selectedQuoteId: string | null;
  quote_id?: string | null;
  selected_chain?: string | null;
  selectedChain: string | null;
  selected_asset?: string | null;
  selectedAsset: string | null;
  selected_strategy?: string | null;
  selectedStrategy: string | null;
  strike?: number | string | null;
  selectedStrike?: number | string | null;
  selected_strike?: number | string | null;
  strikePrice?: number | string | null;
  strike_price?: number | string | null;
  expiry?: number | string | null;
  selectedExpiry?: number | string | null;
  selected_expiry?: number | string | null;
  expiryDate?: string | null;
  expiry_date?: string | null;
  expectedPremium?: number | string | null;
  expected_premium?: number | string | null;
  expected_premium_usdc?: number | string | null;
  grossPremium?: number | string | null;
  gross_premium?: number | string | null;
  netPremium?: number | string | null;
  net_premium?: number | string | null;
  protocolFee?: number | string | null;
  protocol_fee?: number | string | null;
  premiumAsset?: string | null;
  premium_asset?: string | null;
  premiumAssetSymbol?: string | null;
  premium_asset_symbol?: string | null;
  premiumChain?: string | null;
  premium_chain?: string | null;
  premiumLocation?: string | null;
  premium_location?: string | null;
  premiumClaimStatus?: string | null;
  premium_claim_status?: string | null;
  positionSize?: number | string | null;
  position_size?: number | string | null;
  collateral?: number | string | null;
  oTokenAddress?: string | null;
  otoken_address?: string | null;
  vaultId?: number | string | null;
  vault_id?: number | string | null;
  failure_reason?: string | null;
  failureReason: string | null;
}

export interface AgoraAgentDecision {
  id: string;
  decision_id?: string;
  createdAt: string;
  created_at?: string;
  policyProfile: "demo" | "production" | string;
  policy_profile?: "demo" | "production" | string;
  policy?: "demo" | "production" | string;
  opportunitiesEvaluated: number;
  opportunities_evaluated?: number;
  eligibleOpportunities: number;
  eligible_opportunities?: number;
  rejectionCounts: Record<string, number>;
  rejection_counts?: Record<string, number>;
  selectedChain: string | null;
  selected_chain?: string | null;
  selectedAsset: string | null;
  selected_asset?: string | null;
  selectedStrategy: string | null;
  selected_strategy?: string | null;
  quoteId: string | null;
  quote_id?: string | null;
  selectedQuoteId?: string | null;
  selected_quote_id?: string | null;
  size: number | null;
  selectedSize?: number | null;
  selected_size?: number | null;
  selected_size_usdc?: number | string | null;
  amount?: number | null;
  amount_usdc?: number | string | null;
  expectedPremium: number | null;
  expected_premium?: number | string | null;
  expected_premium_usdc?: number | string | null;
  grossPremium?: number | string | null;
  gross_premium?: number | string | null;
  netPremium?: number | string | null;
  net_premium?: number | string | null;
  protocolFee?: number | string | null;
  protocol_fee?: number | string | null;
  premiumAsset?: string | null;
  premium_asset?: string | null;
  premiumAssetSymbol?: string | null;
  premium_asset_symbol?: string | null;
  premiumChain?: string | null;
  premium_chain?: string | null;
  premiumLocation?: string | null;
  premium_location?: string | null;
  premiumClaimStatus?: string | null;
  premium_claim_status?: string | null;
  positionSize?: number | string | null;
  position_size?: number | string | null;
  collateral?: number | string | null;
  strike?: number | null;
  strikePrice?: number | null;
  strike_price?: number | null;
  expiry?: number | string | null;
  expiryDate?: string | null;
  expiry_date?: string | null;
  premiumApr?: number | null;
  premium_apr?: number | null;
  distanceToStrike?: number | null;
  distance_to_strike?: number | null;
  assignmentRisk?: number | null;
  assignment_risk?: number | null;
  score: number | null;
  decisionHash: string | null;
  decision_hash?: string | null;
  destinationTx?: string | null;
  destination_tx?: string | null;
  destinationTxHash?: string | null;
  destination_tx_hash?: string | null;
  deploymentTxHash?: string | null;
  deployment_tx_hash?: string | null;
  oTokenAddress?: string | null;
  otoken_address?: string | null;
  vaultId?: number | string | null;
  vault_id?: number | string | null;
  trace: string[];
  reasoningTrace?: string[];
  reasoning_trace?: string[];
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

export interface AgoraPreparedAction {
  chain: string;
  kind: string;
  to: string;
  data: string;
  value: string;
  description: string;
}

export interface AgoraPreparedAllocation {
  id: string;
  allocation_id?: string;
  mode: "api" | "demo";
  status: AgoraLifecycleStatus;
  sourceChain: AgoraSourceChain;
  source_chain?: AgoraSourceChain;
  sourceWallet: string;
  source_wallet?: string;
  amount: number;
  amount_raw?: string;
  circleFee?: number;
  circle_fee_usdc?: string;
  netAmount?: number;
  net_amount_usdc?: string;
  cctpFeeBps?: number;
  finalityThreshold?: number;
  receiverAddress: string | null;
  receiver?: string | null;
  metaVaultAddress: string | null;
  metavault?: string | null;
  createdAt: string;
  lifecycle: AgoraLifecycleStatus[];
  actions: AgoraPreparedAction[];
  disabled_reason: string | null;
}

export type AgoraCapitalIntentStatus =
  | "pending"
  | "deposit_received"
  | "bridging"
  | "waiting_to_be_deployed"
  | "deployment_in_flight"
  | "deployed"
  | "premium_earned"
  | "assigned_rotating"
  | "returning_to_arc"
  | "returned_to_usdc"
  | "claimable"
  | "completed"
  | "failed"
  | "retryable";

export interface AgoraCapitalIntent {
  id: string;
  intent_type: "deposit" | "deployment" | "return";
  movement_reason: string;
  receiver: string | null;
  source_chain: AgoraSourceChain;
  source_account: string;
  source_tx: string | null;
  destination_chain: "arc" | "base" | "solana";
  destination_account: string;
  destination_tx: string | null;
  amount_usdc: string;
  onchain_intent_id: string | null;
  status: AgoraCapitalIntentStatus;
  ux_status: string;
  bridge_job_id: string | null;
  arc_receive_tx_hash: string | null;
  arc_finalize_tx_hash: string | null;
  net_amount_usdc: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgoraCapitalIntentCreateResponse {
  intent: AgoraCapitalIntent;
  bridge_job_created: boolean;
}

export interface AgoraDepositIntentRequest {
  userId: string;
  sourceChain: "base";
  sourceWallet: string;
  burnTxHash: string;
  receiverAddress: string;
  metaVaultAddress: string;
  amountRaw: string;
  onchainIntentId: string;
  idempotencyKey: string;
  quoteId: string;
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
    circleFee: 0,
    circle_fee_usdc: "0",
    netAmount: request.amount,
    net_amount_usdc: String(Math.round(request.amount * 1_000_000)),
    cctpFeeBps: 0,
    finalityThreshold: undefined,
    receiverAddress: request.receiverAddress,
    metaVaultAddress: request.metaVaultAddress,
    createdAt: new Date().toISOString(),
    lifecycle: AGORA_LIFECYCLE,
    actions: [],
    disabled_reason: null,
  };
}

function normalizePreparedAllocation(
  value: AgoraPreparedAllocation,
): AgoraPreparedAllocation {
  return {
    ...value,
    id: value.id ?? value.allocation_id,
    sourceChain: value.sourceChain ?? value.source_chain,
    sourceWallet: value.sourceWallet ?? value.source_wallet,
    receiverAddress: value.receiverAddress ?? value.receiver ?? null,
    metaVaultAddress: value.metaVaultAddress ?? value.metavault ?? null,
    circleFee: value.circleFee ?? 0,
    circle_fee_usdc: value.circle_fee_usdc ?? "0",
    netAmount: value.netAmount ?? value.amount,
    net_amount_usdc:
      value.net_amount_usdc ??
      String(Math.max(0, Math.round((value.netAmount ?? value.amount) * 1_000_000))),
    cctpFeeBps: value.cctpFeeBps ?? 0,
    actions: value.actions ?? [],
    disabled_reason: value.disabled_reason ?? null,
  };
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeAgentDecision(
  value: AgoraAgentDecision,
): AgoraAgentDecision {
  return {
    ...value,
    id: value.id ?? value.decision_id ?? value.decisionHash ?? value.decision_hash ?? "latest-agent-decision",
    createdAt: value.createdAt ?? value.created_at ?? new Date().toISOString(),
    policyProfile: value.policyProfile ?? value.policy_profile ?? value.policy ?? "demo",
    opportunitiesEvaluated: value.opportunitiesEvaluated ?? value.opportunities_evaluated ?? 0,
    eligibleOpportunities: value.eligibleOpportunities ?? value.eligible_opportunities ?? 0,
    rejectionCounts: value.rejectionCounts ?? value.rejection_counts ?? {},
    selectedChain: value.selectedChain ?? value.selected_chain ?? null,
    selectedAsset: value.selectedAsset ?? value.selected_asset ?? null,
    selectedStrategy: value.selectedStrategy ?? value.selected_strategy ?? null,
    quoteId: value.quoteId ?? value.quote_id ?? value.selectedQuoteId ?? value.selected_quote_id ?? null,
    size:
      value.size ??
      value.selectedSize ??
      numberOrNull(value.selected_size) ??
      numberOrNull(value.selected_size_usdc) ??
      numberOrNull(value.amount_usdc) ??
      value.amount ??
      null,
    expectedPremium:
      value.expectedPremium ??
      numberOrNull(value.expected_premium) ??
      numberOrNull(value.expected_premium_usdc),
    grossPremium: value.grossPremium ?? numberOrNull(value.gross_premium),
    netPremium: value.netPremium ?? numberOrNull(value.net_premium),
    protocolFee: value.protocolFee ?? numberOrNull(value.protocol_fee),
    premiumAsset: value.premiumAsset ?? value.premium_asset ?? null,
    premiumAssetSymbol: value.premiumAssetSymbol ?? value.premium_asset_symbol ?? null,
    premiumChain: value.premiumChain ?? value.premium_chain ?? null,
    premiumLocation: value.premiumLocation ?? value.premium_location ?? null,
    premiumClaimStatus: value.premiumClaimStatus ?? value.premium_claim_status ?? null,
    positionSize: value.positionSize ?? numberOrNull(value.position_size),
    collateral: value.collateral ?? null,
    strike: value.strike ?? numberOrNull(value.strike_price),
    strikePrice: value.strikePrice ?? numberOrNull(value.strike_price),
    expiry: value.expiry ?? value.expiry_date ?? value.expiryDate ?? null,
    expiryDate: value.expiryDate ?? value.expiry_date ?? null,
    premiumApr: value.premiumApr ?? numberOrNull(value.premium_apr),
    distanceToStrike: value.distanceToStrike ?? numberOrNull(value.distance_to_strike),
    assignmentRisk: value.assignmentRisk ?? numberOrNull(value.assignment_risk),
    score: value.score ?? null,
    decisionHash: value.decisionHash ?? value.decision_hash ?? null,
    destinationTx:
      value.destinationTx ??
      value.destination_tx ??
      value.destinationTxHash ??
      value.destination_tx_hash ??
      value.deploymentTxHash ??
      value.deployment_tx_hash ??
      null,
    destinationTxHash:
      value.destinationTxHash ??
      value.destination_tx_hash ??
      value.destinationTx ??
      value.destination_tx ??
      value.deploymentTxHash ??
      value.deployment_tx_hash ??
      null,
    deploymentTxHash:
      value.deploymentTxHash ??
      value.deployment_tx_hash ??
      value.destinationTxHash ??
      value.destination_tx_hash ??
      value.destinationTx ??
      value.destination_tx ??
      null,
    oTokenAddress: value.oTokenAddress ?? value.otoken_address ?? null,
    vaultId: value.vaultId ?? value.vault_id ?? null,
    trace: value.trace ?? value.reasoningTrace ?? value.reasoning_trace ?? [],
  };
}

function normalizeHistoryItem(value: AgoraHistoryItem): AgoraHistoryItem {
  const deploymentTx =
    value.destinationTx ??
    value.destination_tx ??
    value.destinationTxHash ??
    value.destination_tx_hash ??
    value.deploymentTxHash ??
    value.deployment_tx_hash ??
    value.txHash ??
    value.tx_hash ??
    null;

  return {
    ...value,
    createdAt: value.createdAt ?? value.created_at ?? new Date().toISOString(),
    sourceChain: value.sourceChain ?? value.source_chain ?? "base",
    sourceWallet: value.sourceWallet ?? value.source_wallet ?? "",
    amount: value.amount ?? numberOrNull(value.amount_usdc) ?? 0,
    burnTxHash: value.burnTxHash ?? value.burn_tx_hash ?? null,
    arcReceiveTxHash: value.arcReceiveTxHash ?? value.arc_receive_tx_hash ?? null,
    finalizeTxHash: value.finalizeTxHash ?? value.finalize_tx_hash ?? null,
    destinationTx: deploymentTx,
    destinationTxHash: value.destinationTxHash ?? value.destination_tx_hash ?? deploymentTx,
    destination_tx: value.destination_tx ?? deploymentTx,
    deploymentTxHash: value.deploymentTxHash ?? value.deployment_tx_hash ?? deploymentTx,
    agentDecisionHash: value.agentDecisionHash ?? value.agent_decision_hash ?? null,
    selectedQuoteId: value.selectedQuoteId ?? value.selected_quote_id ?? value.quote_id ?? null,
    selectedChain: value.selectedChain ?? value.selected_chain ?? null,
    selectedAsset: value.selectedAsset ?? value.selected_asset ?? null,
    selectedStrategy: value.selectedStrategy ?? value.selected_strategy ?? null,
    strike:
      value.strike ??
      value.selectedStrike ??
      value.selected_strike ??
      value.strikePrice ??
      value.strike_price ??
      null,
    selectedStrike:
      value.selectedStrike ??
      value.selected_strike ??
      value.strike ??
      value.strikePrice ??
      value.strike_price ??
      null,
    expiry: value.expiry ?? value.selectedExpiry ?? value.selected_expiry ?? value.expiryDate ?? value.expiry_date ?? null,
    expiryDate: value.expiryDate ?? value.expiry_date ?? null,
    expectedPremium:
      value.expectedPremium ??
      numberOrNull(value.expected_premium) ??
      numberOrNull(value.expected_premium_usdc),
    grossPremium: value.grossPremium ?? numberOrNull(value.gross_premium),
    netPremium: value.netPremium ?? numberOrNull(value.net_premium),
    protocolFee: value.protocolFee ?? numberOrNull(value.protocol_fee),
    premiumAsset: value.premiumAsset ?? value.premium_asset ?? null,
    premiumAssetSymbol: value.premiumAssetSymbol ?? value.premium_asset_symbol ?? null,
    premiumChain: value.premiumChain ?? value.premium_chain ?? null,
    premiumLocation: value.premiumLocation ?? value.premium_location ?? null,
    premiumClaimStatus: value.premiumClaimStatus ?? value.premium_claim_status ?? null,
    positionSize: value.positionSize ?? numberOrNull(value.position_size),
    collateral: value.collateral ?? null,
    oTokenAddress: value.oTokenAddress ?? value.otoken_address ?? null,
    vaultId: value.vaultId ?? value.vault_id ?? null,
    failureReason: value.failureReason ?? value.failure_reason ?? null,
  };
}

function normalizeAgentPayload(agent: AgoraSnapshot["agent"]): AgoraSnapshot["agent"] {
  const decisions = (agent.decisions ?? []).map(normalizeAgentDecision);
  return {
    latest: agent.latest ? normalizeAgentDecision(agent.latest) : decisions[0] ?? null,
    decisions,
  };
}

function normalizeVaultState(vault: AgoraVaultState): AgoraVaultState {
  return {
    ...vault,
    claimablePremiums:
      vault.claimablePremiums ??
      numberOrNull(vault.user_claimable_premiums) ??
      vault.userClaimablePremiums ??
      0,
    userClaimablePremiums:
      vault.userClaimablePremiums ??
      numberOrNull(vault.user_claimable_premiums) ??
      vault.claimablePremiums ??
      0,
    vaultPremiumsCollected:
      vault.vaultPremiumsCollected ??
      numberOrNull(vault.vault_premiums_collected) ??
      vault.totalPremiumsCollected ??
      numberOrNull(vault.total_premiums_collected),
    totalPremiumsCollected:
      vault.totalPremiumsCollected ??
      numberOrNull(vault.total_premiums_collected) ??
      vault.vaultPremiumsCollected ??
      numberOrNull(vault.vault_premiums_collected),
    activePositionCollateral:
      vault.activePositionCollateral ??
      numberOrNull(vault.active_position_collateral),
    historicalPositionCollateral:
      vault.historicalPositionCollateral ??
      numberOrNull(vault.historical_position_collateral),
    activePositionCount:
      vault.activePositionCount ??
      numberOrNull(vault.active_position_count),
    totalPositionsOpened:
      vault.totalPositionsOpened ??
      numberOrNull(vault.total_positions_opened),
    accruedPremiums:
      vault.accruedPremiums ??
      numberOrNull(vault.accrued_premiums),
    grossPremiums:
      vault.grossPremiums ??
      numberOrNull(vault.gross_premiums),
    protocolFees:
      vault.protocolFees ??
      numberOrNull(vault.protocol_fees),
  };
}

function normalizeSnapshot(snapshot: AgoraSnapshot): AgoraSnapshot {
  return {
    ...snapshot,
    vault: normalizeVaultState(snapshot.vault),
    history: (snapshot.history ?? []).map(normalizeHistoryItem),
    agent: normalizeAgentPayload(snapshot.agent),
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

async function fetchRequired<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : detail;
    } catch {
      // Keep status message when the backend does not return JSON.
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function getAgoraSnapshot(userAddress?: string): Promise<AgoraSnapshot> {
  const query = userAddress ? `?user=${encodeURIComponent(userAddress)}` : "";
  const apiSnapshot = await fetchOptional<AgoraSnapshot>(`/agora/snapshot${query}`);
  if (apiSnapshot) return normalizeSnapshot({ ...apiSnapshot, source: "api" });

  const demo = buildDemoSnapshot();
  const [registry, vault, history, agent] = await Promise.all([
    fetchOptional<AgoraRegistry>("/agora/registry"),
    userAddress ? fetchOptional<AgoraVaultState>(`/agora/vault${query}`) : null,
    userAddress ? fetchOptional<AgoraHistoryItem[]>(`/agora/history${query}`) : null,
    fetchOptional<AgoraSnapshot["agent"]>(`/agora/agent/decisions${query}`),
  ]);

  return normalizeSnapshot({
    registry: registry ?? demo.registry,
    vault: vault ?? demo.vault,
    history: history ?? demo.history,
    agent: agent ?? demo.agent,
    source: registry || vault || history || agent ? "api" : "demo",
  });
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
  return prepared
    ? normalizePreparedAllocation(prepared)
    : buildDemoPreparedAllocation(request);
}

export async function createAgoraDepositIntent(
  request: AgoraDepositIntentRequest,
): Promise<AgoraCapitalIntentCreateResponse> {
  return fetchRequired<AgoraCapitalIntentCreateResponse>("/api/capital-intents", {
    method: "POST",
    body: JSON.stringify({
      intent_type: "deposit",
      movement_reason: "user_deposit",
      source_chain: request.sourceChain,
      source_account: request.sourceWallet,
      source_tx: request.burnTxHash,
      destination_chain: "arc",
      destination_account: request.metaVaultAddress,
      amount_usdc: request.amountRaw,
      receiver: request.receiverAddress,
      onchain_intent_id: request.onchainIntentId,
      idempotency_key: request.idempotencyKey,
      quote_id: request.quoteId,
      create_bridge_job: true,
      user_id: request.userId,
    }),
  });
}

export async function getAgoraCapitalIntent(intentId: string): Promise<AgoraCapitalIntent> {
  return fetchRequired<AgoraCapitalIntent>(`/api/capital-intents/${intentId}`);
}
