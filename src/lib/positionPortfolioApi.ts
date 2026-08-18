import {
  ApiError,
  api,
  type Position,
  type PositionPortfolioPageRequest,
  type PositionPortfolioPageResponse,
  type PositionPortfolioPagination,
  type PositionPortfolioSnapshotResponse,
  type PositionPortfolioStream,
  type PositionPortfolioTraversal,
  type PositionPortfolioWallet,
} from "@/lib/api";

export type PortfolioSourceKind = "account" | "wallet_batch";
export type PortfolioRoute = "account" | "wallet_batch" | "wallet_direct";

export type PortfolioSnapshot =
  | { mode: "legacy"; positions: Position[]; route: PortfolioRoute }
  | {
      mode: "bounded";
      positions: Position[];
      pagination: PositionPortfolioPagination;
      route: PortfolioRoute;
    };

export interface PortfolioPage {
  positions: Position[];
  stream: PositionPortfolioStream;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
  watermark: string;
  route: PortfolioRoute;
}

export interface PositionPortfolioSource {
  kind: PortfolioSourceKind;
  getSnapshot: (route?: PortfolioRoute) => Promise<PortfolioSnapshot>;
  getPage: (
    request: PositionPortfolioPageRequest,
    route: PortfolioRoute,
  ) => Promise<PortfolioPage>;
}

export class PositionPortfolioProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PositionPortfolioProtocolError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positionsArrayFrom(value: unknown): Position[] {
  if (!Array.isArray(value)) {
    throw new PositionPortfolioProtocolError("Portfolio response omitted positions");
  }
  if (
    value.some(
      (position) =>
        !isRecord(position) ||
        typeof position.id !== "string" ||
        position.id.length === 0 ||
        typeof position.is_settled !== "boolean",
    )
  ) {
    throw new PositionPortfolioProtocolError("Portfolio response contains an invalid row");
  }
  return value as Position[];
}

function positionsFrom(value: unknown): Position[] {
  if (!isRecord(value)) {
    throw new PositionPortfolioProtocolError("Portfolio response omitted positions");
  }
  return positionsArrayFrom(value.positions);
}

function validWatermark(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function traversalFrom(
  value: unknown,
  stream: "active" | "settled",
): PositionPortfolioTraversal {
  if (!isRecord(value)) {
    throw new PositionPortfolioProtocolError(
      `Bounded portfolio metadata omitted ${stream}`,
    );
  }
  const { limit, has_more: hasMore, next_cursor: nextCursor } = value;
  if (
    !Number.isInteger(limit) ||
    (limit as number) < 1 ||
    (limit as number) > 100 ||
    typeof hasMore !== "boolean" ||
    (nextCursor !== null && typeof nextCursor !== "string") ||
    (hasMore && (typeof nextCursor !== "string" || nextCursor.length === 0)) ||
    (!hasMore && nextCursor !== null)
  ) {
    throw new PositionPortfolioProtocolError(
      `Bounded portfolio metadata is invalid for ${stream}`,
    );
  }
  return {
    limit: limit as number,
    has_more: hasMore,
    next_cursor: nextCursor as string | null,
  };
}

export function parsePortfolioSnapshot(
  value: unknown,
  route: PortfolioRoute,
): PortfolioSnapshot {
  if (Array.isArray(value)) {
    return { mode: "legacy", positions: positionsArrayFrom(value), route };
  }
  const positions = positionsFrom(value);
  const pagination = (value as PositionPortfolioSnapshotResponse).pagination;
  if (pagination === undefined) return { mode: "legacy", positions, route };
  if (
    !isRecord(pagination) ||
    pagination.bounded !== true ||
    !validWatermark(pagination.watermark)
  ) {
    throw new PositionPortfolioProtocolError(
      "Bounded portfolio metadata is malformed",
    );
  }
  const active = traversalFrom(pagination.active, "active");
  const settled = traversalFrom(pagination.settled, "settled");
  if (
    positions.length > active.limit + settled.limit ||
    positions.filter((position) => position.is_settled).length > settled.limit ||
    positions.filter((position) => !position.is_settled).length > active.limit
  ) {
    throw new PositionPortfolioProtocolError(
      "Bounded portfolio snapshot exceeds its declared limits",
    );
  }
  return {
    mode: "bounded",
    positions,
    pagination: {
      bounded: true,
      watermark: pagination.watermark,
      active,
      settled,
    },
    route,
  };
}

const DIRECT_BOUNDED_HEADERS = [
  "X-Portfolio-Bounded",
  "X-Portfolio-Watermark",
  "X-Active-Limit",
  "X-Active-Has-More",
  "X-Active-Next-Cursor",
  "X-Settled-Limit",
  "X-Settled-Has-More",
  "X-Settled-Next-Cursor",
] as const;

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (value === null || value.length === 0) {
    throw new PositionPortfolioProtocolError(
      `Bounded direct portfolio metadata omitted ${name}`,
    );
  }
  return value;
}

function directTraversalFrom(
  headers: Headers,
  stream: "Active" | "Settled",
): PositionPortfolioTraversal {
  const limitValue = requiredHeader(headers, `X-${stream}-Limit`);
  const hasMoreValue = requiredHeader(headers, `X-${stream}-Has-More`);
  if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(limitValue)) {
    throw new PositionPortfolioProtocolError(
      `Bounded direct portfolio metadata has an invalid ${stream} limit`,
    );
  }
  if (hasMoreValue !== "true" && hasMoreValue !== "false") {
    throw new PositionPortfolioProtocolError(
      `Bounded direct portfolio metadata has an invalid ${stream} continuation flag`,
    );
  }
  const hasMore = hasMoreValue === "true";
  const nextCursor = headers.get(`X-${stream}-Next-Cursor`);
  if (
    (hasMore && (nextCursor === null || nextCursor.length === 0)) ||
    (!hasMore && nextCursor !== null)
  ) {
    throw new PositionPortfolioProtocolError(
      `Bounded direct portfolio metadata has an invalid ${stream} cursor`,
    );
  }
  return {
    limit: Number(limitValue),
    has_more: hasMore,
    next_cursor: nextCursor,
  };
}

export function parseDirectPortfolioSnapshot(
  value: unknown,
  headers: Headers,
): PortfolioSnapshot {
  const hasBoundedHeader = DIRECT_BOUNDED_HEADERS.some((name) => headers.has(name));
  if (!hasBoundedHeader) {
    return {
      mode: "legacy",
      positions: positionsArrayFrom(value),
      route: "wallet_direct",
    };
  }
  if (headers.get("X-Portfolio-Bounded") !== "true") {
    throw new PositionPortfolioProtocolError(
      "Bounded direct portfolio metadata is malformed",
    );
  }
  return parsePortfolioSnapshot(
    {
      positions: positionsArrayFrom(value),
      pagination: {
        bounded: true,
        watermark: requiredHeader(headers, "X-Portfolio-Watermark"),
        active: directTraversalFrom(headers, "Active"),
        settled: directTraversalFrom(headers, "Settled"),
      },
    },
    "wallet_direct",
  );
}

export function parsePortfolioPage(
  value: unknown,
  expectedStream: PositionPortfolioStream,
  route: PortfolioRoute,
): PortfolioPage {
  const positions = positionsFrom(value);
  if (!isRecord(value)) {
    throw new PositionPortfolioProtocolError("Portfolio page is malformed");
  }
  const { stream, limit, has_more: hasMore, next_cursor: nextCursor, watermark } =
    value as unknown as PositionPortfolioPageResponse;
  if (
    stream !== expectedStream ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    positions.length > limit ||
    typeof hasMore !== "boolean" ||
    (nextCursor !== null && typeof nextCursor !== "string") ||
    (hasMore && (typeof nextCursor !== "string" || nextCursor.length === 0)) ||
    (!hasMore && nextCursor !== null) ||
    !validWatermark(watermark)
  ) {
    throw new PositionPortfolioProtocolError("Portfolio page metadata is malformed");
  }
  return {
    positions,
    stream,
    limit,
    hasMore,
    nextCursor,
    watermark,
    route,
  };
}

function unavailableBatch(error: unknown): boolean {
  return error instanceof ApiError && [404, 405, 501].includes(error.status);
}

export function createAccountPortfolioSource(
  privyUserId: string,
): PositionPortfolioSource {
  return {
    kind: "account",
    getSnapshot: async (route = "account") => {
      if (route !== "account") {
        throw new PositionPortfolioProtocolError(
          "Account portfolio cannot use a wallet route",
        );
      }
      return parsePortfolioSnapshot(
        await api.getB1naryPositionPortfolio(privyUserId),
        route,
      );
    },
    getPage: async (request, route) => {
      if (route !== "account") {
        throw new PositionPortfolioProtocolError(
          "Account portfolio cannot continue on a wallet route",
        );
      }
      return parsePortfolioPage(
        await api.getB1naryPositionPortfolio(privyUserId, request),
        request.stream,
        route,
      );
    },
  };
}

export function createWalletPortfolioSource(
  wallets: PositionPortfolioWallet[],
): PositionPortfolioSource {
  const directWallet = wallets.length === 1 ? wallets[0] : null;

  const getDirectSnapshot = async () => {
    if (!directWallet) {
      throw new PositionPortfolioProtocolError(
        "The direct portfolio route requires exactly one wallet",
      );
    }
    const response = await api.getPositionPortfolioDirect(directWallet.address);
    return parseDirectPortfolioSnapshot(response.data, response.headers);
  };

  return {
    kind: "wallet_batch",
    getSnapshot: async (route) => {
      if (route === "account") {
        throw new PositionPortfolioProtocolError(
          "Wallet portfolio cannot use the account route",
        );
      }
      if (route === "wallet_direct") return getDirectSnapshot();
      try {
        return parsePortfolioSnapshot(
          await api.getPositionPortfolioBatch(wallets),
          "wallet_batch",
        );
      } catch (error) {
        // The direct route is a complete bounded source only for one wallet.
        // Multiple wallets must never regress to request fan-out.
        if (route === undefined && directWallet && unavailableBatch(error)) {
          return getDirectSnapshot();
        }
        if (wallets.length > 1 && unavailableBatch(error)) {
          throw new PositionPortfolioProtocolError(
            "The aggregated portfolio endpoint is required for multiple wallets",
          );
        }
        throw error;
      }
    },
    getPage: async (request, route) => {
      if (route === "wallet_direct") {
        if (!directWallet) {
          throw new PositionPortfolioProtocolError(
            "The direct portfolio route requires exactly one wallet",
          );
        }
        const response = await api.getPositionPortfolioDirect(
          directWallet.address,
          request,
        );
        return parsePortfolioPage(response.data, request.stream, route);
      }
      if (route !== "wallet_batch") {
        throw new PositionPortfolioProtocolError(
          "Wallet portfolio cannot continue on the account route",
        );
      }
      return parsePortfolioPage(
        await api.getPositionPortfolioBatch(wallets, request),
        request.stream,
        route,
      );
    },
  };
}
