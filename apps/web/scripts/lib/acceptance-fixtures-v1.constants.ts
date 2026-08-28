/**
 * Synthetic acceptance fixture definitions.
 *
 * Data only — no Prisma import, no side effects — so both the seeder and the
 * safety verifier can read the same declarations. Identity is derived from the
 * persona constants (the existing acceptance authority); this file keeps no
 * second copy of the marker, the company slug or the persona addresses.
 */
import { ACCEPTANCE_MARKER, type PersonaKey } from "./acceptance-personas-v1.constants";

/** Every fixture row carries this prefix in its human-visible title. */
export const ACCEPTANCE_FIXTURE_PREFIX = `[${ACCEPTANCE_MARKER}]`;

export const ACCEPTANCE_FIXTURE_CITY = "Ankara";
export const ACCEPTANCE_FIXTURE_DISTRICT = "Çankaya";

export type FixtureRequestKey =
  | "open-standard"
  | "draft-edit"
  | "urgent-no-offer"
  | "backfill-candidate";

export type FixtureRequestSpec = {
  key: FixtureRequestKey;
  /** Which persona owns the request. */
  owner: PersonaKey;
  /** Category.slug — equals the request-category-engine registry id. */
  categorySlug: string;
  title: string;
  description: string;
  rawInput: string;
  status: "DRAFT" | "PUBLISHED";
  isUrgent: boolean;
  /** Age of publishedAt in days; null for drafts. */
  publishedDaysAgo: number | null;
  budget: number | null;
  /** Scenario this row exists to make measurable. */
  scenario: string;
};

function titled(text: string): string {
  return `${ACCEPTANCE_FIXTURE_PREFIX} ${text}`;
}

export const FIXTURE_REQUESTS: FixtureRequestSpec[] = [
  {
    key: "open-standard",
    owner: "A",
    categorySlug: "appliances",
    title: titled("Buzdolabı arıyorum"),
    description: "Sentetik kabul talebi — no-frost buzdolabı, beyaz renk.",
    rawInput: "No-frost beyaz buzdolabı arıyorum.",
    status: "PUBLISHED",
    isUrgent: false,
    publishedDaysAgo: 2,
    budget: 25000,
    scenario: "A/B/C/D listing + detail read",
  },
  {
    key: "draft-edit",
    owner: "A",
    categorySlug: "technology",
    title: titled("Dizüstü bilgisayar arıyorum"),
    description: "Sentetik kabul taslağı — düzenle, kaydet, yeniden yükle turu için.",
    rawInput: "16 GB RAM dizüstü bilgisayar arıyorum.",
    status: "DRAFT",
    isUrgent: false,
    publishedDaysAgo: null,
    budget: null,
    scenario: "edit → save → reload round trip",
  },
  {
    key: "urgent-no-offer",
    owner: "B",
    categorySlug: "services",
    title: titled("Acil nakliye hizmeti arıyorum"),
    description: "Sentetik acil kabul talebi — teklif gelmediği için nudge cron'unu ölçer.",
    rawInput: "Acil nakliye hizmeti arıyorum.",
    status: "PUBLISHED",
    isUrgent: true,
    publishedDaysAgo: 3,
    budget: 12000,
    scenario: "urgent-nudge cron (no offer yet, nudge not sent)",
  },
  {
    key: "backfill-candidate",
    owner: "C",
    categorySlug: "appliances",
    title: titled("Bulaşık makinesi arıyorum"),
    description: "Sentetik kabul talebi — eşleşmesi bilerek yazılmaz, backfill turu üretmelidir.",
    rawInput: "Ankara için bulaşık makinesi arıyorum.",
    status: "PUBLISHED",
    isUrgent: false,
    publishedDaysAgo: 5,
    budget: 18000,
    scenario: "match-backfill cron + category provisioning",
  },
];

/** Requests that must NOT get a RequestMatch at seed time (backfill must create it). */
export const FIXTURE_REQUESTS_WITHOUT_MATCH: FixtureRequestKey[] = ["backfill-candidate"];

export type FixtureNotificationSpec = {
  key: string;
  recipient: PersonaKey;
  title: string;
  message: string;
  /** Request fixture the notification points at, if any. */
  request: FixtureRequestKey | null;
  scenario: string;
};

export const FIXTURE_NOTIFICATIONS: FixtureNotificationSpec[] = [
  {
    key: "unread-request-notification",
    recipient: "A",
    title: titled("Talebiniz yayımlandı"),
    message: "Sentetik kabul bildirimi — okundu yönlendirme sınırını ölçer.",
    request: "open-standard",
    scenario: "notification read-receipt redirect (must start UNREAD)",
  },
  {
    key: "unread-second-notification",
    recipient: "A",
    title: titled("Yeni teklif var"),
    message: "Sentetik kabul bildirimi — ikinci okunmamış satır, sayaç farkını görünür kılar.",
    request: "open-standard",
    scenario: "unread counter delta after read-receipt",
  },
];

export type FixtureConversationSpec = {
  key: string;
  /** Offer is submitted on this request by the supplier persona. */
  request: FixtureRequestKey;
  supplier: PersonaKey;
  buyer: PersonaKey;
  offerTitle: string;
  offerDescription: string;
  offerAmount: number;
  firstMessage: string;
  scenario: string;
};

export const FIXTURE_CONVERSATIONS: FixtureConversationSpec[] = [
  {
    key: "unread-conversation",
    request: "open-standard",
    supplier: "C",
    buyer: "A",
    offerTitle: titled("Buzdolabı teklifi"),
    offerDescription: "Sentetik kabul teklifi — konuşma ve okundu sınırı için.",
    offerAmount: 23500,
    firstMessage: titled("Sentetik kabul mesajı — alıcı bunu okumamış olmalıdır."),
    scenario: "conversation read-receipt (participant lastReadAt stays null)",
  },
];
