"use client";

import { PriceMenu } from "@/components/PriceMenu";
import { BatchTimer } from "@/components/BatchTimer";

export default function EarnPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
      <BatchTimer />
      <PriceMenu />
    </main>
  );
}
