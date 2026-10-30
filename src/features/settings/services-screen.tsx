"use client";

import { Camera, Check, ChevronLeft, Loader2, Plus, Pencil } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Input, Topbar } from "@river-apps/ui";
import { Button, Spinner } from "@/components/common/button";
import { BarberIcon } from "@/components/art";
import { HomeServiceCard, HomeToggle } from "@/features/settings/home-service-card";
import { LinkReviewList } from "./link-review";
import { PayQrSettings } from "./pay-qr-settings";
import { PageBack } from "@/components/shell/page-back";
import { fileToDataUrl } from "@/features/community";
import { BarberPortrait } from "@/features/settings/seat-list";
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
import { shareLabel, sharePct } from "@/lib/income-split";
import { priceSummary } from "@/lib/location-prices";
import { LocationPriceInputs, useLocationDraft } from "./location-prices";
import { BarberProfile } from "./barber-profile";
import { FullScreen } from "@/components/shell/full-screen";

type Editor =
  | { kind: "chair"; chair: ShopChair; fresh: boolean }
  | { kind: "profile"; chairId: string }
  | { kind: "haircut" }
  | { kind: "treatment"; treatment: ShopTreatment; fresh: boolean };

/** Haircut, the treatments the shop adds, and the chairs it has created. */
/** Services and chairs. `locationId` scopes it to one shop (Manage Shop); `embedded` drops the page header. */
export function ServicesScreen({ locationId: forLoc, embedded }: { locationId?: string; embedded?: boolean } = {}) {
  const shops = useShopLocations();
  // Always the default prices: location prices are set in Manage shop › Edit shop details.
  const menu = useShopMenu("master");
  const { haircut, services, saveHaircut, saveTreatment, removeTreatment, setEnabled, resetHaircut, resetTreatment, atLocation } = menu;
  const { chairs } = useShopChairs(forLoc ? { locationId: forLoc } : undefined);
  const place = forLoc ? shops.branches.find((b) => b.id === forLoc)?.name : shops.enabled ? shops.branch?.name : undefined;
  const { rows } = useChairRequests();
  const [editing, setEditing] = useState<Editor | null>(null);
  const [note, setNote] = useState("");
  const multi = shops.enabled && shops.branches.length > 1;
  const holders = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.status === "in_chair" && row.chairLabel) map[row.chairLabel] = row.customerLabel || "In use";
    }
    return map;
  }, [rows]);

  if (editing?.kind === "profile") return <BarberProfile chairId={editing.chairId} onClose={() => setEditing(null)} />;

  if (editing?.kind === "chair") {
    return (
      <ChairEditor
        inService={Boolean(holders[editing.chair.label])}
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
            const error = `${editing.chair.label} is with a customer. Finish that haircut before removing.`;
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
        perLoc={multi}
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
        perLoc={multi}
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
      {embedded ? <h2 className="px-1 text-[18px] font-extrabold tracking-[-0.02em]">My Barbers</h2> : <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title="Services" subtitle={shops.enabled ? "Services apply to every location. Tap one to set a price per location." : "Your haircut and the other services you sell."} />}
      {note ? <p className="mt-3 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}

      {!forLoc ? null : <section className={embedded ? "mt-2" : "mt-5"}>
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            {embedded ? null : <h2 className="text-[13px] font-bold text-muted">My Barbers</h2>}
            <p className="mt-1 text-[13px] font-medium text-ink-2">Each barber gets their own link to take walk-ins and finish haircuts.</p>
          </div>
          <Button data-auth="action" size="sm" leadingIcon={<Plus size={15} strokeWidth={2.2} />} onClick={() => {
            const locationId = forLoc ?? shops.scopeId ?? HOME_LOCATION_ID;
            const number = nextChairNumber(locationId);
            setEditing({ kind: "chair", fresh: true, chair: { id: `c-${Date.now().toString(36)}`, number, label: `Barber ${number}`, barberId: "", barberName: "", vacantAt: Date.now(), locationId } });
          }}>Add barber</Button>
        </div>
        <LinkReviewList chairIds={chairs.map((c) => c.id)} className="mt-2" />
        {chairs.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No barbers yet. Add your first barber.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {chairs.map((chair) => {
              const holder = holders[chair.label];
              const off = chair.active === false;
              return (
                <li key={chair.id} className="relative rounded-card bg-surface px-3.5 py-3.5 shadow-card">
                  <button type="button" style={{ opacity: off ? 0.55 : 1 }} onClick={() => setEditing({ kind: "profile", chairId: chair.id })} className="flex w-full min-w-0 items-center gap-3 pr-11 text-left" aria-label={`Open ${chairBarberName(chair)}’s profile`}>
                    <BarberPortrait chair={chair} size={44} />
                    <span className="min-w-0">
                      <b className="block truncate text-[16px]">{chairBarberName(chair)}</b>
                      <small className="block truncate text-[13px] font-medium text-muted">{off ? "Inactive" : holder ? `In service · ${holder}` : "Available"}{place ? ` · ${place}` : ""} · {shareLabel(sharePct(chair))}</small>
                    </span>
                  </button>
                  <button type="button" aria-label={`Edit ${chairBarberName(chair)}`} title="Edit barber" onClick={() => setEditing({ kind: "chair", chair, fresh: false })}
                    className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-ink"><Pencil size={16} strokeWidth={2} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>}

      {forLoc ? null : <>
      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-bold text-muted">Haircut</h2>
        <div className="mt-2 flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
          <button type="button" onClick={() => setEditing({ kind: "haircut" })} aria-label={`Edit ${haircut.name}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <BarberIcon name={haircut.icon} size={44} title={haircut.name} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15.5px]">{haircut.name}</b>
            <small className="text-[12.5px] font-semibold text-muted">{haircut.price ? `₱${haircut.price}` : "Set a price"}{atLocation ? ` · ${SOURCE[haircut.source]}` : ""}{multi ? ` · ${priceSummary("haircut", shops.branches)}` : ""}</small>
          </span>
          </button>
          <HomeToggle serviceId="haircut" name={haircut.name} />
          {atLocation && haircut.source === "changed" ? <Button data-auth="action" size="sm" variant="secondary" onClick={resetHaircut}>Use shared</Button> : null}
          <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "haircut" })}>Edit</Button>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[13px] font-bold text-muted">Other services</h2>
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
                <button type="button" onClick={() => setEditing({ kind: "treatment", treatment, fresh: false })} aria-label={`Edit ${treatment.name}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <BarberIcon name={treatment.icon} size={44} title={treatment.name} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15.5px]">{treatment.name}</b>
                  <small className="text-[12.5px] font-semibold text-muted">{treatment.price ? `₱${treatment.price}` : "Set a price"}{atLocation ? ` · ${treatment.enabled ? SOURCE[treatment.source] : "Off here"}` : ""}{multi ? ` · ${priceSummary(treatment.id, shops.branches)}` : ""}</small>
                </span>
                </button>
                <span className="flex flex-none flex-col items-end gap-2">
                  {atLocation && treatment.source !== "local" ? (
                    <button type="button" data-auth="action" role="switch" aria-checked={treatment.enabled} aria-label={`${treatment.name} at this shop`} onClick={() => setEnabled(treatment.id, !treatment.enabled)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${treatment.enabled ? "bg-ink" : "bg-grey-200"}`}>
                      <span className={`absolute top-0.5 size-6 rounded-full bg-surface shadow transition-all ${treatment.enabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  ) : null}
                  <span className="flex gap-2">
                    <HomeToggle serviceId={treatment.id} name={treatment.name} />
                    {atLocation && treatment.source === "changed" ? <Button data-auth="action" size="sm" variant="secondary" onClick={() => resetTreatment(treatment.id)}>Use shared</Button> : null}
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "treatment", treatment, fresh: false })}>Edit</Button>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PayQrSettings />

      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-bold text-muted">Home service</h2>
        <p className="mt-1 px-1 text-[13px] font-medium text-ink-2">River Mobile customers can book a barber to their home. Tap “Home” on the services you offer, then set each location’s fee, distance, barbers and hours.</p>
        {(shops.enabled && shops.branches.length ? shops.branches : [{ id: HOME_LOCATION_ID, name: "" }]).map((b) => <HomeServiceCard key={b.id} locationId={b.id} place={b.name || undefined} />)}
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
      {pending ? <Spinner size={13} /> : null}{done ? <><Check size={13} strokeWidth={3} /> Link copied</> : compact ? "Share to Barber" : "Share to barber"}
    </button>
  );
}

export function Back({ title, onBack }: { title: string; onBack: () => void }) {
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

export function ChairEditor({
  chair, fresh, onBack, onSave, onRemove, inService,
}: {
  chair: ShopChair;
  fresh: boolean;
  place?: string;
  /** With a customer now: the location can't be switched until the cut is done. */
  inService?: boolean;
  onBack: () => void;
  onSave: (next: ShopChair) => string;
  onRemove: () => string;
}) {
  const [name, setName] = useState(chair.barberName?.trim() || (fresh ? "" : chairBarberName(chair) === "No barber" ? "" : chairBarberName(chair)));
  const [photo, setPhoto] = useState(chair.photoUrl ?? "");
  const [phone, setPhone] = useState(chair.phone ?? "");
  const [email, setEmail] = useState(chair.email ?? "");
  const [error, setError] = useState("");
  const [up, setUp] = useState<"" | "uploading" | "done">("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shops = useShopLocations();
  const [loc, setLoc] = useState(chair.locationId || HOME_LOCATION_ID);
  const [share, setShare] = useState(sharePct(chair) == null ? "none" : String(sharePct(chair)));
  const sharePctNum = share === "none" ? null : Math.min(100, Number(share) || 0);
  const [saving, setSaving] = useState(false);

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
    <FullScreen>
      <Back title={fresh ? "Add barber" : "Edit barber"} onBack={onBack} />
      <section aria-label="Barber details" className="mt-5 rounded-[20px] border border-grey-200 bg-surface p-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={up === "uploading"} aria-label={photo ? "Change photo" : "Upload photo"}
            className="relative size-[76px] flex-none rounded-full bg-grey-100 ring-1 ring-line">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={name || "Barber"} className="size-full rounded-full object-cover" />
            ) : <span className="flex size-full items-center justify-center rounded-full border-2 border-dashed border-grey-300 bg-grey-100"><Camera size={26} strokeWidth={2} className="text-ink-2" /></span>}
            {up === "uploading" ? <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70" role="status" aria-label="Uploading photo"><Loader2 size={20} className="animate-spin" /></span> : null}
            <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-7 items-center justify-center rounded-full bg-ink text-white ring-2 ring-surface">
              {up === "done" ? <Check size={14} strokeWidth={3} /> : <Camera size={14} strokeWidth={2.2} />}
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[17px] tracking-[-0.01em]">{name.trim() || (fresh ? "New barber" : "Barber")}</b>
            <span className="mt-0.5 block text-[12.5px] font-semibold text-muted" role="status">{up === "uploading" ? "Uploading photo…" : up === "done" ? "Photo uploaded" : photo ? "Tap the photo to change it" : "Tap to add a photo"}</span>
            {photo ? <button type="button" className="mt-1 text-[12.5px] font-semibold text-muted underline underline-offset-2" onClick={() => setPhoto("")}>Remove photo</button> : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
        </div>
        <div className="mt-4 grid gap-3 border-t border-grey-200 pt-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Barber’s name" />
          <Input label="Mobile number (optional)" inputMode="tel" placeholder="09XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, "").slice(0, 16))} />
          <Input label="Email (optional)" type="email" inputMode="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value.trim().slice(0, 120))} />
          <p className="px-1 text-[12px] font-semibold text-muted">Used for booking alerts when SMS or email is turned on.</p>
        </div>
      </section>
      <section aria-label="Income split" className="mt-3 rounded-[20px] border border-grey-200 bg-surface p-4">
        <b className="block text-[15px]">Income split</b>
        <p className="mt-0.5 text-[12.5px] font-medium text-muted">The barber’s share of sales. Tips always go 100% to the barber.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["none", "40", "50", "60", "70"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={share === v} onClick={() => setShare(v)}
              className={`h-11 rounded-pill text-[14px] font-bold transition-colors ${share === v ? "bg-ink text-on-ink" : "bg-grey-100 text-ink"}`}>{v === "none" ? "None" : `${v}%`}</button>
          ))}
          {(() => { const custom = share !== "none" && !["40", "50", "60", "70"].includes(share); return (
            <label className={`flex h-11 items-center justify-center gap-0.5 rounded-pill px-3 text-[14px] font-bold ${custom ? "bg-ink text-on-ink" : "bg-grey-100"}`}>
              <input aria-label="Barber share percent" inputMode="numeric" value={custom ? share : ""} placeholder="Custom" onChange={(e) => setShare(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
                style={custom ? { width: `${Math.max(1, share.length) + 0.4}ch` } : undefined} className={`min-w-0 bg-transparent text-center outline-none ${custom ? "" : "w-full "}${custom ? "placeholder:text-on-ink/50" : "placeholder:text-ink-2"}`} />{custom ? <span aria-hidden>%</span> : null}
            </label>); })()}
        </div>
        <p className="mt-3 rounded-[12px] bg-grey-100 px-3 py-2 text-[12.5px] font-semibold text-ink-2">{sharePctNum == null ? "No split is set. Sales aren’t divided between barber and shop." : <>Barber {sharePctNum}% · Shop {100 - sharePctNum}%. On ₱1,000: barber ₱{(sharePctNum * 10).toLocaleString("en-PH")}, shop ₱{((100 - sharePctNum) * 10).toLocaleString("en-PH")}.</>}</p>
      </section>
      {shops.enabled && shops.branches.length > 1 ? (
        <section aria-label="Location" className="mt-3 rounded-[20px] border border-grey-200 bg-surface p-4">
          <label className="flex flex-col gap-1.5">
            <b className="text-[15px]">Location</b>
            <select value={loc} disabled={inService} onChange={(e) => setLoc(e.target.value)} className="mt-1 h-12 rounded-[14px] bg-grey-100 px-3 text-[15px] font-semibold">
              {shops.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="text-[12px] font-semibold text-muted">{inService ? "Finish the current haircut before moving this barber." : "Moving keeps the same barber link and sales history."}</span>
          </label>
        </section>
      ) : null}
      {fresh ? null : <Button data-auth="action" className="mt-4" fullWidth variant="secondary" onClick={() => {
        const error = onRemove();
        if (error) setError(error);
      }}>Remove barber</Button>}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-4 pb-4 pt-5">
      {error ? <p className="mb-2 text-[13.5px] font-semibold" role="alert">{error}</p> : null}
      <Button data-auth="action" fullWidth loading={saving} disabled={up === "uploading" || saving} onClick={() => {
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Check the email address."); return; }
        const pct = Number(share);
        if (share !== "none" && (!share || !(pct >= 0 && pct <= 100))) { setError("Set the barber’s share from 0 to 100%, or pick None."); return; }
        setSaving(true);
        const error = onSave({ ...chair, barberName: name.trim(), photoUrl: photo || undefined, phone: phone.trim() || undefined, email: email || undefined, sharePct: share === "none" ? null : Math.round(pct), shareSet: share !== "none", locationId: loc });
        setSaving(false);
        if (error) setError(error);
      }}>Save</Button>
      </div>
    </FullScreen>
  );
}


function HaircutEditor({ haircut, onBack, onSave, perLoc }: { haircut: ShopHaircut; onBack: () => void; onSave: (next: ShopHaircut) => void; perLoc?: boolean }) {
  const [draft, setDraft] = useState(haircut);
  const [price, setPrice] = useState(haircut.price ? String(haircut.price) : "");
  const loc = useLocationDraft("haircut", haircut.price ?? 0);

  return (
    <FullScreen>
      <Back title="Edit haircut" onBack={onBack} />
      <p className="mt-1 pl-11 text-[14px] font-medium text-muted">One haircut for the shop. Other services are added separately.</p>
      <p className="mt-5 text-[13px] font-bold">Icon</p>
      <IconPick icons={HAIRCUT_ICONS} value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      <div className="mt-4 flex flex-col gap-3">
        <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        {perLoc ? null : <Input label="Price (₱)" inputMode="numeric" value={price} placeholder="e.g. 250" onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />}
      </div>
      {perLoc ? <LocationPriceInputs basePrice={haircut.price ?? 0} draft={loc.draft} setDraft={loc.setDraft} branches={loc.branches} initial={loc.initial} onApplyAll={loc.applyAll} /> : null}
      <Button data-auth="action" className="mt-6" fullWidth onClick={async () => {
        if (!draft.name.trim()) return;
        await new Promise((r) => setTimeout(r, 250));
        const def = perLoc ? loc.save() : Math.max(0, Math.round(Number(price) || 0));
        // Duration isn't asked; the internal default keeps time slots working.
        onSave({ ...draft, name: draft.name.trim(), durationMins: draft.durationMins || 30, price: def });
      }}>Save</Button>
    </FullScreen>
  );
}

function TreatmentEditor({
  treatment, fresh, onBack, onSave, onRemove, perLoc,
}: {
  perLoc?: boolean;
  treatment: ShopTreatment;
  fresh: boolean;
  onBack: () => void;
  onSave: (next: ShopTreatment) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(treatment);
  const [price, setPrice] = useState(treatment.price ? String(treatment.price) : "");
  const loc = useLocationDraft(treatment.id, treatment.price ?? 0);

  return (
    <FullScreen>
      <Back title={fresh ? "Add a service" : "Edit service"} onBack={onBack} />
      <p className="mt-1 pl-11 text-[14px] font-medium text-muted">This sits with the haircut. Save to keep it.</p>
      <p className="mt-5 text-[13px] font-bold">Icon</p>
      <IconPick icons={TREATMENT_ICONS} value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      <div className="mt-4 flex flex-col gap-3">
        <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        {perLoc && !fresh ? null : <Input label="Price (₱)" inputMode="numeric" value={price} placeholder="e.g. 250" onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />}
      </div>
      {perLoc && !fresh ? <LocationPriceInputs basePrice={treatment.price ?? 0} draft={loc.draft} setDraft={loc.setDraft} branches={loc.branches} initial={loc.initial} onApplyAll={loc.applyAll} /> : null}
      <Button data-auth="action" className="mt-6" fullWidth onClick={async () => {
        if (!draft.name.trim()) return;
        await new Promise((r) => setTimeout(r, 250));
        const def = perLoc && !fresh ? loc.save() : Math.max(0, Math.round(Number(price) || 0));
        // Duration isn't asked; the internal default keeps time slots working.
        onSave({ ...draft, name: draft.name.trim(), durationMins: draft.durationMins || 30, price: def });
      }}>Save</Button>
      {fresh ? null : <Button data-auth="action" className="mt-2" fullWidth variant="secondary" onClick={onRemove}>Remove service</Button>}
    </FullScreen>
  );
}
