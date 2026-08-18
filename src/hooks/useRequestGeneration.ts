"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

type RequestGeneration = {
  capture: () => number;
  isCurrent: (generation: number) => boolean;
};

/** Prevent an obsolete async request from publishing state after its key changes. */
export function useRequestGeneration(key: string): RequestGeneration {
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    return () => {
      if (generationRef.current === generation) {
        generationRef.current += 1;
      }
    };
  }, [key]);

  const capture = useCallback(() => generationRef.current, []);
  const isCurrent = useCallback(
    (generation: number) => generationRef.current === generation,
    [],
  );
  return useMemo(() => ({ capture, isCurrent }), [capture, isCurrent]);
}
