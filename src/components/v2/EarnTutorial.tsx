"use client";

import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface EarnTutorialProps {
  active: boolean;
  side: "buy" | "sell";
  assetSymbol: string;
  onComplete: () => void;
  onPreFill: () => void;
}

export function useEarnTutorial({
  active,
  side,
  assetSymbol,
  onComplete,
  onPreFill,
}: EarnTutorialProps) {
  const isBuy = side === "buy";

  const start = useCallback(() => {
    onPreFill();

    // Small delay so pre-filled values render before tour starts
    setTimeout(() => {
      const tour = driver({
        showProgress: true,
        animate: true,
        overlayColor: "rgba(0, 0, 0, 0.75)",
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: "b1nary-tour",
        onDestroyStarted: () => {
          tour.destroy();
          onComplete();
        },
        steps: [
          {
            element: "[data-tour='duration']",
            popover: {
              title: "Duration",
              description:
                "How long do you commit? Shorter = sooner you get your money back.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "[data-tour='amount']",
            popover: {
              title: "Amount",
              description: isBuy
                ? "How much USD do you want to put to work? You get this back if the price doesn't hit your target."
                : `How much ${assetSymbol} do you want to put to work? You get this back if the price doesn't hit your target.`,
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "[data-tour='strikes']",
            popover: {
              title: "Your price",
              description: isBuy
                ? `Pick the price you'd buy ${assetSymbol} at. Closer to market = more earnings. Further away = safer.`
                : `Pick the price you'd sell ${assetSymbol} at. Closer to market = more earnings. Further away = safer.`,
              side: "bottom",
              align: "start",
            },
          },
          {
            element: "[data-tour='outcome-otm']",
            popover: {
              title: "Outcome A",
              description: isBuy
                ? "Price didn't hit your target? Your dollars come back. You keep the earnings. Set a new price and earn again next week."
                : `Price didn't hit your target? Your ${assetSymbol} comes back. You keep the earnings. Set a new price and earn again next week.`,
              side: "left",
              align: "start",
            },
          },
          {
            element: "[data-tour='outcome-itm']",
            popover: {
              title: "Outcome B",
              description: isBuy
                ? `Price hit? You just bought ${assetSymbol} at the price you chose. You keep the earnings. Now set a sell price higher than what you paid. You earn another premium, and when you sell, you sell higher than you bought. Premiums + buy low, sell high.`
                : `Price hit? You just sold ${assetSymbol} at the price you chose. You keep the earnings. Now set a buy price lower than what you sold at. You earn another premium, and when you buy back, you buy cheaper. Premiums + sell high, buy low.`,
              side: "left",
              align: "start",
            },
          },
          {
            element: "[data-tour='accept']",
            popover: {
              title: "Accept",
              description:
                "Ready. Hit accept to start earning.",
              side: "top",
              align: "center",
            },
          },
        ],
      });

      tour.drive();
    }, 100);
  }, [isBuy, assetSymbol, onComplete, onPreFill]);

  useEffect(() => {
    if (active) {
      start();
    }
  }, [active, start]);
}
