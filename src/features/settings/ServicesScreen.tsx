"use client";

import { Camera, Check, ChevronLeft, Loader2, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Input, Topbar } from "@river-apps/ui";
import { Button, Spinner } from "@/components/common/Button";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { fileToDataUrl } from "@/features/community/posts";
import { BarberPortrait } from "@/features/settings/SeatList";
import { useChairRequests } from "@/lib/chair-bookings";
import {
  chairBarberName, ensureChairLink, nextChairNumber, removeChair, saveChair, useShopChairs,
  type ShopChair,
} from "@/lib/shop-chairs";
import {
  HAIRCUT_ICONS, TREATMENT_ICONS, blankTreatment, useShopMenu,
  type ShopHaircut, type ShopTreatment,
} from "@/lib/shop-services";
import { HOME_LOCATION_ID, useShopLocations } from "@/lib/shop-locations";

type Editor =
  | { kind: "chair"; chair: ShopChair; fresh: boolean }
  | { kind: "haircut" }
  | { kind: "treatment"; treatment: ShopTreatment; fresh: boolean };

/** Haircut, the treatments the shop adds, and the chairs it has created. */
/** Services and chairs. `locationId` scopes it to one shop (Manage Shop); `embedded` drops the page header. */
export function ServicesScreen({ locationId: forLoc, embedded }: { locationId?: string; embedded?: boolean } = {}) {
  const shops = useShopLocations();
  const menu = useShopMenu(forLoc);
  const { haircut, services, saveHaircut, saveTreatment, removeTreatment, setEnabled, resetHaircut, resetTreatment, atLocation } = menu;
  const { chairs } = useShopChairs(forLoc ? { locationId: forLoc } : undefined);
  const place = forLoc ? shops.branches.find((b) => b.id === forLoc)?.name : shops.enabled ? shops.branch?.name : undefined;
  const { rows } = useChairRequests();
  const [editing, setEditing] = useState<Editor | null>(null);
  const [note, setNote] = useState("");
  const holders = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.status === "in_chair" && row.chairLabel) map[row.chairLabel] = row.customerLabel || "In use";
    }
    return map;
  }, [rows]);

  if (editing?.kind === "chair") {
    return (
      <ChairEditor
        chair={chairs.find((c) => c.id === editing.chair.id) ?? editing.chair}
        fresh={editing.fresh}
        onBack={() => setEditing(null)}
        place={place}
        onSave={(next) => {
          const error = saveChair(next);
          if (!error) {
            setNote("Saved.");
            setEditing(null);
          }
          return error;
        }}
        onRemove={() => {
          if (holders[editing.chair.label] || editing.chair.occupiedAt) {
            const error = `${editing.chair.label} is with a customer. Finish that cut before removing.`;
            setNote(error);
            return error;
          }
          const error = removeChair(editing.chair.id);
          setNote(error || "Saved.");
          if (!error) setEditing(null);
          return error;
        }}
      />
    );
  }

  if (editing?.kind === "haircut") {
    return (
      <HaircutEditor
        haircut={haircut}
        onBack={() => setEditing(null)}
        onSave={(next) => {
          saveHaircut(next);
          setNote("Saved. Walk-ins and the shop QR use this haircut.");
          setEditing(null);
        }}
      />
    );
  }

  if (editing?.kind === "treatment") {
    return (
      <TreatmentEditor
        treatment={editing.treatment}
        fresh={editing.fresh}
        onBack={() => setEditing(null)}
        onSave={(next) => {
          saveTreatment(next);
          setNote("Saved. The queue can add this service.");
          setEditing(null);
        }}
        onRemove={() => {
          removeTreatment(editing.treatment.id);
          setNote("Saved.");
          setEditing(null);
        }}
      />
    );
  }


  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6"}>
      {embedded ? <h2 className="px-1 text-[18px] font-extrabold tracking-[-0.02em]">My Barbers</h2> : <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="Services" subtitle={shops.enabled ? "Services apply to every location." : "Your haircut and the other services you sell."} />}
      {note ? <p className="mt-3 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}

      {!forLoc ? null : <section className={embedded ? "mt-2" : "mt-5"}>
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            {embedded ? null : <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">My Barbers</h2>}
            <p className="mt-1 text-[13px] font-medium text-ink-2">Each barber gets their own link to take walk-ins and finish cuts.</p>
          </div>
          <Button data-auth="action" size="sm" leadingIcon={<Plus size={15} strokeWidth={2.2} />} onClick={() => {
            const locationId = forLoc ?? shops.scopeId ?? HOME_LOCATION_ID;
            const number = nextChairNumber(locationId);
            setEditing({ kind: "chair", fresh: true, chair: { id: `c-${Date.now().toString(36)}`, number, label: `Barber ${number}`, barberId: "", barberName: "", vacantAt: Date.now(), locationId } });
          }}>Add barber</Button>
        </div>
        {chairs.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No barbers yet. Add your first barber.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {chairs.map((chair) => {
              const holder = holders[chair.label];
              const off = chair.active === false;
              return (
                <li key={chair.id} className="relative rounded-card bg-surface px-3.5 py-3.5 shadow-card">
                  <button type="button" style={{ opacity: off ? 0.55 : 1 }} onClick={() => setEditing({ kind: "chair", chair, fresh: false })} className="flex w-full min-w-0 items-center gap-3 text-left" aria-label={`Edit ${chairBarberName(chair)}`}>
                    <BarberPortrait chair={chair} size={44} />
                    <span className="min-w-0">
                      <b className="block truncate text-[16px]">{chairBarberName(chair)}</b>
                      <small className="block truncate text-[13px] font-medium text-muted">{off ? "Inactive" : holder ? `In service · ${holder}` : "Available"}{place ? ` · ${place}` : ""}</small>
                    </span>
                  </button>
                  <div className="mt-3 grid">
                    {off ? <span className="inline-flex h-9 items-center justify-center rounded-pill bg-grey-100 text-[13px] font-bold text-muted">Inactive · turn on in Performance</span> : <ShareBarberLink id={chair.id} name={chairBarberName(chair)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>}

      {forLoc ? null : <>
      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Haircut</h2>
        <div className="mt-2 flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
          <BarberIcon name={haircut.icon} size={44} title={haircut.name} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15.5px]">{haircut.name}</b>
            <small className="text-[12.5px] font-semibold text-muted">{haircut.price ? `₱${haircut.price}` : "Set a price"}{atLocation ? ` · ${SOURCE[haircut.source]}` : ""}</small>
          </span>
          {atLocation && haircut.source === "changed" ? <Button data-auth="action" size="sm" variant="secondary" onClick={resetHaircut}>Use shared</Button> : null}
          <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "haircut" })}>Edit</Button>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Other services</h2>
            <p className="mt-1 text-[13px] font-medium text-ink-2">Anything besides the haircut, like a beard trim or a hot towel.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "treatment", treatment: blankTreatment(), fresh: true })}>Add</Button>
        </div>
        {services.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No other services yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {services.map((treatment) => (
              <li key={treatment.id} className={`flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card ${treatment.enabled ? "" : "opacity-60"}`}>
                <BarberIcon name={treatment.icon} size={44} title={treatment.name} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15.5px]">{treatment.name}</b>
                  <small className="text-[12.5px] font-semibold text-muted">{treatment.price ? `₱${treatment.price}` : "Set a price"}{atLocation ? ` · ${treatment.enabled ? SOURCE[treatment.source] : "Off here"}` : ""}</small>
                </span>
                <span className="flex flex-none flex-col items-end gap-2">
                  {atLocation && treatment.source !== "local" ? (
                    <button type="button" data-auth="action" role="switch" aria-checked={treatment.enabled} aria-label={`${treatment.name} at this shop`} onClick={() => setEnabled(treatment.id, !treatment.enabled)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${treatment.enabled ? "bg-ink" : "bg-grey-200"}`}>
                      <span className={`absolute top-0.5 size-6 rounded-full bg-surface shadow transition-all ${treatment.enabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  ) : null}
                  <span className="flex gap-2">
                    {atLocation && treatment.source === "changed" ? <Button data-auth="action" size="sm" variant="secondary" onClick={() => resetTreatment(treatment.id)}>Use shared</Button> : null}
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "treatment", treatment, fresh: false })}>Edit</Button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>}
    </div>
  );
}

const SOURCE = { shared: "Shared", changed: "Changed here", local: "This shop only" } as const;

/** Outlined pill: opens the phone share sheet (or copies) with that barber's own link. */
export function ShareBarberLink({ id, name, compact = false }: { id: string; name: string; compact?: boolean }) {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <button type="button" data-auth="action" className={compact ? "inline-flex h-7 flex-none items-center justify-center gap-1 rounded-pill px-3 text-[12px] font-bold ring-1 ring-ink" : "inline-flex h-9 items-center justify-center gap-1 rounded-pill bg-ink px-3.5 text-[13px] font-bold text-on-ink"}
      disabled={pending} aria-busy={pending}
      onClick={async () => {
        setPending(true);
        const url = `${window.location.origin}${ensureChairLink(id)}`;
        try {
          if (navigator.share) await navigator.share({ title: `${name} · Barbers.ph`, text: `Your barber link, ${name}`, url });
          else { await navigator.clipboard.writeText(url); setDone(true); window.setTimeout(() => setDone(false), 1500); }
        } catch { /* share sheet closed */ } finally { setPending(false); }
      }}>
      {pending ? <Spinner size={13} /> : null}{done ? <><Check size={13} strokeWidth={3} /> Link copied</> : compact ? "Share" : "Share to barber"}
    </button>
  );
}

function Back({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="Back" onClick={onBack} className="-ml-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-ink">
        <ChevronLeft size={26} strokeWidth={1.75} />
      </button>
      <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title}</h1>
    </div>
  );
}

function IconPick({ icons, value, onChange }: { icons: typeof HAIRCUT_ICONS; value: string; onChange: (icon: typeof icons[number]) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {icons.map((icon) => (
        <button
          key={icon}
          type="button"
          aria-label={icon}
          aria-pressed={value === icon}
          onClick={() => onChange(icon)}
          className={`flex size-14 items-center justify-center rounded-[16px] ${value === icon ? "bg-ink" : "bg-surface ring-1 ring-grey-200"}`}
        >
          <BarberIcon name={icon} size={40} />
        </button>
      ))}
    </div>
  );
}

function ChairEditor({
  chair, fresh, onBack, onSave, onRemove,
}: {
  chair: ShopChair;
  fresh: boolean;
  place?: string;
  onBack: () => void;
  onSave: (next: ShopChair) => string;
  onRemove: () => string;
}) {
  const [name, setName] = useState(chair.barberName?.trim() || (fresh ? "" : chairBarberName(chair) === "No barber" ? "" : chairBarberName(chair)));
  const [photo, setPhoto] = useState(chair.photoUrl ?? "");
  const [error, setError] = useState("");
  const [up, setUp] = useState<"" | "uploading" | "done">("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose a photo."); return; }
    setUp("uploading"); setError("");
    try {
      setPhoto(await fileToDataUrl(file, 480, 0.72));
      setUp("done"); window.setTimeout(() => setUp(""), 2500);
    } catch {
      setError("Couldn’t read that photo. Try a smaller image."); setUp("");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:px-[30px] lg:pt-6">
      <Back title={fresh ? "Add barber" : "Edit barber"} onBack={onBack} />
      <div className="mt-5 flex items-end gap-3">
        <div className="flex flex-none flex-col items-center">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={up === "uploading"} aria-label={photo ? "Change photo" : "Upload photo"}
            className="relative size-[68px] rounded-full bg-grey-100 ring-1 ring-line">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={name || "Barber"} className="size-full rounded-full object-cover" />
            ) : <span className="flex size-full items-center justify-center rounded-full border-2 border-grey-300 bg-grey-100"><Camera size={24} strokeWidth={2} className="text-ink-2" /></span>}
            {up === "uploading" ? <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70" role="status" aria-label="Uploading photo"><Loader2 size={20} className="animate-spin" /></span> : null}
            {photo || up === "done" ? <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-6 items-center justify-center rounded-full bg-ink text-white ring-2 ring-surface">
              {up === "done" ? <Check size={13} strokeWidth={3} /> : <Camera size={13} strokeWidth={2.2} />}
            </span> : null}
          </button>
          <span className="mt-1 h-4 text-[11px] font-bold" role="status">{up === "uploading" ? "Uploading…" : up === "done" ? "Uploaded" : ""}</span>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
        </div>
        <div className="mb-5 min-w-0 flex-1">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Barber’s name" />
        </div>
      </div>
      {photo ? <button type="button" className="text-[12.5px] font-bold text-muted underline underline-offset-2" onClick={() => setPhoto("")}>Remove photo</button> : null}
      {error ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}
      <Button data-auth="action" className="mt-6" fullWidth disabled={up === "uploading"} onClick={() => {
        const error = onSave({ ...chair, barberName: name.trim(), photoUrl: photo || undefined });
        if (error) setError(error);
      }}>Save</Button>
      {fresh ? null : <Button data-auth="action" className="mt-2" fullWidth variant="secondary" onClick={() => {
        const error = onRemove();
        if (error) setError(error);
      }}>Remove barber</Button>}
    </div>
  );
}

function HaircutEditor({ haircut, onBack, onSave }: { haircut: ShopHaircut; onBack: () => void; onSave: (next: ShopHaircut) => void }) {
  const [draft, setDraft] = useState(haircut);
  const [price, setPrice] = useState(haircut.price ? String(haircut.price) : "");

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:px-[30px] lg:pt-6">
      <Back title="Edit haircut" onBack={onBack} />
      <p className="mt-1 pl-11 text-[14px] font-medium text-muted">One haircut for the shop. Other services are added separately.</p>
      <p className="mt-5 text-[13px] font-bold">Icon</p>
      <IconPick icons={HAIRCUT_ICONS} value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      <div className="mt-4 flex flex-col gap-3">
        <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input label="Price (₱)" inputMode="numeric" value={price} placeholder="e.g. 250" onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <Button data-auth="action" className="mt-6" fullWidth onClick={() => {
        if (!draft.name.trim()) return;
        // Duration isn't asked; the internal default keeps time slots working.
        onSave({ ...draft, name: draft.name.trim(), durationMins: draft.durationMins || 30, price: Math.max(0, Math.round(Number(price) || 0)) });
      }}>Save</Button>
    </div>
  );
}

function TreatmentEditor({
  treatment, fresh, onBack, onSave, onRemove,
}: {
  treatment: ShopTreatment;
  fresh: boolean;
  onBack: () => void;
  onSave: (next: ShopTreatment) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(treatment);
  const [price, setPrice] = useState(treatment.price ? String(treatment.price) : "");

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:px-[30px] lg:pt-6">
      <Back title={fresh ? "Add a service" : "Edit service"} onBack={onBack} />
      <p className="mt-1 pl-11 text-[14px] font-medium text-muted">This sits with the haircut. Save to keep it.</p>
      <p className="mt-5 text-[13px] font-bold">Icon</p>
      <IconPick icons={TREATMENT_ICONS} value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      <div className="mt-4 flex flex-col gap-3">
        <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input label="Price (₱)" inputMode="numeric" value={price} placeholder="e.g. 250" onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <Button data-auth="action" className="mt-6" fullWidth onClick={() => {
        if (!draft.name.trim()) return;
        // Duration isn't asked; the internal default keeps time slots working.
        onSave({ ...draft, name: draft.name.trim(), durationMins: draft.durationMins || 30, price: Math.max(0, Math.round(Number(price) || 0)) });
      }}>Save</Button>
      {fresh ? null : <Button data-auth="action" className="mt-2" fullWidth variant="secondary" onClick={onRemove}>Remove service</Button>}
    </div>
  );
}
