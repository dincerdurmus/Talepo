import { NextResponse } from "next/server";

import { createSubsystemLogger } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import {
  retrieveIyzicoPaymentCheckoutResult,
  retrieveIyzicoSubscriptionCheckoutResult,
} from "@/server/billing/iyzico-provider";
import { parseIyzicoConversationId } from "@/lib/billing/iyzico/conversation";

const log = createSubsystemLogger("billing.callback");

/**
 * Browser callback — presentation / linking only.
 * NEVER activates plan or grants credits (webhook authority).
 */
export async function POST(request: Request) {
  return handleCallback(request);
}

export async function GET(request: Request) {
  return handleCallback(request);
}

async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get("flow") || "subscription";
  let token = url.searchParams.get("token");

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as { token?: string };
        token = body.token || token;
      } else {
        const form = await request.formData();
        token = String(form.get("token") || token || "");
      }
    } catch {
      // keep query token
    }
  }

  const origin = url.origin;
  const pendingUrl = `${origin}/panel/plan?billing=pending`;

  if (!token) {
    log.info("billing.callback.missing_token", { outcome: "skipped" });
    return NextResponse.redirect(pendingUrl);
  }

  try {
    if (flow === "credit") {
      // Retrieve for observability / conversation check only — no credit grant.
      const result = await retrieveIyzicoPaymentCheckoutResult(token);
      log.info("billing.callback.credit.retrieved", {
        outcome: "success",
        context: {
          paymentStatus: result.paymentStatus || result.status,
          // never log full payload
        },
      });
      return NextResponse.redirect(pendingUrl);
    }

    const result = await retrieveIyzicoSubscriptionCheckoutResult(token);
    const data = result.data as
      | {
          referenceCode?: string;
          customerReferenceCode?: string;
          pricingPlanReferenceCode?: string;
          subscriptionStatus?: string;
        }
      | undefined;
    const referenceCode = data?.referenceCode;
    const conversationId = result.conversationId;
    const parsed = parseIyzicoConversationId(conversationId);

    if (referenceCode && parsed?.kind === "sub") {
      await prisma.billingSubscription.upsert({
        where: {
          subjectType_subjectId: {
            subjectType: parsed.subject.type,
            subjectId: parsed.subject.id,
          },
        },
        create: {
          subjectType: parsed.subject.type,
          subjectId: parsed.subject.id,
          planTier: parsed.planTier,
          status: "PENDING",
          provider: "iyzico",
          providerSubscriptionId: referenceCode,
          providerCustomerId: data?.customerReferenceCode ?? null,
        },
        update: {
          provider: "iyzico",
          providerSubscriptionId: referenceCode,
          providerCustomerId: data?.customerReferenceCode ?? null,
          planTier: parsed.planTier,
          // Stay PENDING — activation only via verified webhook
          status: "PENDING",
        },
      });
    }

    log.info("billing.callback.subscription.linked", {
      outcome: "success",
      context: {
        linked: Boolean(referenceCode && parsed),
        providerStatus: data?.subscriptionStatus,
      },
    });
  } catch (error) {
    log.warn("billing.callback.retrieve_failed", {
      outcome: "failure",
      errorCode:
        error instanceof Error ? error.name : "callback_retrieve_failed",
    });
  }

  return NextResponse.redirect(pendingUrl);
}
