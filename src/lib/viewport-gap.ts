/**
 * iOS Safari / installed PWA bug: after the keyboard closes (or the toolbar changes), the layout viewport that
 * `position: fixed; bottom: 0` anchors to can stay shorter than the screen, so a bottom bar floats mid-screen
 * with blank space under it. The visual viewport still reports the real visible bottom.
 *
 * Returns how far (px) to push a fixed bottom bar down to reach the visible bottom. 0 when they agree.
 * Never negative: when the keyboard is open the bar is hidden instead of riding on top of it.
 */
export function bottomGap(layoutHeight: number, vvHeight: number, vvOffsetTop: number): number {
  const gap = Math.round(vvHeight + vvOffsetTop - layoutHeight);
  return gap > 1 ? gap : 0;
}

/** True when the visible area is much shorter than the layout (on-screen keyboard is up). */
export function keyboardOpen(layoutHeight: number, vvHeight: number): boolean {
  return layoutHeight - vvHeight > 120;
}
