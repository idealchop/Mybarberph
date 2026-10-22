/** Services Add more can offer: everything on the menu that isn't already selected. */
export function addableServices<T extends { id: string }>(menu: T[], selectedIds: string[]): T[] {
  const s = new Set(selectedIds);
  return menu.filter((m) => !s.has(m.id));
}
