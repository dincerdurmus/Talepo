import { getCorrelationStore } from "./correlation";
import { redactObject } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type OperationalOutcome = "success" | "failure" | "fallback" | "denied" | "skipped";

export type OperationalLogEvent = {
  timestamp: string;
  level: LogLevel;
  /** Operational event name, e.g. request.publish.completed */
  event: string;
  service: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  companyId?: string;
  durationMs?: number;
  outcome?: OperationalOutcome;
  errorCode?: string;
  context?: Record<string, unknown>;
};

export type LogSink = (entry: OperationalLogEvent) => void;

const sinks: LogSink[] = [];
const recent: OperationalLogEvent[] = [];
const MAX_RECENT = 200;

function defaultSink(entry: OperationalLogEvent): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function addLogSink(sink: LogSink): () => void {
  sinks.push(sink);
  return () => {
    const idx = sinks.indexOf(sink);
    if (idx >= 0) sinks.splice(idx, 1);
  };
}

/**
 * DW-1 (2026-08-31): fırlatan bir sink log ÇAĞIRANINI kıramaz ve diğer
 * sink'leri açlığa mahkûm edemez — teslim sink başına yalıtılır, düşen
 * teslim sayaçla görünür (sessiz kayıp yok). verify-log-sink-chain-v1 ölçer.
 */
let sinkDeliveryFailures = 0;

export function getSinkDeliveryFailures(): number {
  return sinkDeliveryFailures;
}

function dispatchToSinks(entry: OperationalLogEvent): void {
  for (const sink of [...sinks]) {
    try {
      sink(entry);
    } catch {
      sinkDeliveryFailures += 1;
    }
  }
}

/** Test helper */
export function clearRecentLogs(): void {
  recent.length = 0;
}

export function getRecentLogs(limit = 50): OperationalLogEvent[] {
  return recent.slice(-limit);
}

/**
 * Per-call logging options. Additive: omitting this argument preserves the
 * historical behaviour exactly for every existing caller.
 */
export type LogOptions = {
  /**
   * Do not inherit actor identity (`userId`, `companyId`) or the transport
   * `requestId` from the ambient correlation store. Explicitly supplied values
   * are still honoured; only the implicit fallback is disabled.
   *
   * Used by privacy-scoped telemetry that must not tie an event to a person —
   * see `@/server/request/fanout-telemetry`. `correlationId` is deliberately
   * still inherited: it is an opaque trace id, not actor identity.
   */
  omitActorCorrelation?: boolean;
};

export function logOperational(
  partial: Omit<OperationalLogEvent, "timestamp"> & { timestamp?: string },
  options?: LogOptions,
): OperationalLogEvent {
  const store = options?.omitActorCorrelation ? undefined : getCorrelationStore();
  const entry: OperationalLogEvent = {
    timestamp: partial.timestamp ?? new Date().toISOString(),
    level: partial.level,
    event: partial.event,
    service: partial.service,
    correlationId: partial.correlationId ?? getCorrelationStore()?.correlationId,
    requestId: partial.requestId ?? store?.requestId,
    userId: partial.userId ?? store?.userId,
    companyId: partial.companyId ?? store?.companyId,
    durationMs: partial.durationMs,
    outcome: partial.outcome,
    errorCode: partial.errorCode,
    context: partial.context ? redactObject(partial.context) : undefined,
  };

  recent.push(entry);
  if (recent.length > MAX_RECENT) {
    recent.splice(0, recent.length - MAX_RECENT);
  }

  if (sinks.length === 0) {
    defaultSink(entry);
  } else {
    dispatchToSinks(entry);
  }

  return entry;
}

type LogExtras = {
  outcome?: OperationalOutcome;
  durationMs?: number;
  errorCode?: string;
  context?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
  companyId?: string;
  correlationId?: string;
};

/**
 * `options` is additive and defaults to today's behaviour — existing callers
 * that pass only a service name are unaffected.
 */
export function createSubsystemLogger(service: string, options?: LogOptions) {
  return {
    debug(event: string, context?: Record<string, unknown>) {
      return logOperational({ level: "debug", event, service, context }, options);
    },
    info(event: string, extras?: LogExtras) {
      return logOperational(
        {
          level: "info",
          event,
          service,
          ...extras,
        },
        options,
      );
    },
    warn(event: string, extras?: LogExtras) {
      return logOperational({ level: "warn", event, service, ...extras }, options);
    },
    error(event: string, extras?: LogExtras) {
      return logOperational(
        {
          level: "error",
          event,
          service,
          outcome: extras?.outcome ?? "failure",
          ...extras,
        },
        options,
      );
    },
  };
}
