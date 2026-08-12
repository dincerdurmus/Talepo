/**
 * Shadow mode foundation — compare candidate intelligence without changing production decisions.
 * Phase 4A: types + contract only. No deep-LLM shadow runner.
 */

export type ShadowRolloutMode = "OFF" | "SHADOW" | "LIMITED" | "ON";

export type ShadowSubsystem =
  | "understanding"
  | "matcher"
  | "ranking"
  | "price_strategy";

export type ShadowCandidateEvent = {
  kind: "shadow_candidate";
  subsystem: ShadowSubsystem;
  mode: ShadowRolloutMode;
  /** Production decision fingerprint (opaque). */
  productionDecisionId: string;
  /** Candidate decision fingerprint (opaque). */
  candidateDecisionId: string;
  correlationId?: string;
  requestId?: string;
  comparedAt: string;
  /** Safe structured diffs only — never raw free text. */
  diffSummary?: {
    equal: boolean;
    changedKeys?: string[];
  };
  versions?: {
    production?: string;
    candidate?: string;
  };
};

export type ShadowEventSink = (event: ShadowCandidateEvent) => void;

const sinks: ShadowEventSink[] = [];
const recent: ShadowCandidateEvent[] = [];

export function addShadowEventSink(sink: ShadowEventSink): () => void {
  sinks.push(sink);
  return () => {
    const idx = sinks.indexOf(sink);
    if (idx >= 0) sinks.splice(idx, 1);
  };
}

export function clearRecentShadowEvents(): void {
  recent.length = 0;
}

export function getRecentShadowEvents(limit = 50): ShadowCandidateEvent[] {
  return recent.slice(-limit);
}

/**
 * Emit a shadow comparison. Callers must ensure production path is unchanged.
 */
export function emitShadowCandidate(event: Omit<ShadowCandidateEvent, "kind" | "comparedAt"> & {
  comparedAt?: string;
}): ShadowCandidateEvent {
  const full: ShadowCandidateEvent = {
    kind: "shadow_candidate",
    comparedAt: event.comparedAt ?? new Date().toISOString(),
    ...event,
  };
  recent.push(full);
  if (recent.length > 100) recent.splice(0, recent.length - 100);
  for (const sink of sinks) sink(full);
  return full;
}

export function resolveShadowMode(
  envValue: string | undefined,
  defaultMode: ShadowRolloutMode = "OFF",
): ShadowRolloutMode {
  const v = (envValue ?? defaultMode).toUpperCase();
  if (v === "OFF" || v === "SHADOW" || v === "LIMITED" || v === "ON") return v;
  return defaultMode;
}
