"use client";

import { ChevronLeft } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button, Input, Topbar } from "@river-apps/ui";
import { BarberIcon } from "@/components/art";
import { PageBack } from "@/components/shell/PageBack";
import { fileToDataUrl } from "@/features/community/posts";
import { ChairMark, BarberPortrait } from "@/features/settings/SeatList";
import { useChairRequests } from "@/lib/chair-bookings";
import {
  chairBarberName, chairLinkExpired, ensureChairLink, linkExpiryLabel, nextChairNumber, removeChair, saveChair, seatTime, useShopChairs,
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
export function ServicesScreen() {
  const shops = useShopLocations();
  const menu = useShopMenu();
  const { haircut, services, saveHaircut, saveTreatment, removeTreatment, setEnabled, resetHaircut, resetTreatment, atLocation } = menu;
  const sharedSetup = shops.enabled && shops.viewingAll;
  const { chairs } = useShopChairs();
  const place = shops.enabled ? shops.branch?.name : undefined;
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
            setNote("Saved. The queue uses this chair.");
            setEditing(null);
          }
          return error;
        }}
        onRemove={() => {
          if (holders[editing.chair.label] || editing.chair.occupiedAt) {
            const error = `${editing.chair.label} is in use. Finish that cut before removing it.`;
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
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<PageBack fallback="/settings" />} title={sharedSetup ? "Shared setup" : "Services"} subtitle={sharedSetup ? "Defined once for every shop. Each shop uses these unless you change them there." : place ? `${place}: uses the shared setup. Turn items off, change a price, or add services only this shop sells.` : "One haircut, the other services you add, and the chairs you create."} />
      {note ? <p className="mt-3 rounded-[18px] bg-grey-100 px-4 py-3 text-[13.5px] font-semibold">{note}</p> : null}

      {sharedSetup ? <p className="mt-3 px-1 text-[13px] font-semibold text-muted">Chairs belong to each shop. Open a shop in Settings → Shops to set its chairs.</p> : null}
      {sharedSetup ? null : <section className="mt-5">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted">Chairs</h2>
            <p className="mt-1 text-[13px] font-medium text-ink-2">Seats you create, each with a barber. The barber link expires each month.</p>
          </div>
          <Button data-auth="action" size="sm" onClick={() => {
            const locationId = shops.scopeId ?? HOME_LOCATION_ID;
            const number = nextChairNumber(locationId);
            setEditing({
              kind: "chair",
              fresh: true,
              chair: {
                id: `c-${Date.now().toString(36)}`,
                number,
                label: `Chair ${number}`,
                barberId: "",
                barberName: "",
                vacantAt: Date.now(),
                locationId,
              },
            });
          }}>Add a chair</Button>
        </div>
        {chairs.length === 0 ? (
          <p className="mt-2 rounded-card bg-surface px-4 py-6 text-center text-[13.5px] font-semibold text-muted shadow-card">No chairs yet. Add one and assign a barber.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {chairs.map((chair) => {
              const holder = holders[chair.label];
              const used = Boolean(holder || chair.occupiedAt);
              return (
                <li key={chair.id} className="flex items-center gap-3 rounded-card bg-surface px-3 py-3 shadow-card">
                  <ChairMark label={chair.label} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15.5px]">{chair.label}</b>
                    <small className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
                      <BarberPortrait chair={chair} size={18} />
                      {chairBarberName(chair)}
                    </small>
                    <small className="block text-[12.5px] font-semibold text-muted">
                      {used
                        ? (holder ? `${holder} · ` : "") + (chair.occupiedAt ? `In use since ${seatTime(chair.occupiedAt)}` : "In use")
                        : (chair.vacantAt ? `Vacant since ${seatTime(chair.vacantAt)}` : "Vacant") + (chair.lastUsedAt ? ` · Last used ${seatTime(chair.lastUsedAt)}` : "")}
                    </small>
                    {chair.linkExpiresAt ? (
                      <small className="block text-[12.5px] font-semibold text-muted">
                        {chairLinkExpired(chair) ? `Link expired ${linkExpiryLabel(chair.linkExpiresAt)}` : `Link expires ${linkExpiryLabel(chair.linkExpiresAt)}`}
                      </small>
                    ) : null}
                  </span>
                  <span className="flex flex-none flex-col gap-2">
                    <CopyChairLink id={chair.id} />
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ kind: "chair", chair, fresh: false })}>Edit</Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>}

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
    </div>
  );
}

const SOURCE = { shared: "Shared", changed: "Changed here", local: "This shop only" } as const;

function CopyChairLink({ id }: { id: string }) {
  const [label, setLabel] = useState("Copy link");
  return (
    <Button data-auth="action" size="sm" variant="secondary" onClick={() => {
      const path = ensureChairLink(id);
      const url = `${window.location.origin}${path}`;
      navigator.clipboard?.writeText(url).then(
        () => {
          setLabel("Copied");
          window.setTimeout(() => setLabel("Copy link"), 1500);
        },
        () => setLabel(path),
      );
    }}>{label}</Button>
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
  chair, fresh, place, onBack, onSave, onRemove,
}: {
  chair: ShopChair;
  fresh: boolean;
  place?: string;
  onBack: () => void;
  onSave: (next: ShopChair) => string;
  onRemove: () => string;
}) {
  const [label, setLabel] = useState(chair.label);
  const [name, setName] = useState(chair.barberName?.trim() || (fresh ? "" : chairBarberName(chair) === "No barber" ? "" : chairBarberName(chair)));
  const [photo, setPhoto] = useState(chair.photoUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a photo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setPhoto(await fileToDataUrl(file, 480, 0.72));
    } catch {
      setError("Couldn’t read that photo. Try a smaller image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:px-[30px] lg:pt-6">
      <Back title={fresh ? "Add a chair" : "Edit chair"} onBack={onBack} />
      <p className="mt-1 pl-11 text-[14px] font-medium text-muted">The chair keeps its icon. The photo is the barber, and customers see it when they book.</p>
      <div className="mt-5 flex items-end gap-3">
        <span className="mb-1 flex-none"><BarberIcon name="pole" size={48} title="Chair" /></span>
        <div className="min-w-0 flex-1">
          <Input label="Chair" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>
      <div className="mt-5">
        <p className="text-[13px] font-bold">Barber</p>
        <div className="mt-2 flex items-center gap-3">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={name || "Barber"} className="size-16 flex-none rounded-full object-cover" />
          ) : (
            <span className="flex size-16 flex-none items-center justify-center rounded-full bg-grey-100 text-[18px] font-bold">
              {(name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col items-start gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              {photo ? "Change photo" : "Add photo"}
            </Button>
            {photo ? <button type="button" className="text-[12.5px] font-bold text-muted" onClick={() => setPhoto("")}>Remove photo</button> : null}
          </div>
        </div>
        <div className="mt-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Barber’s name" />
        </div>
        <p className="mt-2 text-[12.5px] font-semibold text-muted">This photo is what customers see online.</p>
      </div>
      {error ? <p className="mt-3 text-[13.5px] font-semibold">{error}</p> : null}
      {fresh ? <p className="mt-4 text-[13px] font-semibold text-muted">Save, then copy the link and send it to this barber. It expires each month.{place ? ` It is only for ${place}.` : ""}</p> : (
        <div className="mt-4">
          <CopyChairLink id={chair.id} />
          <p className="mt-2 text-[13px] font-semibold text-muted">
            They open this link to accept customers and finish the cut. No account.
            {chair.linkExpiresAt
              ? ` It expires each month, on ${linkExpiryLabel(chair.linkExpiresAt)}.`
              : " It expires each month."}
            {chairLinkExpired(chair) ? " This one has expired. Copy link sends a new one." : ""}
            {place ? ` This link is only for ${place}.` : ""}
          </p>
        </div>
      )}
      <Button data-auth="action" className="mt-6" fullWidth disabled={busy} onClick={() => {
        const error = onSave({ ...chair, label: label.trim() || chair.label, barberName: name.trim(), photoUrl: photo || undefined });
        if (error) setError(error);
      }}>Save</Button>
      {fresh ? null : <Button data-auth="action" className="mt-2" fullWidth variant="secondary" onClick={() => {
        const error = onRemove();
        if (error) setError(error);
      }}>Remove chair</Button>}
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
