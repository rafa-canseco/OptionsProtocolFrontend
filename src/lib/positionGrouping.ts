import type { Position } from "@/lib/api";

export type DisplayItem =
  | { type: "single"; position: Position }
  | { type: "range"; positions: Position[]; groupId: string };

export function groupPositions(positions: Position[]): DisplayItem[] {
  const grouped = new Map<string, Position[]>();
  const ungrouped: Position[] = [];

  for (const pos of positions) {
    if (pos.group_id) {
      const existing = grouped.get(pos.group_id) || [];
      existing.push(pos);
      grouped.set(pos.group_id, existing);
    } else {
      ungrouped.push(pos);
    }
  }

  const items: DisplayItem[] = [];
  for (const [groupId, group] of grouped) {
    const hasPut = group.some((p) => p.is_put);
    const hasCall = group.some((p) => !p.is_put);
    if (hasPut && hasCall) {
      items.push({ type: "range", positions: group, groupId });
    } else {
      for (const pos of group) {
        items.push({ type: "single", position: pos });
      }
    }
  }
  for (const pos of ungrouped) {
    items.push({ type: "single", position: pos });
  }

  items.sort((a, b) => {
    const aTime =
      a.type === "range"
        ? Math.max(...a.positions.map((p) => new Date(p.indexed_at).getTime()))
        : new Date(a.position.indexed_at).getTime();
    const bTime =
      b.type === "range"
        ? Math.max(...b.positions.map((p) => new Date(p.indexed_at).getTime()))
        : new Date(b.position.indexed_at).getTime();
    return bTime - aTime;
  });

  return items;
}
