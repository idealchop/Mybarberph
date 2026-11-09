/**
 * Feedback summary helpers (server-side average from appStats/feedback).
 * The Install page (Shops PH v2, 2026-11-09) does not show rating/count; these remain for ops/summary math.
 */
export const APP_STATS_PLACEHOLDER = { rating: 4.8, users: "1.2k+", usersLabel: "shops" } as const;
export const REAL_STATS_MIN = 20;

export interface FeedbackSummary { count: number; sum: number }

/** Real average once enough ratings exist; else the old placeholder shape (unused by Install UI). */
export function displayStats(real?: FeedbackSummary | null) {
  if (real && real.count >= REAL_STATS_MIN) {
    const avg = Math.round((real.sum / real.count) * 10) / 10;
    return { rating: avg.toFixed(1), count: compact(real.count), countLabel: real.count === 1 ? "rating" : "ratings", real: true };
  }
  return { rating: APP_STATS_PLACEHOLDER.rating.toFixed(1), count: APP_STATS_PLACEHOLDER.users, countLabel: APP_STATS_PLACEHOLDER.usersLabel, real: false };
}

export function compact(n: number) {
  return n >= 1000 ? `${(Math.floor(n / 100) / 10).toString()}k+` : String(n);
}
