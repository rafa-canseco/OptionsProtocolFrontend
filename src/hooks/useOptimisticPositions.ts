"use client";

import { useState, useEffect } from "react";
import type { Position } from "@/lib/api";
import {
  getAllOptimistic,
  saveOptimistic,
  removeMatchingOptimistic,
} from "@/lib/optimisticPositions";

export function useOptimisticPositions() {
  const [optimistic, setOptimistic] = useState<Position[]>([]);

  useEffect(() => {
    setOptimistic(getAllOptimistic());
  }, []);

  function addOptimistic(pos: Position) {
    saveOptimistic(pos);
    setOptimistic(getAllOptimistic());
  }

  function removeMatching(realPositions: Position[]) {
    removeMatchingOptimistic(realPositions);
    setOptimistic(getAllOptimistic());
  }

  return { optimistic, addOptimistic, removeMatching };
}
