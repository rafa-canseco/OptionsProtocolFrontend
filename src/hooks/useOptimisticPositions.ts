"use client";

import { useState, useEffect } from "react";
import type { Position } from "@/lib/api";
import {
  getAllOptimistic,
  removeMatchingOptimistic,
} from "@/lib/optimisticPositions";

/** Merges optimistic positions with real backend positions, auto-reconciling matches. */
export function useOptimisticPositions(realPositions: Position[]): Position[] {
  const [optimistic, setOptimistic] = useState<Position[]>([]);

  useEffect(() => {
    setOptimistic(getAllOptimistic());
  }, []);

  // Reconcile: remove optimistic entries the backend has now indexed
  useEffect(() => {
    if (realPositions.length > 0 && optimistic.length > 0) {
      removeMatchingOptimistic(realPositions);
      setOptimistic(getAllOptimistic());
    }
  }, [realPositions, optimistic.length]);

  // Merge: optimistic (not yet matched) first, then real positions
  // patched with any group_id the optimistic still carries — covers the
  // window between backend indexing the leg and POST /positions/group
  // tagging it, which would otherwise flicker a Range to two singles.
  const realsWithOptGroupId = realPositions.map((real) => {
    if (real.group_id) return real;
    const matchingOpt = optimistic.find(
      (o) =>
        o.group_id != null &&
        o.otoken_address.toLowerCase() === real.otoken_address.toLowerCase() &&
        o.user_address.toLowerCase() === real.user_address.toLowerCase(),
    );
    return matchingOpt?.group_id
      ? { ...real, group_id: matchingOpt.group_id }
      : real;
  });

  return [
    ...optimistic.filter(
      (o) =>
        !realPositions.some(
          (p) =>
            p.otoken_address.toLowerCase() === o.otoken_address.toLowerCase() &&
            p.user_address.toLowerCase() === o.user_address.toLowerCase(),
        ),
    ),
    ...realsWithOptGroupId,
  ];
}
