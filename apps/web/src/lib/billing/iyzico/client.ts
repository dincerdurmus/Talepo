import { createSubsystemLogger } from "@/lib/observability/logger";
import {
  evaluateProviderHealth,
  recordProviderOperationalMetric,
  type ProviderSample,
} from "@/lib/observability/provider-health";

import { buildIyzicoAuthorization } from "./auth";
import type { IyzicoConfig } from "./config";

const log = createSubsystemLogger("billing.iyzico");

const telemetrySamples: ProviderSample[] = [];
const MAX_SAMPLES = 50;

function pushSample(sample: ProviderSample) {
  telemetrySamples.push(sample);
  if (telemetrySamples.length > MAX_SAMPLES) {
    telemetrySamples.splice(0, telemetrySamples.length - MAX_SAMPLES);
  }
}

export function getIyzicoTelemetrySamples(): ProviderSample[] {
  return [...telemetrySamples];
}

export function getIyzicoProviderHealth() {
  return evaluateProviderHealth("iyzico", telemetrySamples);
}

export type IyzicoApiResult<T> = T & {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  systemTime?: number;
  conversationId?: string;
};

export async function iyzicoRequest<T>(input: {
  config: IyzicoConfig;
  method: "GET" | "POST";
  path: string;
  body?: Record<string, unknown>;
  operation: string;
}): Promise<IyzicoApiResult<T>> {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const bodyText =
    input.method === "GET" || !input.body ? "" : JSON.stringify(input.body);
  const { authorization, randomKey } = buildIyzicoAuthorization({
    apiKey: input.config.apiKey,
    secretKey: input.config.secretKey,
    uriPath: path,
    body: bodyText,
  });

  const started = Date.now();
  try {
    const response = await fetch(`${input.config.baseUrl}${path}`, {
      method: input.method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "x-iyzi-rnd": randomKey,
      },
      body: bodyText || undefined,
    });

    const text = await response.text();
    let json: IyzicoApiResult<T>;
    try {
      json = JSON.parse(text) as IyzicoApiResult<T>;
    } catch {
      pushSample({
        provider: "iyzico",
        durationMs: Date.now() - started,
        success: false,
        errorCode: "parse_error",
      });
      recordProviderOperationalMetric({
        provider: "iyzico",
        operation: input.operation,
        durationMs: Date.now() - started,
        success: false,
        failureCategory: "parse_error",
      });
      throw new Error("iyzico_invalid_json");
    }

    const success = json.status === "success" || response.ok;
    pushSample({
      provider: "iyzico",
      durationMs: Date.now() - started,
      success: Boolean(success && json.status !== "failure"),
      errorCode: json.errorCode,
    });
    recordProviderOperationalMetric({
      provider: "iyzico",
      operation: input.operation,
      durationMs: Date.now() - started,
      success: Boolean(success && json.status !== "failure"),
      failureCategory: json.errorCode,
    });

    log.info(
      json.status === "failure"
        ? "billing.iyzico.request.failed"
        : "billing.iyzico.request.ok",
      {
        outcome: json.status === "failure" ? "failure" : "success",
        durationMs: Date.now() - started,
        errorCode: json.errorCode,
        context: {
          operation: input.operation,
          environment: input.config.environment,
          httpStatus: response.status,
        },
      },
    );

    return json;
  } catch (error) {
    pushSample({
      provider: "iyzico",
      durationMs: Date.now() - started,
      success: false,
      errorCode: "transport",
    });
    recordProviderOperationalMetric({
      provider: "iyzico",
      operation: input.operation,
      durationMs: Date.now() - started,
      success: false,
      failureCategory: "transport",
    });
    throw error;
  }
}
