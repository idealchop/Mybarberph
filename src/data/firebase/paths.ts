/** Firestore paths under shops/{shopId}/… (Barbers.ph plan §3.3). */
export const paths = {
  user: (uid: string) => `users/${uid}`,
  shop: (shopId: string) => `shops/${shopId}`,
  member: (shopId: string, uid: string) => `shops/${shopId}/members/${uid}`,
  col: (shopId: string, name: string) => `shops/${shopId}/${name}`,
  doc: (shopId: string, name: string, id: string) => `shops/${shopId}/${name}/${id}`,
  counter: (shopId: string) => `shops/${shopId}/counters/queue`,
};
