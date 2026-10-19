import type { Metadata } from "next";
import { PageBack } from "@/components/shell/page-back";

export const metadata: Metadata = { title: "Map credits · Barbers.ph" };

const CREDITS: { name: string; what: string; href: string; link: string }[] = [
  { name: "© OpenStreetMap contributors", what: "Map data, available under the Open Database License (ODbL).", href: "https://www.openstreetmap.org/copyright", link: "openstreetmap.org/copyright" },
  { name: "Protomaps", what: "Map tiles built from OpenStreetMap data.", href: "https://protomaps.com", link: "protomaps.com" },
  { name: "MapLibre GL JS", what: "Map rendering (BSD-3-Clause).", href: "https://maplibre.org", link: "maplibre.org" },
  { name: "Photon by komoot", what: "Place search, based on OpenStreetMap data.", href: "https://photon.komoot.io", link: "photon.komoot.io" },
  { name: "Nominatim", what: "Address lookup for map pins and backup place search, based on OpenStreetMap data.", href: "https://nominatim.org", link: "nominatim.org" },
];

/** Attributions for the maps, tiles and place search used in the app. */
export default function MapCreditsPage() {
  return (
    <div className="mx-auto w-full max-w-[402px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <div className="flex items-center gap-1">
        <PageBack fallback="/settings" />
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">Map credits</h1>
      </div>
      <p className="mt-2 px-1 text-[14px] font-medium text-muted">The shop map and address search use these open data sources and tools.</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {CREDITS.map((c) => (
          <li key={c.name} className="rounded-card bg-surface px-4 py-3.5 shadow-card">
            <b className="block text-[15px]">{c.name}</b>
            <p className="mt-0.5 text-[13.5px] font-medium text-ink-2">{c.what}</p>
            <a href={c.href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[13px] font-bold underline underline-offset-2">{c.link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
