/**
 * Barbers.ph Terms of Service and Privacy Policy, for shop owners and staff (vendors).
 * Modelled on River Mobile's Terms & Privacy (river-mobile-ui src/data/legalDocs.ts); entity and
 * contact details are reused exactly from there. Draft for legal review.
 */
export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };
export type LegalDoc = { slug: "terms" | "privacy"; title: string; effective: string; intro: string[]; sections: LegalSection[] };

export const LEGAL_ENTITY = {
  company: "River Tech Inc.",
  brand: "River Apps",
  app: "Barbers.ph",
  address: "BF Homes, 410 El Grande Ave, Parañaque, 1720 Metro Manila",
  legalEmail: "legal@smartrefill.io",
  privacyEmail: "privacy@smartrefill.io",
} as const;

export const LEGAL_DRAFT_NOTICE = "Draft for legal review — not yet final.";
export const LEGAL_EFFECTIVE = "Effective: October 14, 2026";
const E = LEGAL_ENTITY;

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `Welcome to ${E.app}, an app of ${E.brand} operated by ${E.company} (“River,” “we,” “our,” or “us”).`,
    `These Terms of Service (“Terms”) govern how barbershop owners and their staff (“you,” the “Shop”) use the ${E.app} app and website and related services (the “Services”). By creating an account, listing a shop or using the queue, you agree to these Terms. If you do not agree, please do not use the Services.`,
  ],
  sections: [
    { id: "about", title: "1. What Barbers.ph is", blocks: [
      `${E.app} helps barbershops run their day: a walk-in and online queue, a booking QR for customers, a sales record, chair links for barbers, a shop listing and Moments, a feed for shop owners.`,
      `Your shop’s public listing can also be shown in River Mobile, the ${E.brand} app where customers find and book local providers.`,
    ] },
    { id: "responsibility", title: "2. Your responsibility vs River’s", blocks: [{ list: [
      "<b>You are responsible</b> for your shop and its services: haircuts and grooming, prices, staff, hours, permits, hygiene and compliance with health, safety, tax and labour rules.",
      "<b>River is responsible</b> for the app: storing your shop data, passing customer bookings to your queue, processing plan payments and handling support in good faith.",
      "Keep your listing accurate: name, address, map pin, hours, services, prices and photos must be truthful and yours to use.",
    ] }] },
    { id: "account", title: "3. Eligibility and your account", blocks: [{ list: [
      "You must be at least 18 and authorised to act for the shop.",
      "You sign in with your Philippine mobile number (one-time SMS code) or your Google account. Keep them secure; activity on your account and its barber chair links is your responsibility.",
      "Anyone can browse without an account; an account is needed to save shop data, take bookings, post or upgrade.",
      "Share chair links only with your own staff and turn them off when someone leaves.",
    ] }] },
    { id: "customers", title: "4. Customer records and bookings", blocks: [{ list: [
      "Customers who scan your QR or book through River Mobile send a request to your queue. A booking is confirmed when you accept it.",
      "You may enter customer details (names, mobile numbers, emails, services, notes). Collect only what you need, tell customers why, and use it only to serve them. For these records you are a personal information controller under the Data Privacy Act; River processes them on your behalf.",
      "Do not enter sensitive personal information (health, government IDs) or use customer contacts for marketing without their consent.",
      "Honour bookings you accept, or decline them promptly so the customer can go elsewhere.",
    ] }] },
    { id: "plans", title: "5. Plans, payments and refunds", blocks: [{ list: [
      "<b>Partner</b> is the entry tier for 1 shop: online bookings from River Mobile, the queue and Moments.",
      "<b>Pro</b> is ₱499 per month for all features and 1 shop, and renews each month while active. Extra shops are not sold on Pro; upgrade to Lifetime to run more than one shop.",
      "<b>Lifetime · 1–5 shops</b> is ₱10,000 one-time for all features and up to 5 shops. <b>Lifetime · 5+ shops</b> is ₱20,000 one-time for all features and unlimited shops. Lifetime means continued access for the life of the Service.",
      "Plan payments are processed by PayMongo (cards, GCash, Maya and other methods offered). River does not store your full card number. Your plan changes only after PayMongo confirms the payment.",
      "Prices include VAT where applicable and are shown before you pay. If a monthly plan is not renewed, the shop returns to Partner at the end of the period; your data stays.",
      "Fees already paid are non-refundable except for duplicate or failed charges, or where Philippine law requires a refund. Contact us within 7 days about a billing problem.",
      "Payments customers make to you at the chair are between you and the customer.",
    ] }] },
    { id: "public", title: "6. Public listing, photos and location", blocks: [
      "When you list your shop, its name, address, area, map location, hours, services and prices, logo and photos are public so customers can find you, including in River Mobile and on maps. You give River a non-exclusive, royalty-free licence to host, display and share this content for that purpose, and you confirm you have the rights to the photos you upload (including consent of any person shown).",
    ] },
    { id: "community", title: "7. Moments posts", blocks: [{ list: [
      "Keep posts honest, respectful and about running a shop. Do not post illegal, hateful, harassing, sexual or misleading content, other people’s personal data, or spam.",
      "You keep ownership of what you post; River may host, display and moderate it, and may remove content or limit accounts that break these rules.",
    ] }] },
    { id: "use", title: "8. Acceptable use", blocks: [{ list: [
      "Use the Services only for lawful business purposes.",
      "Do not misuse, copy, reverse-engineer, scrape or interfere with the Services, or try to get around security or payments.",
      "Do not create fake bookings, listings or reviews, or impersonate another shop.",
    ] }] },
    { id: "availability", title: "9. Service availability and maps", blocks: [
      "We aim for high availability but cannot guarantee uninterrupted service. Keep your own records of important sales. Maps and distances are estimates based on third-party map data (including OpenStreetMap).",
    ] },
    { id: "ip", title: "10. Intellectual property", blocks: [
      `River owns the Services, including software and the ${E.brand}, ${E.app} and River Mobile names, logos and designs. Your shop name, logo and photos remain yours.`,
    ] },
    { id: "termination", title: "11. Suspension and closing your account", blocks: [
      `We may suspend or close accounts that break these Terms, commit fraud or put others at risk. You can stop using the Services at any time and ask us to delete your account and shop by emailing ${E.privacyEmail} from the account’s email or mobile number (see the Privacy Policy).`,
    ] },
    { id: "liability", title: "12. Limitation of liability", blocks: [
      "To the maximum extent permitted by law: River is not liable for indirect or consequential damages, lost profits, or the services you provide to your customers; and our total liability for any claim is limited to the plan fees you paid to River in the 12 months before the claim. Nothing in these Terms excludes liability that cannot be excluded under Philippine law.",
    ] },
    { id: "indemnity", title: "13. Indemnification", blocks: [
      "You agree to indemnify River for claims arising from your shop’s services, your content (including photos and customer records you enter), or your violation of these Terms or the law.",
    ] },
    { id: "changes", title: "14. Changes to these Terms", blocks: [
      "We may update these Terms. We will show the new effective date and, for material changes, notify you in the app before they apply. Continuing to use the Services means you accept the updated Terms.",
    ] },
    { id: "law", title: "15. Governing law and disputes", blocks: [
      "These Terms are governed by the laws of the Philippines. We will first try to resolve any dispute informally through support. Unresolved disputes are subject to the courts of Parañaque City.",
    ] },
    { id: "contact", title: "16. Contact us", blocks: [{ list: [`Email: ${E.legalEmail}`, `Company: ${E.company}`, `Business address: ${E.address}`] }] },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  effective: LEGAL_EFFECTIVE,
  intro: [
    `${E.company} (“River,” “we”) operates ${E.app}, an app of ${E.brand} for barbershop owners and staff. We protect personal data in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC).`,
    "For your account and shop we are the personal information controller. For customer records you enter or receive through bookings, your shop is the controller and River processes them on your behalf to run the queue and booking features.",
  ],
  sections: [
    { id: "collect", title: "1. Information we collect", blocks: [{ list: [
      "<b>Account data:</b> your name, mobile number, email and profile photo, and your Google account name and email if you sign in with Google.",
      "<b>Sign-in data:</b> we use Firebase Authentication by Google for phone (SMS code) and Google sign-in. reCAPTCHA by Google may check that sign-in is not automated.",
      "<b>Shop data:</b> shop name, address, branches, map location, phone, hours, services and prices, chairs and barber links, logo and photos.",
      "<b>Customer and booking records:</b> customer names or labels, mobile numbers or emails, services, times, status, chair, prices and payment status for walk-ins and online bookings.",
      "<b>Plan and payments:</b> your plan, amount, status and PayMongo reference. Card and e-wallet details are collected by PayMongo, not stored by River.",
      "<b>Moments:</b> posts, photos, comments and likes.",
      "<b>Device and usage data:</b> app version, device and browser type, IP address, error logs and in-app activity.",
    ] }] },
    { id: "use", title: "2. How we use information", blocks: [
      { list: [
        "To create and secure your account and verify your mobile number.",
        "To run your queue, bookings, sales record and chair links, and show your history.",
        "To publish your shop listing so customers can find and book you, including in River Mobile.",
        "To process plan payments and keep your plan up to date.",
        "To provide support, prevent fraud and keep the community safe.",
        "To improve the Services through aggregated analytics.",
      ] },
      "Our lawful bases are your consent, the performance of our contract with you, our legitimate interests (security, fraud prevention, improving the Services) and legal obligations.",
    ] },
    { id: "public", title: "3. What is public", blocks: [
      "Your shop listing (name, address, area, map location, hours, services and prices, logo and photos) is public, including in River Mobile and on maps. Customer records, sales, chair links and your account details are never public.",
    ] },
    { id: "share", title: "4. Who we share data with", blocks: [
      "We do not sell personal data. We share it only as needed:",
      { list: [
        "<b>Customers and River Mobile users:</b> your public shop listing, and the status of a booking to the customer who made it.",
        "<b>Service providers:</b> Google Firebase and Google Cloud (hosting, database, storage, sign-in), PayMongo (payments), SMS providers, and map services.",
        "<b>Other shop owners:</b> your display name and photo with Moments posts.",
        "<b>Authorities</b> when required by law or to protect rights and safety.",
      ] },
      "Some service providers store data outside the Philippines (for example Google Cloud in Singapore). We use contracts and safeguards as required by the Data Privacy Act.",
    ] },
    { id: "retention", title: "5. How long we keep data", blocks: [{ list: [
      "Account and shop data: while your account is active.",
      "Booking, sales and payment records: 10 years, as required for tax and accounting records under the National Internal Revenue Code (NIRC), then deleted or anonymised.",
      "Moments posts: until you delete them or your account.",
      "After your account is deleted we remove or anonymise personal data, shop photos and customer records within 30 days, except records we must keep by law.",
    ] }] },
    { id: "security", title: "6. Security", blocks: [{ list: [
      "Encryption of data in transit and at rest.",
      "Access rules so only your account (and chair links you create) can read your shop’s private data.",
      "Role-based access for staff, monitoring and regular backups.",
      "We will notify you and the NPC of a personal data breach as required by law (within 72 hours of knowledge where applicable).",
    ] }] },
    { id: "rights", title: "7. Your rights and deleting your account", blocks: [
      "As a data subject you have the right to be informed; to access your data; to object; to correct inaccurate data; to erasure or blocking; to data portability; to withdraw consent; to damages; and to file a complaint with the National Privacy Commission (privacy.gov.ph).",
      `You can edit your shop and profile in Settings. To delete your account and shop, or for any other request, email ${E.privacyEmail} from the email or mobile number on the account. We respond within 15 days. Customers who ask your shop about their records should be helped by you; we will assist.`,
    ] },
    { id: "children", title: "8. Children", blocks: [
      `${E.app} is for adults (18+) running a shop. We do not knowingly collect children’s data as account holders. Bookings for minors should be made by a parent or guardian.`,
    ] },
    { id: "changes", title: "9. Changes to this policy", blocks: ["We may update this policy. We will show the new effective date and tell you in the app about material changes."] },
    { id: "dpo", title: "10. Contact our Data Protection Officer", blocks: [{ list: [
      `Email: ${E.privacyEmail}`, "Data Protection Officer: Jimboy Regalado", `Company: ${E.company}`, `Address: ${E.address}`,
    ] }] },
  ],
};
