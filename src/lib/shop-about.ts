/** Max length of the shop's "About" blurb. */
export const SHOP_ABOUT_MAX = 300;

function listServices(names: string[]): string {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (uniq.length === 0) return "";
  if (uniq.length === 1) return uniq[0]!;
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`;
  return `${uniq[0]}, ${uniq[1]} and more`;
}

/** Starter blurb from the shop name, the map area, and the haircuts on the queue. */
export function defaultShopAbout(shop: { name: string; area: string }, serviceNames: string[]): string {
  const name = shop.name.trim() || "Our shop";
  const area = shop.area.trim();
  const services = listServices(serviceNames);
  const where = area ? ` in ${area}` : "";
  const offer = services ? ` We offer ${services}.` : "";
  const text = `${name} is your neighbourhood barbershop${where}.${offer} Walk in or book a chair and leave looking sharp.`;
  return text.length <= SHOP_ABOUT_MAX ? text : text.slice(0, SHOP_ABOUT_MAX - 1).trimEnd() + "…";
}
