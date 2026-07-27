const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type OptionType = "call" | "put";

export interface PriceQuote {
  option_type: OptionType;
  strike: number;
  expiry_days: number;
  expiry_date: string;
  premium: number;
  delta: number;
  iv: number;
  spot: number;
  ttl: number;
  expires_at: number;
  available_amount: number;
  otoken_address: string | null;
  signature: string | null;
  mm_address: string | null;
  bid_price_raw: number | null;
  deadline: number | null;
  quote_id: string | null;
  max_amount_raw: number | null;
  maker_nonce: number | null;
  position_count: number;
  chain: "base" | "solana";
}

export interface Position {
  id: string;
  tx_hash: string;
  tx_url?: string | null;
  explorer_url?: string | null;
  block_number: number;
  user_address: string;
  otoken_address: string;
  amount: number;
  premium: string;
  collateral: number;
  vault_id: number;
  /** Legacy raw strike. Base uses 8 decimals; newer APIs may also send normalized fields below. */
  strike_price: number;
  /** Normalized strike in USD, preferred when provided by the backend. */
  strike_usd?: number | null;
  /** Alias for strike_usd used by some indexer responses. */
  strike?: number | null;
  expiry: number;
  is_put: boolean;
  is_settled: boolean;
  settled_at: string | null;
  settlement_tx_hash: string | null;
  settlement_tx_url?: string | null;
  indexed_at: string;
  settlement_type: string | null;
  delivered_asset: string | null;
  delivered_amount: number | null;
  delivery_tx_hash: string | null;
  delivery_tx_url?: string | null;
  is_itm: boolean | null;
  expiry_price: number | null;
  /** Normalized settlement price in USD, preferred when provided by the backend. */
  expiry_price_usd?: number | null;
  /** Optional raw collateral decimals from the backend for chain-specific assets. */
  collateral_decimals?: number | null;
  gross_premium: string;
  net_premium: string;
  protocol_fee: string;
  outcome: string | null;
  /** Asset slug (e.g. "eth", "btc"). May be absent on older rows. */
  asset?: string;
  /** UUID linking range (put+call) pairs. Null for single-leg positions. */
  group_id?: string | null;
}

export interface SimulateResult {
  premium_earned: number;
  was_assigned: boolean;
  eth_low_of_week: number;
  eth_close: number;
  comparison: {
    hold_return: number;
    stake_return: number;
    dca_return: number;
  };
}

export interface YieldAssetSummary {
  asset: string;
  pending_raw: number;
  pending: number;
  delivered_raw: number;
  delivered: number;
  estimated_accruing_raw: number;
  estimated_accruing: number;
  total_raw: number;
  total: number;
}

export interface YieldUserSummary {
  wallet: string;
  assets: YieldAssetSummary[];
}

export interface YieldPosition {
  id: string;
  vault_id: number;
  asset: string;
  collateral_amount: number;
  deposited_at: string;
  settled_at: string | null;
  is_active: boolean;
  estimated_yield: number;
  estimated_yield_raw: number;
}

export interface YieldPositionTotal {
  asset: string;
  estimated_yield: number;
}

export interface YieldUserPositions {
  wallet: string;
  positions: YieldPosition[];
  totals: YieldPositionTotal[];
}

export interface YieldDistribution {
  id: string;
  distribution_id: string;
  asset: string;
  amount_raw: number;
  amount: number;
  status: "pending" | "delivered";
  airdrop_tx_hash: string | null;
  created_at: string;
}

export interface YieldUserHistory {
  wallet: string;
  history: YieldDistribution[];
}

export interface YieldStatsAsset {
  asset: string;
  total_yield_raw: number;
  total_yield: number;
  total_fees_raw: number;
  total_fees: number;
  total_distributed: number;
  distributions: number;
  current_accrued_raw: number;
  current_accrued: number;
}

export interface YieldStats {
  assets: YieldStatsAsset[];
}

export interface Activity {
  totalVolume: number;
  totalPremiumEarned: number;
  totalPremiumUsd: number;
  totalCollateralUsd: number;
  earningRate: number;
  positionCount: number;
  activeDays: number;
  daysSinceFirst: number;
}

export interface Capacity {
  capacity: number;
  capacity_usd: number;
  market_open: boolean;
  market_status: "active" | "degraded" | "full";
  max_position: number;
  mm_count: number;
  updated_at: string;
}

export interface SpotPrice {
  asset: string;
  spot: number;
  updated_at: number;
}

export interface AnalyticsEvent {
  session_id: string;
  event_type: string;
  data?: Record<string, unknown>;
}

export type B1naryWalletChain = "base" | "solana";
export type B1naryWalletRole = "trading" | "funding" | "login";
export type B1naryWalletType = "smart" | "embedded" | "external";

export interface B1naryAccount {
  id: string;
  username: string;
  username_normalized?: string;
  created_at: string;
  updated_at: string;
}

export interface B1naryAccountMember {
  account_id: string;
  privy_user_id: string;
  role: string;
  verified_at: string | null;
  created_at: string;
}

export interface B1naryWallet {
  id: string;
  account_id: string;
  privy_user_id: string | null;
  chain: B1naryWalletChain;
  address: string;
  address_normalized: string;
  wallet_type: B1naryWalletType;
  role: B1naryWalletRole;
  wallet_client_type: string | null;
  verification_message: string | null;
  verification_signature: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface B1naryAccountResponse {
  account: B1naryAccount | null;
  members: B1naryAccountMember[];
  wallets: B1naryWallet[];
}

export interface B1naryPositionsResponse {
  positions: Position[];
  errors: string[];
}

export interface TrustedWalletRequest {
  privyUserId: string;
  chain: B1naryWalletChain;
  address: string;
  walletType: Extract<B1naryWalletType, "smart" | "embedded">;
  role?: B1naryWalletRole;
  walletClientType?: string | null;
}

export interface TrustedMemberResponse {
  account: B1naryAccount;
  members: B1naryAccountMember[];
  wallets: B1naryWallet[];
}

// ---------------------------------------------------------------------------
// Bridge types (B1N-260 — aligned with backend relayer API)
// ---------------------------------------------------------------------------

export type BridgeJobStatus =
  | "pending"
  | "attesting"
  | "minting"
  | "trading"
  | "completed"
  | "mint_completed"
  | "failed"
  | "mint_completed_trade_failed";

export interface BridgeAndTradeRequest {
  burnTxHash: string;
  sourceChain: "base" | "solana";
  destChain: "base" | "solana";
  userId: string;
  mintRecipient: string;
  burnAmount: string;
  quoteId: string | null;
  signedTradeTx: string | null;
}

export interface BridgeAndTradeReserveRequest {
  sourceChain: "base";
  destChain: "solana";
  userId: string;
  mintRecipient: string;
  burnAmount: string;
  quoteId: string;
  signedTradeTx: string | null;
}

export interface BridgeAndTradeReserveResponse {
  job_id: string;
  status: string;
}

export interface SolanaCctpBurnPrepareRequest {
  owner: string;
  destChain: "base";
  mintRecipient: string;
  burnAmount: string;
  maxFee: string;
  minFinalityThreshold?: number;
  destinationCaller?: string | null;
}

export interface SolanaCctpBurnPrepareResponse {
  transaction_base64: string;
  message_sent_event_data: string;
  fee_payer: string;
  owner: string;
  burn_token_account: string;
  source_chain: "solana";
  dest_chain: "base";
  source_domain: number;
  destination_domain: number;
  burn_amount: string;
  max_fee: string;
  min_finality_threshold: number;
}

export interface SolanaCctpBurnSubmitRequest {
  signedTransactionBase64: string;
  destChain: "base";
  userId: string;
  mintRecipient: string;
  burnAmount: string;
  quoteId: string | null;
  signedTradeTx: string | null;
}

export interface SolanaCctpBurnSubmitResponse {
  burn_tx_hash: string;
  job_id: string;
  status: string;
}

export interface BridgeJob {
  id: string;
  status: BridgeJobStatus;
  source_chain: "base" | "solana";
  dest_chain: "base" | "solana";
  burn_tx_hash: string;
  burn_amount: string;
  mint_recipient: string;
  quote_id: string;
  mint_tx_hash: string | null;
  trade_tx_hash: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolanaSponsoredSetupRequest {
  user: string;
  otokenMint: string;
  wrapLamports: string;
  approveAmount: string;
}

export interface SolanaSponsoredSetupResponse {
  transaction: string;
  sponsor: string;
}

export interface SolanaCompleteSponsoredSetupRequest {
  user: string;
  transaction: string;
}

export interface SolanaCompleteSponsoredSetupResponse {
  signature: string;
}

// ---------------------------------------------------------------------------
// v2 tokenized CSP fund types (B1N-353)
// ---------------------------------------------------------------------------

export interface FundTokenMetadata {
  symbol: string;
  address: string;
  decimals: number;
}

export interface FundRegistryItem {
  fundKey: string;
  chainId: number;
  fundAddress: string;
  shareToken: FundTokenMetadata;
  accountingAsset: FundTokenMetadata;
  strategyKind?: "cash_secured_put" | "covered_call";
  /** Premium/settlement token when it differs from the accounting asset. */
  quoteAsset?: FundTokenMetadata | null;
  deploymentStatus: string;
}

export interface FundComposition {
  idleAssets: string;
  strategyAccountingAssets: string;
  assignedWeth: string;
  reservedClaimAssets: string;
  /** Transient USDC premium/called-away proceeds, in USDC base units. */
  transientUsdc?: string;
  /** WETH accounting-asset value of transient USDC inventory. */
  transientUsdcValueAssets?: string;
  /** Total assets before option and settlement liabilities. */
  grossAssets?: string;
  /** USDC pledged to the open CSP. This remains a fund asset. */
  lockedCollateralAssets?: string;
  /** Fair value of the European put obligation, not its collateral notional. */
  fairOptionLiabilityAssets?: string;
  /** Accounting-asset value of WETH held by, or receivable by, the fund. */
  assignedWethValueAssets?: string;
  /** Expected settlement costs included in transactional NAV. */
  settlementCostAssets?: string;
  /** Expected USDC-to-WETH normalization costs, in accounting-asset units. */
  normalizationCostAssets?: string;
  /** Expected option lifecycle exit costs, in accounting-asset units. */
  optionExitCostAssets?: string;
}

export interface FundStressSnapshot {
  netAssets?: string;
  sharePriceAssets?: string;
  liabilities?: string;
  methodology?: string | null;
}

export interface FundOptionPositionSummary {
  positionId: number;
  lifecycle: string;
  strikePriceUsd8: string | null;
  expiryTimestamp: number | null;
  optionAmount8: string;
  collateralAssets: string;
  premiumEarnedAssets: string;
}

/** @deprecated Use FundOptionPositionSummary. */
export type CspPositionSummary = FundOptionPositionSummary;

export interface FundStrategySnapshot {
  strategyKind?: "cash_secured_put" | "covered_call";
  latestPosition: FundOptionPositionSummary | null;
  totalPremiumCollectedAssets: string;
  nextOpenAfter: number | null;
  nextOpenCondition: string;
}

export interface FundNavWindow {
  reportNonce: number;
  validAfterBlock: number | null;
  validUntilBlock: number | null;
  stale: boolean;
  methodology?: string | null;
  modelVersion?: string | number | null;
  observedAt?: string | null;
  sourceQuality?: string | null;
  stress?: FundStressSnapshot | null;
}

export interface FundStatus {
  reconciled: boolean;
  depositsPaused: boolean;
  redemptionsPaused: boolean;
  executionLocked: boolean;
  flowProcessing: boolean;
}

export interface FundActionAvailability {
  available: boolean;
  reasonCode: string | null;
}

export interface FundActions {
  deposit: FundActionAvailability;
  requestRedemption: FundActionAvailability;
  cancelRedemption: FundActionAvailability;
  claimRedemption: FundActionAvailability;
}

export interface FundSummaryResponse {
  fund: FundRegistryItem;
  netAssets: string;
  shareSupply: string;
  virtualShares: string;
  /** Fair transactional NAV per share used for synchronous mint/redemption. */
  sharePriceAssets: string;
  /** Optional secondary-market quote; never used to mint fund shares. */
  marketPriceAssets?: string | null;
  /** Optional risk-only stress price; never used to mint fund shares. */
  stressPriceAssets?: string | null;
  composition: FundComposition;
  nav: FundNavWindow;
  /** Current strategy cycle. Optional while older backend versions roll out. */
  strategy?: FundStrategySnapshot;
  status: FundStatus;
  actions: FundActions;
  asOfBlock: number | null;
  asOfBlockHash: string | null;
  indexedAt: string | null;
  stale: boolean;
}

export interface FundRedemptionView {
  pendingShares: string;
  claimableShares: string;
  claimableAssets: string;
  status: string;
  nextAction: string;
  latestBatchId: number;
  latestBatchProcessing: boolean;
  latestBatchUnwindCommitted: boolean;
}

export interface FundPositionResponse {
  fundKey: string;
  address: string;
  shares: string;
  accountingValue: string;
  redemption: FundRedemptionView;
  actions: FundActions;
  asOfBlock: number | null;
  indexedAt: string | null;
  stale: boolean;
}

export interface FundTrustedContract {
  role: string;
  address: string;
  implementationAddress: string | null;
  interfaceVersion: number;
}

export interface FundConfigResponse {
  fundKey: string;
  deploymentStatus: string;
  contracts: FundTrustedContract[];
  capabilities: FundActions;
  writesEnabled: boolean;
  blockedReasonCode: string | null;
}

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  getPrices: (asset?: string) =>
    fetchAPI<PriceQuote[]>(asset ? `/prices?asset=${asset}` : "/prices"),

  getPositions: (address: string) =>
    fetchAPI<Position[]>(`/positions/${address}`),

  getFund: (fundKey: string) =>
    fetchAPI<FundSummaryResponse>(`/v2/vaults/${encodeURIComponent(fundKey)}`),

  getFundPosition: (fundKey: string, address: string) =>
    fetchAPI<FundPositionResponse>(
      `/v2/vaults/${encodeURIComponent(fundKey)}/positions/${encodeURIComponent(address)}`,
    ),

  getFundConfig: (fundKey: string) =>
    fetchAPI<FundConfigResponse>(`/v2/vaults/${encodeURIComponent(fundKey)}/config`),

  getB1naryAccount: (privyUserId: string) =>
    fetchAPI<B1naryAccountResponse>(
      `/b1nary-account?privy_user_id=${encodeURIComponent(privyUserId)}`,
    ),

  getB1naryAccountByWallet: (chain: B1naryWalletChain, address: string) =>
    fetchAPI<B1naryAccountResponse>(
      `/b1nary-account/by-wallet?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`,
    ),

  createB1naryAccount: (username: string, privyUserId: string) =>
    fetchAPI<B1naryAccountResponse>("/b1nary-accounts", {
      method: "POST",
      body: JSON.stringify({
        username,
        privy_user_id: privyUserId,
      }),
    }),

  linkTrustedB1naryWallet: (
    accountId: string,
    params: TrustedWalletRequest,
  ) =>
    fetchAPI<{ wallet: B1naryWallet }>(
      `/b1nary-accounts/${accountId}/wallets/trusted`,
      {
        method: "POST",
        body: JSON.stringify({
          privy_user_id: params.privyUserId,
          chain: params.chain,
          address: params.address,
          wallet_type: params.walletType,
          role: params.role ?? "trading",
          wallet_client_type: params.walletClientType ?? null,
        }),
      },
    ),

  addTrustedB1naryMember: (accountId: string, privyUserId: string) =>
    fetchAPI<TrustedMemberResponse>(
      `/b1nary-accounts/${accountId}/members/trusted`,
      {
        method: "POST",
        body: JSON.stringify({
          privy_user_id: privyUserId,
        }),
      },
    ),

  getB1naryPositionsByPrivyUserId: (privyUserId: string) =>
    fetchAPI<B1naryPositionsResponse>(
      `/b1nary-account/positions?privy_user_id=${encodeURIComponent(privyUserId)}`,
    ),

  joinWaitlist: (email: string) =>
    fetchAPI<{ ok: boolean; new: boolean }>("/waitlist", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  simulate: (strike: number, side: "buy" | "sell") =>
    fetchAPI<SimulateResult>(`/prices/simulate?strike=${strike}&side=${side}`),

  trackEvent: (event: AnalyticsEvent) =>
    fetchAPI<{ ok: boolean }>("/analytics/event", {
      method: "POST",
      body: JSON.stringify(event),
    }),

  getWaitlistCount: () =>
    fetchAPI<{ count: number }>("/waitlist/count"),

  getActivity: (address: string, alsoAddress?: string) =>
    fetchAPI<Activity>(
      alsoAddress
        ? `/activity/${address}?also=${alsoAddress}`
        : `/activity/${address}`,
    ),

  getCapacity: (asset?: string) =>
    fetchAPI<Capacity>(asset ? `/capacity?asset=${asset}` : "/capacity"),

  getSpot: (asset: string) =>
    fetchAPI<SpotPrice>(`/spot?asset=${asset}`),

  groupPositions: (groupId: string, txHashes: string[], userAddress: string) =>
    fetchAPI<{ grouped: number; group_id: string }>("/positions/group", {
      method: "POST",
      body: JSON.stringify({
        group_id: groupId,
        tx_hashes: txHashes,
        user_address: userAddress,
      }),
    }),

  getNotificationStatus: (wallet: string) =>
    fetchAPI<{ has_email: boolean; verified: boolean; unsubscribed: boolean }>(
      `/notifications/status?wallet=${wallet}`,
    ),

  submitEmail: (wallet: string, email: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/email", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet, email }),
    }),

  verifyCode: (wallet: string, code: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/verify", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet, code }),
    }),

  unsubscribe: (wallet: string) =>
    fetchAPI<{ ok: boolean }>("/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ wallet_address: wallet }),
    }),

  getYieldSummary: (address: string) =>
    fetchAPI<YieldUserSummary>(`/yield/user/${address}`),

  getYieldPositions: (address: string) =>
    fetchAPI<YieldUserPositions>(`/yield/user/${address}/positions`),

  getYieldHistory: (address: string) =>
    fetchAPI<YieldUserHistory>(`/yield/user/${address}/history`),

  getYieldStats: () =>
    fetchAPI<YieldStats>("/yield/stats"),

  // Bridge (B1N-260)
  reserveBridgeAndTrade: (params: BridgeAndTradeReserveRequest) =>
    fetchAPI<BridgeAndTradeReserveResponse>("/api/bridge-and-trade/reserve", {
      method: "POST",
      body: JSON.stringify({
        source_chain: params.sourceChain,
        dest_chain: params.destChain,
        user_id: params.userId,
        mint_recipient: params.mintRecipient,
        burn_amount: params.burnAmount,
        quote_id: params.quoteId,
        signed_trade_tx: params.signedTradeTx,
      }),
    }),

  bridgeAndTrade: (params: BridgeAndTradeRequest) =>
    fetchAPI<{ job_id: string; status: string }>("/api/bridge-and-trade", {
      method: "POST",
      body: JSON.stringify({
        burn_tx_hash: params.burnTxHash,
        source_chain: params.sourceChain,
        dest_chain: params.destChain,
        user_id: params.userId,
        mint_recipient: params.mintRecipient,
        burn_amount: params.burnAmount,
        quote_id: params.quoteId,
        signed_trade_tx: params.signedTradeTx,
      }),
    }),

  prepareSolanaCctpBurn: (params: SolanaCctpBurnPrepareRequest) =>
    fetchAPI<SolanaCctpBurnPrepareResponse>("/api/bridge/solana-cctp-burn/prepare", {
      method: "POST",
      body: JSON.stringify({
        owner: params.owner,
        dest_chain: params.destChain,
        mint_recipient: params.mintRecipient,
        burn_amount: params.burnAmount,
        max_fee: params.maxFee,
        min_finality_threshold: params.minFinalityThreshold ?? 2000,
        destination_caller: params.destinationCaller ?? null,
      }),
    }),

  submitSolanaCctpBurn: (params: SolanaCctpBurnSubmitRequest) =>
    fetchAPI<SolanaCctpBurnSubmitResponse>("/api/bridge/solana-cctp-burn/submit", {
      method: "POST",
      body: JSON.stringify({
        signed_transaction_base64: params.signedTransactionBase64,
        dest_chain: params.destChain,
        user_id: params.userId,
        mint_recipient: params.mintRecipient,
        burn_amount: params.burnAmount,
        quote_id: params.quoteId,
        signed_trade_tx: params.signedTradeTx,
      }),
    }),

  getBridgeStatus: (jobId: string) =>
    fetchAPI<BridgeJob>(`/api/bridge-status/${jobId}`),

  prepareSolanaSponsoredSetup: (params: SolanaSponsoredSetupRequest) =>
    fetchAPI<SolanaSponsoredSetupResponse>("/solana/sponsored-setup", {
      method: "POST",
      body: JSON.stringify({
        user: params.user,
        otoken_mint: params.otokenMint,
        wrap_lamports: params.wrapLamports,
        approve_amount: params.approveAmount,
      }),
    }),

  completeSolanaSponsoredSetup: (params: SolanaCompleteSponsoredSetupRequest) =>
    fetchAPI<SolanaCompleteSponsoredSetupResponse>("/solana/sponsored-setup/complete", {
      method: "POST",
      body: JSON.stringify({
        user: params.user,
        transaction: params.transaction,
      }),
    }),

};
