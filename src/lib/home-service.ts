"use client";
import { cloudStorage, useCloud } from "@/lib/cloud";
import { DEFAULT_HOME_LOCATION, HOME_KEY, parseHomeFile, type HomeLocationSettings, type HomeServiceFile } from "@/lib/home-service-model";

/** Owner's home-service settings (River Mobile customers only). */
export function useHomeService() {
  const cloud = useCloud();
  let file: HomeServiceFile;
  try { file = parseHomeFile(JSON.parse(cloud.values[HOME_KEY] || "null")); } catch { file = parseHomeFile(null); }
  const save = (next: HomeServiceFile) => cloudStorage.setItem(HOME_KEY, JSON.stringify(next));
  return {
    ready: cloud.ready,
    file,
    offers: (serviceId: string) => file.serviceIds.includes(serviceId),
    toggleService(serviceId: string) {
      const on = file.serviceIds.includes(serviceId);
      save({ ...file, serviceIds: on ? file.serviceIds.filter((x) => x !== serviceId) : [...file.serviceIds, serviceId] });
    },
    location: (id: string): HomeLocationSettings => file.locations[id] ?? DEFAULT_HOME_LOCATION,
    saveLocation(id: string, next: HomeLocationSettings) { save({ ...file, locations: { ...file.locations, [id]: next } }); },
  };
}
