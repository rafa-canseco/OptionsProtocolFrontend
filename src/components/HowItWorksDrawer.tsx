"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const STEPS = [
  {
    title: "Set your price.",
    body: "Pick a price you'd buy ETH at. This is your \"strike price.\" Further from current price = safer, lower premium.",
  },
  {
    title: "Get paid upfront.",
    body: "A market maker pays you a premium immediately. This money is yours no matter what. You see the exact amount before you accept.",
  },
  {
    title: "Wait for expiry.",
    body: "Capital (USDC) is locked for the duration (e.g. 7 days). Track on Positions page.",
  },
  {
    title: "Two outcomes.",
    body: "ETH stays above your price: capital back + keep premium. ETH drops to your price: you buy ETH at that price + keep premium.",
  },
] as const;

const FAQS = [
  {
    q: "What's a strike price?",
    a: "The price you agree to buy/sell ETH at. Lower = safer, lower premium. Higher = more premium, closer to current price.",
  },
  {
    q: "What's premium?",
    a: "Money paid to you upfront by the market maker. Compensation for locking capital. Yours regardless of outcome.",
  },
  {
    q: "Can I lose money?",
    a: "You always keep the premium. If ETH drops to your strike, you buy ETH at that price (which you chose). Effective cost is strike minus premium. Like a limit order that pays you to wait.",
  },
  {
    q: "Who pays the premium?",
    a: "A professional market maker. They need someone on the other side of their trade. The premium is their cost, your income.",
  },
] as const;

export function HowItWorksDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How does this work?</SheetTitle>
          <SheetDescription>
            Earn premium by setting a price you&apos;d buy ETH at.
          </SheetDescription>
        </SheetHeader>

        {/* 4-step explanation */}
        <div className="px-6 space-y-5">
          {STEPS.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex items-center justify-center size-7 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] text-sm font-bold shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--bone)]">
                  {step.title}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-[var(--border)]" />

        {/* FAQ */}
        <div className="px-6 pb-6 space-y-4">
          <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            FAQ
          </p>
          {FAQS.map((faq, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-[var(--bone)]">
                {faq.q}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
