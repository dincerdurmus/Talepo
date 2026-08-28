/**
 * Acceptance cleanup core.
 *
 * Deletes ONLY rows this acceptance harness created, in an order that respects
 * the schema's Restrict edges (Request/Offer/Message/Company all restrict User
 * deletion). The database client is injected, so the whole decision — scope
 * resolution, plan, execution — is measurable with a fake client and never
 * needs a connection.
 *
 * Ownership is proven by identity, not by text: a row qualifies only when it
 * belongs to a resolved acceptance persona id / company id / request id. The
 * marker prefix is an ADDITIONAL requirement on requests, never a sufficient
 * one — a foreign row that merely copies the marker into its title is not ours.
 */
import { ACCEPTANCE_COMPANY, PERSONAS } from "./acceptance-personas-v1.constants";
import { ACCEPTANCE_FIXTURE_PREFIX } from "./acceptance-fixtures-v1.constants";

/** Dependency order — a model may only be deleted after everything that restricts it. */
export const ACCEPTANCE_CLEANUP_ORDER = [
  "message",
  "conversationParticipant",
  "conversation",
  "offer",
  "requestMatch",
  "requestFieldValue",
  "notification",
  "request",
  "companyMember",
  "company",
  "user",
] as const;

export type CleanupModel = (typeof ACCEPTANCE_CLEANUP_ORDER)[number];

export type CleanupStep = {
  order: number;
  model: string;
  where: Record<string, unknown>;
};

export type CleanupScope = {
  userIds: string[];
  companyIds: string[];
  requestIds: string[];
  offerIds: string[];
  conversationIds: string[];
};

type IdRow = { id: string };

type ModelClient = {
  findMany: (args: { where: unknown; select?: unknown }) => Promise<IdRow[]>;
  count: (args: { where: unknown }) => Promise<number>;
  deleteMany: (args: { where: unknown }) => Promise<{ count: number }>;
};

export type CleanupDb = Record<CleanupModel, ModelClient>;

const PERSONA_EMAILS = Object.values(PERSONAS).map((persona) => persona.email);

function ids(rows: IdRow[]): string[] {
  return rows.map((row) => row.id).sort();
}

/**
 * Read-only resolution of what this harness owns. Every later delete is keyed to
 * these ids, so an empty result can only ever produce an empty plan.
 */
export async function resolveAcceptanceCleanupScope(db: CleanupDb): Promise<CleanupScope> {
  const userIds = ids(
    await db.user.findMany({
      where: { email: { in: PERSONA_EMAILS } },
      select: { id: true },
    }),
  );
  const companyIds = ids(
    await db.company.findMany({
      where: { slug: { in: [ACCEPTANCE_COMPANY.slug] } },
      select: { id: true },
    }),
  );

  const requestIds =
    userIds.length === 0
      ? []
      : ids(
          await db.request.findMany({
            where: {
              createdById: { in: userIds },
              title: { startsWith: ACCEPTANCE_FIXTURE_PREFIX },
            },
            select: { id: true },
          }),
        );

  const offerIds =
    userIds.length === 0 && requestIds.length === 0
      ? []
      : ids(
          await db.offer.findMany({
            where: {
              OR: [
                ...(requestIds.length > 0 ? [{ requestId: { in: requestIds } }] : []),
                ...(userIds.length > 0 ? [{ submittedById: { in: userIds } }] : []),
              ],
            },
            select: { id: true },
          }),
        );

  const conversationIds =
    offerIds.length === 0
      ? []
      : ids(
          await db.conversation.findMany({
            where: { offerId: { in: offerIds } },
            select: { id: true },
          }),
        );

  return { userIds, companyIds, requestIds, offerIds, conversationIds };
}

/**
 * Build the ordered delete plan. A model whose scope is empty is omitted, so a
 * fresh database produces an empty plan rather than an unconditional delete.
 */
export function buildAcceptanceCleanupPlan(scope: CleanupScope): CleanupStep[] {
  const byModel: Partial<Record<CleanupModel, Record<string, unknown>>> = {};

  if (scope.conversationIds.length > 0) {
    byModel.message = { conversationId: { in: scope.conversationIds } };
    byModel.conversationParticipant = { conversationId: { in: scope.conversationIds } };
    byModel.conversation = { id: { in: scope.conversationIds } };
  }
  if (scope.offerIds.length > 0) {
    byModel.offer = { id: { in: scope.offerIds } };
  }
  if (scope.requestIds.length > 0) {
    byModel.requestMatch = { requestId: { in: scope.requestIds } };
    byModel.requestFieldValue = { requestId: { in: scope.requestIds } };
    byModel.request = { id: { in: scope.requestIds } };
  }
  if (scope.userIds.length > 0) {
    byModel.notification = { userId: { in: scope.userIds } };
    byModel.user = { id: { in: scope.userIds } };
  }
  if (scope.companyIds.length > 0) {
    byModel.companyMember = { companyId: { in: scope.companyIds } };
    byModel.company = { id: { in: scope.companyIds } };
  }

  const steps: CleanupStep[] = [];
  for (const model of ACCEPTANCE_CLEANUP_ORDER) {
    const where = byModel[model];
    if (!where) continue;
    steps.push({ order: steps.length + 1, model, where });
  }
  return steps;
}

export type CleanupStepReport = { model: string; count: number };

export type CleanupReport = {
  dryRun: boolean;
  scope: CleanupScope;
  steps: CleanupStepReport[];
  deleted: number;
};

/**
 * Dry run counts; a real run deletes. Both walk the same plan, so what the plan
 * reports is exactly what the apply run removes.
 */
export async function executeAcceptanceCleanup(
  db: CleanupDb,
  options: { dryRun: boolean },
): Promise<CleanupReport> {
  const scope = await resolveAcceptanceCleanupScope(db);
  const plan = buildAcceptanceCleanupPlan(scope);
  const steps: CleanupStepReport[] = [];
  let deleted = 0;

  for (const step of plan) {
    const client = db[step.model as CleanupModel];
    if (options.dryRun) {
      const count = await client.count({ where: step.where });
      steps.push({ model: step.model, count });
      continue;
    }
    const result = await client.deleteMany({ where: step.where });
    steps.push({ model: step.model, count: result.count });
    deleted += result.count;
  }

  return { dryRun: options.dryRun, scope, steps, deleted };
}
