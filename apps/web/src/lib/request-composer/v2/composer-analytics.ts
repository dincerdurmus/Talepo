/**
 * PII-free composer funnel events (client-safe).
 * Does not import server-only product-events / correlation (node:async_hooks).
 * Events stay in-memory for local sinks; never send raw text / health / files.
 */

export type ComposerAnalyticsEvent =
  | "composer_started"
  | "understanding_completed"
  | "understanding_failed"
  | "facts_corrected"
  | "category_clarification_shown"
  | "category_candidate_selected"
  | "category_multi_selected"
  | "category_none_of_these"
  | "category_other_domain"
  | "category_defer_to_talepo"
  | "focused_question_shown"
  | "focused_question_answered"
  | "focused_question_skipped"
  | "attachment_added"
  | "attachment_removed"
  | "attachment_failed"
  | "publish_summary_opened"
  | "request_published"
  | "composer_abandoned";

type ComposerEventRecord = {
  event: ComposerAnalyticsEvent;
  occurredAt: string;
  surface: "request_composer_v2";
  metadata?: Record<string, unknown>;
};

const MAX_RECENT = 100;
const recent: ComposerEventRecord[] = [];

type ComposerEventSink = (event: ComposerEventRecord) => void;
const sinks: ComposerEventSink[] = [];

export function addComposerEventSink(sink: ComposerEventSink): () => void {
  sinks.push(sink);
  return () => {
    const idx = sinks.indexOf(sink);
    if (idx >= 0) sinks.splice(idx, 1);
  };
}

export function getRecentComposerEvents(limit = 50): ComposerEventRecord[] {
  return recent.slice(-limit);
}

export function trackComposerEvent(
  event: ComposerAnalyticsEvent,
  metadata?: Record<string, unknown>,
): void {
  try {
    const record: ComposerEventRecord = {
      event,
      occurredAt: new Date().toISOString(),
      surface: "request_composer_v2",
      metadata: sanitizeComposerMetadata(metadata),
    };
    recent.push(record);
    if (recent.length > MAX_RECENT) {
      recent.splice(0, recent.length - MAX_RECENT);
    }
    for (const sink of sinks) sink(record);
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_TALEPO_COMPOSER_EVENTS === "1"
    ) {
      console.debug("[composer-event]", record.event, record.metadata);
    }
  } catch {
    // Telemetry must never break compose UX.
  }
}

function sanitizeComposerMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (
      /raw|text|description|content|email|phone|health|file|url/i.test(key)
    ) {
      continue;
    }
    if (typeof value === "string" && value.length > 80) continue;
    out[key] = value;
  }
  return out;
}
