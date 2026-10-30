/** v1.0.28: while a haircut is in the chair, the barber home hides Waiting + History (Jimboy). */
export const ACTIVE_STATUSES = ["in_chair"] as const;
export function showWaitingAndHistory(current: { status?: string } | null | undefined): boolean {
  return !current || !(ACTIVE_STATUSES as readonly string[]).includes(String(current.status));
}
