import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeFirestore } from "../stubs/fake-firestore";

// v1.0.27: a barber edits their own name/photo/mobile/email on their link. Owner-only fields are rejected. In-memory only.
const fs = fakeFirestore();
vi.mock("@/lib/firebase/admin", () => ({ adminDb: () => fs, adminAuth: () => ({}) }));
const { PATCH } = await import("@/app/api/barber/[token]/profile/route");

const TOKEN = "selfedit123";
const chairs = [
  { id: "c1", label: "Ray", barberId: "b-ray", barberName: "Raymond Diaz", locationId: "loc-demo-pacita", sharePct: 40, shareSet: true, active: true },
  { id: "c2", label: "Ray", barberId: "b-ray", barberName: "Raymond Diaz", locationId: "bayan", sharePct: 45, shareSet: true },
  { id: "c3", label: "Jun", barberId: "b-jun", barberName: "Jun", locationId: "bayan", sharePct: 50, shareSet: true },
];
const stored = () => JSON.parse(fs.store["shops/s1/private/chairs"]!.json as string) as typeof chairs & Record<string, unknown>[];
const patch = (body: unknown, token = TOKEN) => PATCH(new Request(`http://local/api/barber/${token}/profile`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ token }) } as never);

beforeEach(() => {
  for (const k of Object.keys(fs.store)) delete fs.store[k];
  fs.store[`chairLinks/${TOKEN}`] = { shopId: "s1", chairId: "c1" };
  fs.store["shops/s1"] = { name: "Bossing" };
  fs.store["shops/s1/private/chairs"] = { json: JSON.stringify(chairs) };
});

describe("barber self-edit (PATCH /api/barber/[token]/profile)", () => {
  it("saves name, mobile, email and photo on every chair of that barber only; the owner reads the same records", async () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const r = await patch({ barberName: "Ray Diaz", phone: "0917 123 4567", email: "ray@example.com", photoUrl: photo });
    expect(r.status).toBe(200);
    const s = stored();
    for (const c of s.filter((x) => x.barberId === "b-ray")) expect(c).toMatchObject({ barberName: "Ray Diaz", phone: "0917 123 4567", email: "ray@example.com", photoUrl: photo });
    expect(s.find((x) => x.id === "c3")).toEqual(chairs[2]); // another barber untouched
    expect(s.find((x) => x.id === "c1")).toMatchObject({ sharePct: 40, active: true, locationId: "loc-demo-pacita" });
  });
  it.each([[{ sharePct: 90 }], [{ active: false }], [{ locationId: "bayan" }], [{ barberName: "X", shareSet: false }], [{ menu: {} }]])("rejects owner-only field %j and changes nothing", async (body) => {
    const r = await patch(body);
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/Only the shop can change/);
    expect(stored()).toEqual(chairs);
  });
  it.each([[{ barberName: "" }], [{ phone: "call me" }], [{ email: "nope" }], [{ photoUrl: "https://evil.example/x.png" }], [{}]])("validates %j", async (body) => {
    expect((await patch(body)).status).toBe(400);
    expect(stored()).toEqual(chairs);
  });
  it("unknown or turned-off link: 404", async () => {
    expect((await patch({ barberName: "X" }, "nolink12345")).status).toBe(404);
  });
});
