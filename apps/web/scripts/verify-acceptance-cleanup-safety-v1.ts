/**
 * Acceptance cleanup safety verifier.
 *
 * Drives the REAL cleanup core (`resolveAcceptanceCleanupScope`,
 * `buildAcceptanceCleanupPlan`, `executeAcceptanceCleanup`) against an in-memory
 * fake client. No database connection, no .env read, no secret printed.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/verify-acceptance-cleanup-safety-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  PERSONAS,
} from "./lib/acceptance-personas-v1.constants";
import { ACCEPTANCE_FIXTURE_PREFIX } from "./lib/acceptance-fixtures-v1.constants";
import {
  ACCEPTANCE_CLEANUP_ORDER,
  buildAcceptanceCleanupPlan,
  executeAcceptanceCleanup,
  resolveAcceptanceCleanupScope,
  type CleanupStep,
} from "./lib/acceptance-cleanup-core-v1";

const SCRIPTS_DIR = __dirname;
const problems: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  console.log(`  FAIL ${name} — ${detail}`);
  problems.push(name);
}

/* ------------------------------------------------------------------ */
/* Fake Prisma-shaped client                                           */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

function matches(row: Row, where: unknown): boolean {
  if (!where || typeof where !== "object") return true;
  const w = where as Record<string, unknown>;
  for (const [key, cond] of Object.entries(w)) {
    if (key === "AND") {
      if (!(cond as unknown[]).every((c) => matches(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(cond as unknown[]).some((c) => matches(row, c))) return false;
      continue;
    }
    const value = row[key];
    if (cond && typeof cond === "object") {
      const c = cond as Record<string, unknown>;
      if ("in" in c) {
        if (!(c.in as unknown[]).includes(value)) return false;
        continue;
      }
      if ("startsWith" in c) {
        if (typeof value !== "string" || !value.startsWith(String(c.startsWith))) return false;
        continue;
      }
      return false;
    }
    if (value !== cond) return false;
  }
  return true;
}

type FakeClient = {
  store: Store;
  deleteCalls: { model: string; where: unknown }[];
} & Record<string, unknown>;

const FAKE_MODELS = [
  // `category` is present so a Category delete is REACHABLE in the fake client:
  // without it the "categories survive" gates would pass vacuously.
  "category",
  "user",
  "company",
  "companyMember",
  "request",
  "requestMatch",
  "requestFieldValue",
  "notification",
  "offer",
  "conversation",
  "conversationParticipant",
  "message",
];

function makeClient(store: Store): FakeClient {
  const client = { store, deleteCalls: [] as { model: string; where: unknown }[] } as FakeClient;
  for (const model of FAKE_MODELS) {
    client[model] = {
      findMany: async ({ where }: { where?: unknown } = {}) =>
        (store[model] ?? []).filter((r) => matches(r, where)).map((r) => ({ ...r })),
      count: async ({ where }: { where?: unknown } = {}) =>
        (store[model] ?? []).filter((r) => matches(r, where)).length,
      deleteMany: async ({ where }: { where?: unknown } = {}) => {
        client.deleteCalls.push({ model, where });
        const before = store[model] ?? [];
        const kept = before.filter((r) => !matches(r, where));
        store[model] = kept;
        return { count: before.length - kept.length };
      },
    };
  }
  return client;
}

/* ------------------------------------------------------------------ */
/* Scene: acceptance rows + foreign rows that must survive             */
/* ------------------------------------------------------------------ */

const PERSONA_EMAILS = Object.values(PERSONAS).map((p) => p.email);

function buildStore(): Store {
  const acceptanceUsers = PERSONA_EMAILS.map((email, i) => ({
    id: `acc-user-${i}`,
    email,
  }));
  return {
    user: [
      ...acceptanceUsers,
      { id: "foreign-user-1", email: "real.customer@example.com" },
      // Near-miss: same local part shape, different domain — must NOT be deleted.
      { id: "foreign-user-2", email: "acceptance-v1-a@talepo.com" },
    ],
    company: [
      { id: "acc-company", slug: ACCEPTANCE_COMPANY.slug, createdById: "acc-user-3" },
      { id: "foreign-company", slug: "gercek-firma", createdById: "foreign-user-1" },
    ],
    companyMember: [
      { id: "acc-member", companyId: "acc-company", userId: "acc-user-4" },
      { id: "foreign-member", companyId: "foreign-company", userId: "foreign-user-1" },
    ],
    request: [
      { id: "acc-req-1", createdById: "acc-user-0", title: `${ACCEPTANCE_FIXTURE_PREFIX} talep 1` },
      { id: "acc-req-2", createdById: "acc-user-0", title: `${ACCEPTANCE_FIXTURE_PREFIX} talep 2` },
      // Acceptance user, but NOT a marked fixture row — must survive.
      { id: "unmarked-req", createdById: "acc-user-0", title: "elle acilmis talep" },
      { id: "foreign-req", createdById: "foreign-user-1", title: "gercek talep" },
      // Foreign owner who copied the marker into the title — must survive.
      {
        id: "foreign-req-marked",
        createdById: "foreign-user-1",
        title: `${ACCEPTANCE_FIXTURE_PREFIX} taklit`,
      },
    ],
    requestMatch: [
      { id: "acc-match", requestId: "acc-req-1", companyId: "acc-company" },
      { id: "foreign-match", requestId: "foreign-req", companyId: "foreign-company" },
    ],
    requestFieldValue: [
      { id: "acc-fv", requestId: "acc-req-1", fieldId: "f1" },
      { id: "foreign-fv", requestId: "foreign-req", fieldId: "f1" },
    ],
    notification: [
      { id: "acc-notif", userId: "acc-user-0", title: `${ACCEPTANCE_FIXTURE_PREFIX} bildirim` },
      { id: "foreign-notif", userId: "foreign-user-1", title: "gercek bildirim" },
    ],
    offer: [
      { id: "acc-offer", requestId: "acc-req-1", submittedById: "acc-user-2" },
      { id: "foreign-offer", requestId: "foreign-req", submittedById: "foreign-user-1" },
    ],
    conversation: [
      { id: "acc-conv", offerId: "acc-offer" },
      { id: "foreign-conv", offerId: "foreign-offer" },
    ],
    conversationParticipant: [
      { id: "acc-part", conversationId: "acc-conv", userId: "acc-user-0" },
      { id: "foreign-part", conversationId: "foreign-conv", userId: "foreign-user-1" },
    ],
    message: [
      { id: "acc-msg", conversationId: "acc-conv", senderUserId: "acc-user-2" },
      { id: "foreign-msg", conversationId: "foreign-conv", senderUserId: "foreign-user-1" },
    ],
  };
}

const FOREIGN_IDS: Record<string, string[]> = {
  user: ["foreign-user-1", "foreign-user-2"],
  company: ["foreign-company"],
  companyMember: ["foreign-member"],
  request: ["unmarked-req", "foreign-req", "foreign-req-marked"],
  requestMatch: ["foreign-match"],
  requestFieldValue: ["foreign-fv"],
  notification: ["foreign-notif"],
  offer: ["foreign-offer"],
  conversation: ["foreign-conv"],
  conversationParticipant: ["foreign-part"],
  message: ["foreign-msg"],
};

function idsOf(store: Store, model: string): string[] {
  return (store[model] ?? []).map((r) => String(r.id)).sort();
}

/* ------------------------------------------------------------------ */
/* Plan-shape assertions (shared by the real plan and the control)     */
/* ------------------------------------------------------------------ */

function whereIsScoped(where: unknown): boolean {
  if (!where || typeof where !== "object") return false;
  const entries = Object.entries(where as Record<string, unknown>);
  if (entries.length === 0) return false;
  return entries.every(([key, cond]) => {
    if (key === "OR" || key === "AND") {
      const list = cond as unknown[];
      return list.length > 0 && list.every((c) => whereIsScoped(c));
    }
    if (!cond || typeof cond !== "object") return false;
    const c = cond as Record<string, unknown>;
    if ("in" in c) return Array.isArray(c.in) && (c.in as unknown[]).length > 0;
    if ("startsWith" in c) return String(c.startsWith).length > 0;
    return false;
  });
}

function planIsSafe(steps: CleanupStep[]): { ok: boolean; reason: string } {
  for (const step of steps) {
    if (!whereIsScoped(step.where)) {
      return { ok: false, reason: `unscoped where on ${step.model}` };
    }
  }
  const order: readonly string[] = ACCEPTANCE_CLEANUP_ORDER;
  const seen = steps.map((s) => s.model);
  for (const model of seen) {
    if (!order.includes(model)) {
      return { ok: false, reason: `unknown model ${model}` };
    }
  }
  const positions = seen.map((m) => order.indexOf(m));
  for (let i = 1; i < positions.length; i += 1) {
    if (positions[i]! < positions[i - 1]!) {
      return { ok: false, reason: `dependency order violated at ${seen[i]}` };
    }
  }
  return { ok: true, reason: "" };
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log("=== verify-acceptance-cleanup-safety-v1 (FAKE CLIENT, NO DB) ===\n");

  console.log("P. Positive control — the detector must reject an unsafe plan");
  const unconditional = planIsSafe([{ order: 1, model: "user", where: {} }]);
  check("P1-detector-rejects-unconditional-where", !unconditional.ok, "unconditional where accepted");
  const emptyIn = planIsSafe([{ order: 1, model: "user", where: { id: { in: [] } } }]);
  check("P2-detector-rejects-empty-scope-step", !emptyIn.ok, "empty id list accepted");
  const wrongOrder = planIsSafe([
    { order: 1, model: "user", where: { id: { in: ["x"] } } },
    { order: 2, model: "request", where: { id: { in: ["y"] } } },
  ]);
  check("P3-detector-rejects-wrong-dependency-order", !wrongOrder.ok, "user-before-request accepted");

  console.log("\nA. Dry-run plan");
  const store = buildStore();
  const db = makeClient(store);
  const scope = await resolveAcceptanceCleanupScope(db as never);
  const plan = buildAcceptanceCleanupPlan(scope);
  const safety = planIsSafe(plan);
  check("A1-plan-is-scoped-and-ordered", safety.ok, safety.reason);
  check(
    "A2-plan-covers-every-seeded-model",
    new Set(plan.map((s) => s.model)).size === Object.keys(FOREIGN_IDS).length,
    `plan covers ${new Set(plan.map((s) => s.model)).size} models`,
  );

  const dryRun = await executeAcceptanceCleanup(db as never, { dryRun: true });
  check("A3-dry-run-issues-no-delete", db.deleteCalls.length === 0, `${db.deleteCalls.length} deletes issued`);
  check(
    "A4-dry-run-reports-per-model-counts",
    dryRun.steps.length === plan.length && dryRun.steps.every((s) => typeof s.count === "number"),
    "dry-run report is not per-model counted",
  );
  check(
    "A5-dry-run-leaves-store-untouched",
    idsOf(store, "user").length === 8 && idsOf(store, "request").length === 5,
    "dry-run mutated the store",
  );

  console.log("\nB. Execute — acceptance rows removed, foreign rows preserved");
  const executed = await executeAcceptanceCleanup(db as never, { dryRun: false });
  check(
    "B1-acceptance-rows-deleted",
    executed.deleted > 0 &&
      idsOf(store, "request").every((id) => !id.startsWith("acc-")) &&
      idsOf(store, "user").every((id) => !id.startsWith("acc-user")),
    "acceptance rows survived cleanup",
  );
  let preserved = true;
  for (const [model, ids] of Object.entries(FOREIGN_IDS)) {
    const remaining = idsOf(store, model);
    for (const id of ids) {
      if (!remaining.includes(id)) {
        preserved = false;
        console.log(`       lost foreign row ${model}:${id}`);
      }
    }
  }
  check("B2-foreign-rows-preserved", preserved, "cleanup deleted rows it does not own");
  check(
    "B3-marker-in-foreign-title-not-enough",
    idsOf(store, "request").includes("foreign-req-marked"),
    "a foreign row was deleted because its title carried the marker",
  );
  check(
    "B4-unmarked-persona-row-preserved",
    idsOf(store, "request").includes("unmarked-req"),
    "an unmarked row owned by a persona was deleted",
  );
  check(
    "B5-every-delete-call-was-scoped",
    db.deleteCalls.every((c) => whereIsScoped(c.where)),
    "an unscoped deleteMany reached the client",
  );

  console.log("\nC. Idempotence and empty scope");
  const before = db.deleteCalls.length;
  const second = await executeAcceptanceCleanup(db as never, { dryRun: false });
  check("C1-second-run-deletes-nothing", second.deleted === 0, `${second.deleted} rows deleted on rerun`);
  check(
    "C2-second-run-issues-no-delete-call",
    db.deleteCalls.length === before,
    "rerun issued deleteMany with an empty scope",
  );
  const emptyDb = makeClient({});
  const emptyPlan = buildAcceptanceCleanupPlan(await resolveAcceptanceCleanupScope(emptyDb as never));
  check("C3-empty-scope-produces-empty-plan", emptyPlan.length === 0, `${emptyPlan.length} steps on a fresh DB`);

  console.log("\nF. Core-commerce E2E rows are cleanup material");
  // The E2E script writes through the real production chain. If its requests do
  // not carry the canonical prefix, cleanup's marker predicate cannot reach them
  // and every run leaves permanent residue in the acceptance database — while
  // B4 deliberately preserves unmarked persona rows, so the residue is by design
  // unreachable. The prefix is what puts those rows inside the cleanup graph.
  let commerce: typeof import("./acceptance-core-commerce-v1") | null = null;
  try {
    commerce = await import("./acceptance-core-commerce-v1");
    check("F0-core-commerce-imports-without-env", true, "");
  } catch (error) {
    check(
      "F0-core-commerce-imports-without-env",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const commerceSrc = readFileSync(join(SCRIPTS_DIR, "acceptance-core-commerce-v1.ts"), "utf8");
  check(
    "F1-no-bare-sliced-title",
    !/title:\s*text\.slice\(/.test(commerceSrc),
    "the E2E request title is still a bare slice of the raw text — cleanup cannot reach it",
  );
  check(
    "F2-title-derives-from-canonical-prefix",
    /ACCEPTANCE_FIXTURE_PREFIX/.test(commerceSrc) &&
      !/\[acceptance:v1\]/.test(commerceSrc.replace(/\/\*[\s\S]*?\*\//g, "")),
    "the title does not derive from the canonical prefix, or a second literal was introduced",
  );

  if (commerce) {
    const builder = (commerce as { buildAcceptanceRequestTitle?: (t: string) => string })
      .buildAcceptanceRequestTitle;
    check("F3-title-builder-is-exported", typeof builder === "function", "no title builder export");
    if (typeof builder === "function") {
      const shortTitle = builder("Buzdolabı arıyorum");
      const longTitle = builder("x".repeat(400));
      check(
        "F4-short-title-carries-the-prefix",
        shortTitle.startsWith(ACCEPTANCE_FIXTURE_PREFIX),
        `title was ${shortTitle.slice(0, 40)}`,
      );
      check(
        "F5-long-title-keeps-the-prefix-and-the-cap",
        longTitle.startsWith(ACCEPTANCE_FIXTURE_PREFIX) && longTitle.length <= 120,
        `length ${longTitle.length}, starts ${longTitle.slice(0, 24)}`,
      );
    }
  }

  // A full E2E graph, marker-titled, must land inside the cleanup plan.
  const e2eStore = buildStore();
  const e2eRequestId = "e2e-req-1";
  e2eStore.request.push({
    id: e2eRequestId,
    createdById: "acc-user-0",
    title: `${ACCEPTANCE_FIXTURE_PREFIX} 140 ekran televizyon arıyorum`,
  });
  e2eStore.offer.push({ id: "e2e-offer-1", requestId: e2eRequestId, submittedById: "acc-user-2" });
  e2eStore.conversation.push({ id: "e2e-conv-1", offerId: "e2e-offer-1" });
  e2eStore.conversationParticipant.push({ id: "e2e-part-1", conversationId: "e2e-conv-1" });
  e2eStore.message.push({ id: "e2e-msg-1", conversationId: "e2e-conv-1", senderUserId: "acc-user-0" });
  e2eStore.notification.push({ id: "e2e-ntf-1", userId: "acc-user-2" });
  e2eStore.requestMatch.push({ id: "e2e-match-1", requestId: e2eRequestId });
  const e2eDb = makeClient(e2eStore);
  await executeAcceptanceCleanup(e2eDb as never, { dryRun: false });
  const survivingE2e = [
    ["request", "e2e-req-1"],
    ["offer", "e2e-offer-1"],
    ["conversation", "e2e-conv-1"],
    ["conversationParticipant", "e2e-part-1"],
    ["message", "e2e-msg-1"],
    ["notification", "e2e-ntf-1"],
    ["requestMatch", "e2e-match-1"],
  ].filter(([model, id]) => idsOf(e2eStore, model!).includes(id!));
  check(
    "F6-marked-e2e-graph-is-fully-removed",
    survivingE2e.length === 0,
    `left behind: ${survivingE2e.map(([m, i]) => `${m}:${i}`).join(", ")}`,
  );
  check(
    "F7-foreign-rows-still-survive-alongside-e2e",
    FOREIGN_IDS.request!.every((id) => idsOf(e2eStore, "request").includes(id)),
    "a foreign request was deleted while cleaning the E2E graph",
  );

  console.log("\nE. Global taxonomy is never cleanup material");
  // Category rows are the acceptance database's global taxonomy infrastructure,
  // not persona-owned fixtures: the seed provisions them through the shared
  // engine and a cleanup that removed them would break every later run.
  const categoryStore = buildStore();
  categoryStore.category = [
    { id: "cat-1", slug: "elektronik", isActive: true },
    { id: "cat-2", slug: "insaat", isActive: false },
  ];
  const categoryDb = makeClient(categoryStore);
  await executeAcceptanceCleanup(categoryDb as never, { dryRun: false });
  check(
    "E1-category-rows-survive-cleanup",
    idsOf(categoryStore, "category").length === 2,
    `${idsOf(categoryStore, "category").length} of 2 category rows survived`,
  );
  check(
    "E2-no-delete-call-targets-category",
    categoryDb.deleteCalls.every((c) => c.model !== "category"),
    "cleanup issued a deleteMany against Category",
  );
  // Built from a store that DOES hold category rows, so an added category step
  // would really appear here rather than being impossible to express.
  const planStore = buildStore();
  planStore.category = [{ id: "cat-3", slug: "teknoloji", isActive: true }];
  const categoryPlan = buildAcceptanceCleanupPlan(
    await resolveAcceptanceCleanupScope(makeClient(planStore) as never),
  );
  check(
    "E3-plan-never-contains-a-category-step",
    categoryPlan.every((step) => step.model.toLowerCase() !== "category"),
    "the cleanup plan contains a Category step",
  );
  check(
    "E4-inactive-category-still-inactive",
    categoryStore.category.find((row) => row.id === "cat-2")?.isActive === false,
    "cleanup or seed flipped an admin-controlled isActive flag",
  );
  // Positive control: the same fake client DOES delete categories when a step
  // asks it to, so E1/E2 measure a reachable path rather than a missing model.
  const controlStore = buildStore();
  controlStore.category = [{ id: "cat-1", slug: "elektronik", isActive: true }];
  const controlDb = makeClient(controlStore);
  await controlDb.category!.deleteMany({ where: { id: { in: ["cat-1"] } } });
  check(
    "E5-category-delete-is-reachable-in-the-fake-client",
    idsOf(controlStore, "category").length === 0,
    "the fake client cannot delete categories at all — E1/E2 would be vacuous",
  );

  console.log("\nD. Source invariants");
  const coreSrc = readFileSync(join(SCRIPTS_DIR, "lib", "acceptance-cleanup-core-v1.ts"), "utf8");
  const cliSrc = readFileSync(join(SCRIPTS_DIR, "cleanup-acceptance-v1.ts"), "utf8");
  const seedSrc = readFileSync(join(SCRIPTS_DIR, "seed-acceptance-fixtures-v1.ts"), "utf8");
  const fixtureSrc = readFileSync(
    join(SCRIPTS_DIR, "lib", "acceptance-fixtures-v1.constants.ts"),
    "utf8",
  );

  check(
    "D1-no-unconditional-deleteMany",
    !/deleteMany\(\s*\)/.test(coreSrc + cliSrc) &&
      !/deleteMany\(\s*\{\s*\}\s*\)/.test(coreSrc + cliSrc) &&
      !/deleteMany\(\s*\{\s*where:\s*\{\s*\}\s*\}\s*\)/.test(coreSrc + cliSrc),
    "an unconditional deleteMany exists in the cleanup source",
  );
  check(
    "D2-cli-loads-guarded-acceptance-env",
    /load-acceptance-env/.test(cliSrc) && /load-acceptance-env/.test(seedSrc),
    "a CLI does not go through the guarded acceptance env loader",
  );
  check(
    "D3-cli-requires-explicit-apply-flag",
    /--apply/.test(cliSrc),
    "cleanup CLI does not require an explicit apply flag",
  );
  check(
    "D4-fixtures-derive-marker-from-persona-authority",
    /from "\.\/acceptance-personas-v1\.constants"/.test(fixtureSrc) &&
      !/["']acceptance:v1["']/.test(fixtureSrc),
    "fixtures keep a second copy of the acceptance marker",
  );
  check(
    "D5-fixtures-carry-no-real-contact-data",
    !/@(?!talepo\.test)[a-z0-9.-]+\.[a-z]{2,}/i.test(fixtureSrc) &&
      !/\+90|05\d{2}[\s-]?\d{3}/.test(fixtureSrc),
    "fixture data contains a non-@talepo.test address or a phone number",
  );
  check(
    "D6-marker-constant-is-shared",
    ACCEPTANCE_FIXTURE_PREFIX.includes(ACCEPTANCE_MARKER),
    "fixture prefix is not derived from ACCEPTANCE_MARKER",
  );

  console.log(`\nPROBLEMS=${problems.length}`);
  if (problems.length > 0) console.log(problems.map((p) => `  - ${p}`).join("\n"));
  console.log("\n===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "PASS — cleanup deletes only marker-scoped acceptance rows, in dependency order, idempotently"
      : "FAIL — acceptance cleanup is not safe",
  );
  process.exit(problems.length === 0 ? 0 : 1);
}

void main();
