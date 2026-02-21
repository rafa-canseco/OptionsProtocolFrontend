"use client";

import { useCallback } from "react";

interface ShareButtonProps {
  strike?: number;
  premiumEarned?: number;
  wasAssigned?: boolean;
  className?: string;
}

function getSessionId(): string {
  try {
    const key = "b1nary_session_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function ShareButton({
  strike,
  premiumEarned,
  wasAssigned,
  className = "",
}: ShareButtonProps) {
  const handleShare = useCallback(() => {
    const parts: string[] = [];

    if (strike && premiumEarned != null) {
      const strikeStr = `$${strike.toLocaleString()}`;
      if (wasAssigned) {
        parts.push(
          `I set my price at ${strikeStr} on @b1nary_xyz. Got assigned and earned $${premiumEarned.toFixed(0)} in premium.`,
        );
      } else {
        parts.push(
          `I set my price at ${strikeStr} on @b1nary_xyz. ETH didn't drop. I earned $${premiumEarned.toFixed(0)} this week.`,
        );
      }
    } else {
      parts.push("I'm earning simulated yield on @b1nary_xyz.");
    }

    parts.push("\nTry the free simulator:");
    parts.push("https://try.b1nary.xyz/try?ref=share");

    const text = parts.join(" ");
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

    // Track share event (best-effort)
    import("@/lib/api")
      .then(({ api }) =>
        api.trackEvent({
          session_id: getSessionId(),
          event_type: "share_result",
          data: { strike, premium_earned: premiumEarned, was_assigned: wasAssigned },
        }),
      )
      .catch(() => {});

    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  }, [strike, premiumEarned, wasAssigned]);

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-full bg-[var(--surface)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="shrink-0"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share result
    </button>
  );
}
