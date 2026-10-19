/**
 * App-store style stats on the Install page (Jimboy, 2026-10-20).
 *
 * PLACEHOLDER NUMBERS: Jimboy asked for these until real feedback exists. They are not measured.
 * Once at least REAL_STATS_MIN ratings are saved (appFeedback, via /api/feedback), the page switches
 * automatically to the real average and rating count.
 */
export const APP_STATS_PLACEHOLDER = { rating: 4.8, users: "1.2k+", usersLabel: "shops" } as const;
export const REAL_STATS_MIN = 20;

export interface FeedbackSummary { count: number; sum: number }

/** What the stats row shows: real numbers once there are enough ratings, else the placeholders. */
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
