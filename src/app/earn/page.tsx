"use client";

import { PriceMenuV2 } from "@/components/v2/PriceMenuV2";
import { ActivitySection } from "@/components/ActivitySection";

export default function EarnPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
      <h1 className="sr-only">Earn Premium</h1>
      <ActivitySection />
      <PriceMenuV2 />
    </main>
  );
}
