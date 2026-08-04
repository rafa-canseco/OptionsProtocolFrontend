import type { Position, PositionPortfolioPagination } from "@/lib/api";
import type {
  PortfolioPage,
  PortfolioRoute,
} from "@/lib/positionPortfolioApi";

export type PositionPortfolioMode = "uninitialized" | "bounded" | "legacy";

export interface PositionTraversalState {
  cursor: string | null;
  hasMore: boolean;
  watermark: string | null;
  loading: boolean;
  error: string | null;
}

export interface PositionPortfolioState {
  sourceKey: string;
  mode: PositionPortfolioMode;
  initialized: boolean;
  route: PortfolioRoute | null;
  entities: Record<string, Position>;
  watermark: string | null;
  active: PositionTraversalState;
  settled: PositionTraversalState;
  deltaLoading: boolean;
  error: string | null;
}

const idleTraversal = (): PositionTraversalState => ({
  cursor: null,
  hasMore: false,
  watermark: null,
  loading: false,
  error: null,
});

export function createPositionPortfolioState(
  sourceKey: string,
): PositionPortfolioState {
  return {
    sourceKey,
    mode: "uninitialized",
    initialized: false,
    route: null,
    entities: {},
    watermark: null,
    active: idleTraversal(),
    settled: idleTraversal(),
    deltaLoading: false,
    error: null,
  };
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mergePosition(
  current: Position | undefined,
  incoming: Position,
): Position {
  if (!current) return incoming;

  const currentRevision = timestamp(current.updated_at);
  const incomingRevision = timestamp(incoming.updated_at);
  if (
    currentRevision !== null &&
    incomingRevision !== null &&
    incomingRevision < currentRevision
  ) {
    return current;
  }

  // Settlement is a one-way materialization. A delayed active page can never
  // move the entity back, including when an older server omits updated_at.
  if (current.is_settled && !incoming.is_settled) return current;

  if (
    currentRevision !== null &&
    incomingRevision !== null &&
    incomingRevision === currentRevision &&
    current.is_settled &&
    !incoming.is_settled
  ) {
    return current;
  }

  return { ...current, ...incoming };
}

export function upsertPositions(
  entities: Record<string, Position>,
  positions: Position[],
): Record<string, Position> {
  if (positions.length === 0) return entities;
  const next = { ...entities };
  for (const position of positions) {
    if (!position || typeof position.id !== "string" || !position.id) continue;
    next[position.id] = mergePosition(next[position.id], position);
  }
  return next;
}

export type PositionPortfolioAction =
  | { type: "reset"; sourceKey: string }
  | {
      type: "legacy_snapshot";
      sourceKey: string;
      positions: Position[];
      route: PortfolioRoute;
    }
  | {
      type: "bounded_snapshot";
      sourceKey: string;
      positions: Position[];
      pagination: PositionPortfolioPagination;
      route: PortfolioRoute;
    }
  | { type: "begin"; sourceKey: string; operation: "active" | "settled" | "changes" }
  | { type: "active_refresh"; sourceKey: string; positions: Position[] }
  | {
      type: "traversal_page";
      sourceKey: string;
      stream: "active" | "settled";
      page: PortfolioPage;
    }
  | { type: "changes_page"; sourceKey: string; positions: Position[] }
  | { type: "changes_complete"; sourceKey: string; watermark: string }
  | { type: "changes_paused"; sourceKey: string }
  | {
      type: "failure";
      sourceKey: string;
      operation: "initial" | "active" | "settled" | "changes";
      message: string;
    };

export function positionPortfolioReducer(
  state: PositionPortfolioState,
  action: PositionPortfolioAction,
): PositionPortfolioState {
  if (action.type === "reset") return createPositionPortfolioState(action.sourceKey);
  if (action.sourceKey !== state.sourceKey) return state;

  switch (action.type) {
    case "legacy_snapshot": {
      return {
        ...createPositionPortfolioState(state.sourceKey),
        mode: "legacy",
        initialized: true,
        route: action.route,
        entities: upsertPositions({}, action.positions),
      };
    }
    case "bounded_snapshot":
      return {
        ...state,
        mode: "bounded",
        initialized: true,
        route: action.route,
        entities: upsertPositions({}, action.positions),
        watermark: action.pagination.watermark,
        active: {
          cursor: action.pagination.active.next_cursor,
          hasMore: action.pagination.active.has_more,
          watermark: action.pagination.watermark,
          loading: false,
          error: null,
        },
        settled: {
          cursor: action.pagination.settled.next_cursor,
          hasMore: action.pagination.settled.has_more,
          watermark: action.pagination.watermark,
          loading: false,
          error: null,
        },
        deltaLoading: false,
        error: null,
      };
    case "begin":
      if (action.operation === "changes") {
        return { ...state, deltaLoading: true };
      }
      return {
        ...state,
        [action.operation]: {
          ...state[action.operation],
          loading: true,
          error: null,
        },
      };
    case "active_refresh":
      return {
        ...state,
        entities: upsertPositions(state.entities, action.positions),
        active: { ...state.active, error: null },
      };
    case "traversal_page":
      return {
        ...state,
        entities: upsertPositions(state.entities, action.page.positions),
        [action.stream]: {
          cursor: action.page.nextCursor,
          hasMore: action.page.hasMore,
          watermark: state[action.stream].watermark,
          loading: false,
          error: null,
        },
      };
    case "changes_page":
      return {
        ...state,
        entities: upsertPositions(state.entities, action.positions),
      };
    case "changes_complete":
      return {
        ...state,
        watermark: action.watermark,
        deltaLoading: false,
        error: null,
      };
    case "changes_paused":
      return { ...state, deltaLoading: false };
    case "failure": {
      if (action.operation === "active" || action.operation === "settled") {
        return {
          ...state,
          [action.operation]: {
            ...state[action.operation],
            loading: false,
            error: action.message,
          },
        };
      }
      return {
        ...state,
        initialized: action.operation === "initial" ? true : state.initialized,
        deltaLoading:
          action.operation === "changes" ? false : state.deltaLoading,
        error: action.message,
      };
    }
  }
}

function comparePositions(left: Position, right: Position): number {
  const time = timestamp(right.indexed_at) ?? 0;
  const otherTime = timestamp(left.indexed_at) ?? 0;
  return time - otherTime || right.id.localeCompare(left.id);
}

export function selectPositions(state: PositionPortfolioState): Position[] {
  return Object.values(state.entities).sort(comparePositions);
}

export function selectActivePositions(state: PositionPortfolioState): Position[] {
  return selectPositions(state).filter((position) => !position.is_settled);
}

export function selectSettledPositions(state: PositionPortfolioState): Position[] {
  return selectPositions(state).filter((position) => position.is_settled);
}
