/**
 * v1.0.35 (Jimboy): when the OWNER adds a walk-in or a record at a location, it goes to a barber chosen from the
 * active barbers there (their share link). One barber there: assigned automatically, no question. None: say so.
 */
import { chairBarberName, type ShopChair } from "@/lib/shop-chairs";

const HOME = "home";
export type OwnerBarber = { id: string; barberId: string; name: string; label: string; locationId: string };
export type OwnerBarberChoice = { kind: "none" } | { kind: "auto"; barber: OwnerBarber } | { kind: "pick"; barbers: OwnerBarber[] };

/** Active barbers at this location: turned on, with a barber set up, one entry per barber. */
export function activeBarbersAt(chairs: Pick<ShopChair, "id" | "label" | "barberId" | "barberName" | "locationId" | "active">[], locationId: string): OwnerBarber[] {
  const seen = new Set<string>();
  const out: OwnerBarber[] = [];
  for (const c of chairs) {
    if (c.active === false || (c.locationId || HOME) !== (locationId || HOME)) continue;
    if (!c.barberId && !c.barberName?.trim()) continue; // no barber set up yet
    const barberId = c.barberId || c.id;
    if (seen.has(barberId)) continue;
    seen.add(barberId);
    out.push({ id: c.id, barberId, name: chairBarberName(c), label: c.label, locationId: c.locationId || HOME });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function ownerBarberChoice(barbers: OwnerBarber[]): OwnerBarberChoice {
  if (!barbers.length) return { kind: "none" };
  if (barbers.length === 1) return { kind: "auto", barber: barbers[0]! };
  return { kind: "pick", barbers };
}

/** The barber to save under: the only one, else the owner's pick (must be one of the list), else null. */
export function resolveOwnerBarber(choice: OwnerBarberChoice, pickedBarberId: string): OwnerBarber | null {
  if (choice.kind === "auto") return choice.barber;
  if (choice.kind === "pick") return choice.barbers.find((b) => b.barberId === pickedBarberId) ?? null;
  return null;
}

export const NO_BARBER_MESSAGE = "No active barbers at this location yet. Add a barber in Services and share their link first.";
export const PICK_BARBER_MESSAGE = "Pick the barber who did this haircut.";
