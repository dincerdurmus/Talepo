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

/** Test helper */
export function clearRecentLogs(): void {
  recent.length = 0;
}

export function getRecentLogs(limit = 50): OperationalLogEvent[] {
  return recent.slice(-limit);
}

export function logOperational(
  partial: Omit<OperationalLogEvent, "timestamp"> & { timestamp?: string },
): OperationalLogEvent {
  const store = getCorrelationStore();
  const entry: OperationalLogEvent = {
    timestamp: partial.timestamp ?? new Date().toISOString(),
    level: partial.level,
    event: partial.event,
    service: partial.service,
    correlationId: partial.correlationId ?? store?.correlationId,
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
    for (const sink of sinks) sink(entry);
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

export function createSubsystemLogger(service: string) {
  return {
    debug(event: string, context?: Record<string, unknown>) {
      return logOperational({ level: "debug", event, service, context });
    },
    info(event: string, extras?: LogExtras) {
      return logOperational({
        level: "info",
        event,
        service,
        ...extras,
      });
    },
    warn(event: string, extras?: LogExtras) {
      return logOperational({ level: "warn", event, service, ...extras });
    },
    error(event: string, extras?: LogExtras) {
      return logOperational({
        level: "error",
        event,
        service,
        outcome: extras?.outcome ?? "failure",
        ...extras,
      });
    },
  };
}
