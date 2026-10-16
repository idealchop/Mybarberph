import type { CommunityPost } from "./posts";

/** Client-only sample posts shown when the feed is sparse. Never sent to the server. */
export const SAMPLE_PREFIX = "sample-";
export const isSamplePost = (id: string) => id.startsWith(SAMPLE_PREFIX);

const s = (n: number, name: string, meta: string, avatar: CommunityPost["author"]["avatar"], body: string, ageMin: number, likes: number, images: string[] = []): CommunityPost => ({
  id: `${SAMPLE_PREFIX}${n}`, author: { name, meta, avatar }, body, images, ageMin, likes, reposts: Math.floor(likes / 6), replies: [],
});

export const SAMPLE_POSTS: CommunityPost[] = [
  s(1, "Gupit ni Mang Tonyo", "Maynila", "sky", "Bagong gupit, bagong araw! Malinis na fade para kay Kuya Jun ngayong umaga. Salamat sa tiwala, suki!", 25, 34, ["/community/clippers.svg"]),
  s(2, "Barberya Bayanihan", "Lungsod Quezon", "mint", "Promo ngayong linggo: libreng ahit ng balbas sa bawat gupit. Hanggang Linggo lamang, kaya dumaan na kayo!", 70, 52),
  s(3, "Tabas Pinoy", "Lungsod Cebu", "lilac", "Mababang fade na may malinis na guhit sa gilid. Isa sa mga paborito naming gawin. Ano ang gusto ninyong susunod?", 160, 41, ["/community/chairs.svg"]),
  s(4, "Gunting at Suklay", "Lungsod Davao", "butter", "Dalawampung taon na ang aming munting barberya. Mula sa iisang upuan, ngayon ay may lima na. Maraming salamat sa inyong lahat!", 300, 88, ["/community/shopfront.svg"]),
  s(5, "Kanto Barbero", "Pasig", "peach", "Payo ng barbero: hugasan ang buhok gamit ang malamig na tubig pagkatapos magpagupit para manatiling maayos ang ayos.", 480, 27),
  s(6, "Ahit Hari", "Lungsod Iloilo", "indigo", "Unang gupit ng batang si Migo ngayong araw. Medyo kinabahan siya pero ang tapang niya! Ang guwapo mo, iho.", 720, 63),
  s(7, "Barberya ni Aling Rosa", "Baguio", "rose", "Malamig man dito sa amin, mainit naman ang pagtanggap namin sa inyo. Bukas kami mula ikasiyam ng umaga hanggang ikawalo ng gabi.", 1100, 39),
  s(8, "Matalas na Labaha", "Lungsod Bacolod", "sky", "Klasikong gupit na may hawi sa gilid para sa kasal ni Kuya Paolo bukas. Maligayang bati sa inyong dalawa!", 1500, 47),
  s(9, "Suki Barberya", "Taguig", "mint", "Espesyal na alok para sa mga estudyante: may bawas sa presyo tuwing Martes at Huwebes. Ipakita lamang ang inyong kard ng paaralan.", 2300, 58),
  s(10, "Gupit Probinsya", "Lungsod Batangas", "butter", "Tahimik na hapon sa barberya. Kape, kuwentuhan, at isang malinis na gupit. Ito ang buhay na gusto namin.", 3600, 22),
];

/** Real posts first, then samples to keep the feed full. */
export function withSamples(real: CommunityPost[], min = 8): CommunityPost[] {
  if (real.length >= min) return real;
  return [...real, ...SAMPLE_POSTS];
}
