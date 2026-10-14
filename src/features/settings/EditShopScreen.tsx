"use client";

import { ChevronLeft, ImagePlus, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Badge, Button, Card, Input, cn } from "@river-apps/ui";
import { uploadPhoto } from "@/lib/upload";
import { reverseGeocodePin } from "@/lib/geocode";
import { SHOP_ABOUT_MAX, defaultShopAbout } from "@/lib/shop-about";
import { useShopLocations } from "@/lib/shop-locations";
import { clampLocations, useShopProfile, type ShopLocation } from "@/lib/shop-profile";
import { useShopMenu } from "@/lib/shop-services";
import { LocationPicker } from "./LocationPicker";
import { ShopPhotos } from "./ShopPhotos";

/** Full-screen shop profile editor: name, logo, about, map pin, and facades. */
export function EditShopScreen() {
  const { profile, ready, save } = useShopProfile();
  const router = useRouter();

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[402px] flex-col bg-surface lg:my-8 lg:min-h-[calc(100dvh-4rem)] lg:max-w-[560px] lg:overflow-hidden lg:rounded-banner lg:shadow-card">
      {ready ? <ProfileEditor profile={profile} save={save} /> : <EditorBar dirty={false} busy={false} hold="" onBack={() => router.push("/settings")} />}
    </div>
  );
}

function EditorBar({ dirty, busy, hold, onBack }: { dirty: boolean; busy: boolean; hold: string; onBack: () => void }) {
  return (
    <>
      <div className="flex h-14 flex-none items-center justify-between gap-2 px-5 pt-1">
        <button type="button" aria-label="Back" onClick={onBack} className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-grey-100 text-ink">
          <ChevronLeft size={22} strokeWidth={1.75} />
        </button>
        <span className="truncate text-[15px] font-bold">Update shop</span>
        <Button data-auth="action" type="submit" form="edit-shop-form" size="sm" className="min-w-[4.5rem]" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
      {hold ? <p className="px-5 pb-1 text-[13px] font-semibold">{hold}</p> : null}
    </>
  );
}

function ProfileEditor({
  profile,
  save,
}: {
  profile: ReturnType<typeof useShopProfile>["profile"];
  save: ReturnType<typeof useShopProfile>["save"];
}) {
  const router = useRouter();
  const { enabled } = useShopLocations();
  const { haircut, treatments } = useShopMenu();
  const logoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hold, setHold] = useState("");
  const [name, setName] = useState(profile.name);
  const [logo, setLogo] = useState(profile.logoUrl);
  const [photos, setPhotos] = useState(profile.photoUrls);
  const [locations, setLocations] = useState(String(profile.locations));
  const [phone, setPhone] = useState(profile.phone);
  const [hours, setHours] = useState(profile.hours);
  const [location, setLocation] = useState<ShopLocation | null>(profile.location);
  const [aboutDraft, setAboutDraft] = useState<string | null>(profile.about.trim() ? profile.about : null);
  const serviceNames = [haircut.name, ...treatments.map((t) => t.name)];
  const about = aboutDraft ?? (profile.about.trim() ? profile.about : defaultShopAbout(profile, serviceNames));
  const aboutId = useId();
  const pinSame = samePin(location, profile.location);
  const photosSame = photos.length === profile.photoUrls.length && photos.every((url, index) => url === profile.photoUrls[index]);
  const dirty = name.trim() !== profile.name
    || logo !== profile.logoUrl
    || !photosSame
    || !pinSame
    || (aboutDraft !== null && about !== profile.about)
    || phone.trim() !== profile.phone
    || hours.trim() !== profile.hours
    || (!enabled && clampLocations(locations) !== profile.locations);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function leave(href: string) {
    if (dirty) {
      setHold("Save your changes before going back.");
      return;
    }
    router.push(href);
  }

  async function onLogo(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setError("");
    setBusy(true);
    try {
      setLogo(await uploadPhoto(file, 480, 0.85));
      setHold("");
    } catch {
      setError("Couldn’t read that logo. Try a smaller image.");
    } finally {
      setBusy(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setHold("");
    setBusy(true);
    try {
      let area = profile.area;
      let address = profile.address;
      let loc = location;
      const prev = profile.location;
      const pinMoved = loc ? !prev || prev.lat.toFixed(6) !== loc.lat.toFixed(6) || prev.lng.toFixed(6) !== loc.lng.toFixed(6) : false;
      if (loc && (pinMoved || !area.trim() || !loc.formattedAddress)) {
        const geo = await reverseGeocodePin(loc.lat, loc.lng);
        if (geo) {
          if (geo.area) area = geo.area;
          if (geo.formatted) {
            address = geo.formatted;
            if (!loc.formattedAddress) loc = { ...loc, formattedAddress: geo.formatted };
          }
        }
      } else if (loc?.formattedAddress) {
        address = loc.formattedAddress;
      }
      save({
        ...profile,
        name: name.trim() || profile.name,
        logoUrl: logo,
        photoUrls: photos,
        locations: clampLocations(locations),
        area,
        address,
        location: loc,
        about: about.slice(0, SHOP_ABOUT_MAX),
        phone: phone.trim(),
        hours: hours.trim(),
      });
      router.push("/settings");
    } catch {
      setError("Couldn’t save the shop. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <EditorBar dirty={dirty} busy={busy} hold={hold} onBack={() => leave("/settings")} />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-10 pt-2">
        <Card className="px-4 py-3.5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <b className="text-[16px]">Shop profile</b>
              <p className="mt-0.5 text-[13px] font-medium text-muted">Your map pin helps customers find your shop.</p>
            </div>
            {location ? (
              <Badge variant="soft" size="sm" className="shrink-0">
                <MapPin size={12} className="mr-1 inline" />
                Pinned
              </Badge>
            ) : null}
          </div>

          <form id="edit-shop-form" onSubmit={onSave} className="mt-3 grid gap-4">
            <div className="flex items-end gap-3">
              <div className="flex flex-none flex-col items-center">
                <span className="mb-2 text-[14px] font-bold">Logo</span>
                <button
                  type="button"
                  aria-label={logo ? "Change logo" : "Upload logo"}
                  disabled={busy}
                  onClick={() => logoRef.current?.click()}
                  className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-grey-100 ring-1 ring-line"
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="size-full object-cover" />
                  ) : (
                    <ImagePlus size={20} className="text-muted" />
                  )}
                </button>
                <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => void onLogo(e.target.files?.[0])} />
              </div>
              <div className="min-w-0 flex-1">
                <Input size="md" label="Shop name" value={name} onChange={(e) => { setName(e.target.value); setHold(""); }} required minLength={2} maxLength={80} disabled={busy} />
              </div>
            </div>
            {enabled ? (
              <p className="text-[12.5px] font-semibold text-muted">This name is the brand on every shop. Each shop’s pin is set under Shops.</p>
            ) : (
              <>
                <Input size="md" label="Locations" inputMode="numeric" value={locations} onChange={(e) => setLocations(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} disabled={busy} />
                <p className="-mt-2 text-[12.5px] font-semibold text-muted">How many shops you run. This shows on your profile.</p>
              </>
            )}
            <Input size="md" label="Shop phone" inputMode="tel" placeholder="09XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 20))} disabled={busy} />
            <Input size="md" label="Opening hours" placeholder="Mon–Sat 9 AM–8 PM" value={hours} onChange={(e) => setHours(e.target.value.slice(0, 120))} disabled={busy} />
            <AboutField id={aboutId} about={about} starter={aboutDraft === null && !profile.about.trim()} disabled={busy} onChange={(value) => setAboutDraft(value)} />
            {enabled ? <Button type="button" variant="secondary" size="md" onClick={() => leave("/settings/shops")}>Shops</Button> : <LocationPicker value={location} onChange={setLocation} disabled={busy} />}
            {error ? <p className="text-[13.5px] font-semibold">{error}</p> : null}
            <Button type="submit" size="md" fullWidth disabled={busy || !dirty || name.trim().length < 2}>
              {busy ? "Saving…" : "Save shop profile"}
            </Button>
          </form>
        </Card>
        <ShopPhotos urls={photos} disabled={busy} onChange={(next) => { setPhotos(next); setHold(""); }} />
      </div>
    </>
  );
}

function samePin(next: ShopLocation | null, saved: ShopLocation | null) {
  if (!next && !saved) return true;
  if (!next || !saved) return false;
  return next.lat.toFixed(6) === saved.lat.toFixed(6) && next.lng.toFixed(6) === saved.lng.toFixed(6);
}

function AboutField({ id, about, starter, disabled, onChange }: { id: string; about: string; starter: boolean; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-bold">About <span className="font-semibold text-muted">(optional)</span></label>
        <span className={cn("text-[12px] font-semibold tabular-nums", about.length >= SHOP_ABOUT_MAX ? "text-ink" : "text-muted")} aria-live="polite">
          {about.length}/{SHOP_ABOUT_MAX}
        </span>
      </div>
      <textarea
        id={id}
        value={about}
        onChange={(e) => onChange(e.target.value.slice(0, SHOP_ABOUT_MAX))}
        maxLength={SHOP_ABOUT_MAX}
        rows={5}
        disabled={disabled}
        placeholder="Tell customers what makes your shop great."
        className="min-h-[140px] resize-y rounded-tile bg-canvas px-4 py-3 text-[14px] font-medium leading-relaxed text-ink outline-none transition-shadow placeholder:text-subtle focus:bg-surface focus:ring-2 focus:ring-ink disabled:opacity-60"
      />
      <p className="mt-1.5 text-[12px] font-semibold text-muted">
        {starter ? "A starter from your shop details. Edit it, or save as is." : "Shown on your shop listing."}
      </p>
    </div>
  );
}
