const DAY_MS = 86_400_000;

function localDateMs(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

function expiryDate(expiryTimestamp: number): Date {
  const expiry = new Date(expiryTimestamp * 1000);
  return new Date(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );
}

export function getPositionOpenedDate(indexedAt: string): Date {
  return new Date(indexedAt);
}

export function getPositionExpiryDate(expiryTimestamp: number): Date {
  return expiryDate(expiryTimestamp);
}

export function getPositionTermDays(
  indexedAt: string,
  expiryTimestamp: number,
): number {
  const opened = getPositionOpenedDate(indexedAt);
  const expiry = getPositionExpiryDate(expiryTimestamp);
  return Math.max(1, Math.round((localDateMs(expiry) - localDateMs(opened)) / DAY_MS));
}

export function formatPositionDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatPositionTerm(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
