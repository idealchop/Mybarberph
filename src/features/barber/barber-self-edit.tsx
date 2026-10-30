"use client";
import { Camera, ChevronLeft, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/common/button";
import { fileToDataUrl } from "@/features/community";
import { saveBarberSelf, useCloud } from "@/lib/cloud";

type Chair = { id: string; barberId?: string; barberName?: string; photoUrl?: string; phone?: string; email?: string; sharePct?: number | null; shareSet?: boolean; active?: boolean; locationId?: string };

/**
 * The barber edits their OWN details on their link (v1.0.27): name, photo, mobile, email.
 * Share %, Active, location and the services menu are the owner's; shown read-only here.
 */
export function BarberSelfEdit({ place, onBack }: { place?: string; onBack: () => void }) {
  const cloud = useCloud();
  const chairs = (() => { try { return JSON.parse(cloud.values["barbers.shop-chairs"] || "[]") as Chair[]; } catch { return [] as Chair[]; } })();
  const me = chairs.find((c) => c.id === cloud.chairId);
  const [name, setName] = useState(me?.barberName ?? "");
  const [phone, setPhone] = useState(me?.phone ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [photo, setPhoto] = useState(me?.photoUrl ?? "");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);
  const pct = me?.shareSet || (me?.sharePct != null && me.sharePct !== 50) ? me?.sharePct : null;

  const pick = async (f?: File) => {
    if (!f) return;
    try { setPhoto(await fileToDataUrl(f, 480, 0.8)); setErr(""); } catch { setErr("Couldn’t read that photo."); }
  };
  const save = async () => {
    setErr(""); setSaved(false);
    const patch: Record<string, string> = {};
    if (name.trim() !== (me?.barberName ?? "")) patch.barberName = name.trim();
    if (phone.trim() !== (me?.phone ?? "")) patch.phone = phone.trim();
    if (email.trim() !== (me?.email ?? "")) patch.email = email.trim();
    if (photo !== (me?.photoUrl ?? "")) patch.photoUrl = photo;
    if (!Object.keys(patch).length) { onBack(); return; }
    try { await saveBarberSelf(patch); setSaved(true); window.setTimeout(onBack, 600); } catch (e) { setErr((e as Error).message || "Couldn’t save."); }
  };

  const field = "mt-1 h-12 w-full rounded-[14px] bg-grey-100 px-3.5 text-[15px] font-semibold text-ink outline-none focus:ring-2 focus:ring-ink";
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[402px] bg-canvas px-4 pb-10 pt-6 lg:max-w-[560px]">
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink"><ChevronLeft size={26} strokeWidth={1.75} /></button>
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]">My profile</h1>
      </div>
      <section className="mt-4 flex flex-col items-center rounded-card bg-surface px-4 py-5 shadow-card">
        <label className="relative cursor-pointer">
          <span className="block size-24 overflow-hidden rounded-full bg-grey-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-[30px] font-extrabold text-muted">{(name || "B").slice(0, 1).toUpperCase()}</span>}
          </span>
          <span className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full bg-ink text-on-ink shadow-card"><Camera size={17} aria-hidden /></span>
          <input type="file" accept="image/*" className="sr-only" aria-label="Change photo" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        {photo ? <button type="button" onClick={() => setPhoto("")} className="mt-2 text-[12.5px] font-bold text-muted">Remove photo</button> : null}
      </section>
      <section className="mt-3 rounded-card bg-surface px-4 py-4 shadow-card">
        <label className="block text-[12.5px] font-bold text-muted">Display name<input className={field} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        <label className="mt-3 block text-[12.5px] font-bold text-muted">Mobile<input className={field} value={phone} inputMode="tel" placeholder="09XX XXX XXXX" onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></label>
        <label className="mt-3 block text-[12.5px] font-bold text-muted">Email<input className={field} value={email} inputMode="email" placeholder="you@email.com" onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      </section>
      <section aria-label="Set by the shop" className="mt-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
        <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-muted"><Lock size={13} aria-hidden />Set by the shop</p>
        <dl className="mt-2 grid grid-cols-2 gap-y-2 text-[13.5px] font-semibold">
          <dt className="text-muted">Your share</dt><dd className="text-right tabular-nums">{pct == null ? "Not set" : `${pct}%`}</dd>
          <dt className="text-muted">Location</dt><dd className="truncate text-right">{place || "Main"}</dd>
          <dt className="text-muted">Status</dt><dd className="text-right">{me?.active === false ? "Off" : "Active"}</dd>
        </dl>
        <p className="mt-2 text-[12px] font-medium text-muted">Ask the owner to change these or the prices.</p>
      </section>
      {err ? <p role="alert" className="mt-3 text-[13px] font-semibold text-[#B42318]">{err}</p> : null}
      <div className="mt-5 flex flex-col gap-1">
        <Button fullWidth onClick={save} disabled={!name.trim()}>{saved ? "Saved" : "Save"}</Button>
        <Button variant="ghost" fullWidth onClick={onBack}>Cancel</Button>
      </div>
    </main>
  );
}
