import type { Position } from "./api";

const KEY = "b1nary:optimistic-positions";

export function saveOptimistic(pos: Position): void {
  const all = getAllOptimistic();
  all.push(pos);
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function getAllOptimistic(): Position[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Position[]).filter((position) =>
      Boolean(position.asset),
    );
  } catch {
    return [];
  }
}

export function removeOptimistic(id: string): void {
  const all = getAllOptimistic().filter((p) => p.id !== id);
  sessionStorage.setItem(KEY, JSON.stringify(all));
}

export function removeMatchingOptimistic(realPositions: Position[]): void {
  const all = getAllOptimistic().filter((opt) => {
    const matchingReal = realPositions.find(
      (real) =>
        real.otoken_address.toLowerCase() === opt.otoken_address.toLowerCase() &&
        real.user_address.toLowerCase() === opt.user_address.toLowerCase() &&
        Math.abs(real.amount - opt.amount) / Math.max(opt.amount, 1) < 0.01,
    );
    if (!matchingReal) return true;
    // Keep optimistic alive while the backend has the leg but no group_id
    // yet — useOptimisticPositions reads the group_id from here to patch
    // the real position so a Range stays grouped through the tag-retry
    // window.
    if (opt.group_id && !matchingReal.group_id) return true;
    return false;
  });
  sessionStorage.setItem(KEY, JSON.stringify(all));
}
