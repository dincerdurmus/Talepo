import { createHmac, timingSafeEqual } from "node:crypto";

import {
  isOfferAcquisitionSource,
  OFFER_ATTRIBUTION_TOUCH_TTL_MS,
  type OfferAcquisitionSource,
} from "@/lib/offer/offer-attribution";

export type RadarTierAtExposure = "RADAR" | "FAST" | "HOT";

export type OfferAttributionTouchPayload = {
  v: 1;
  uid: string;
  rid: string;
  src: Exclude<OfferAcquisitionSource, "UNKNOWN">;
  ssid?: string;
  arid?: string;
  omid?: string;
  tier?: RadarTierAtExposure;
  exp: number;
};

function signingKey(): Buffer {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET || "talepo-dev-attr")
    .update("offer-attribution-touch-v1")
    .digest();
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", signingKey())
    .update(payloadB64)
    .digest("base64url");
}

export function issueOfferAttributionTouch(input: {
  userId: string;
  requestId: string;
  source: Exclude<OfferAcquisitionSource, "UNKNOWN">;
  savedSearchId?: string | null;
  alertRuleId?: string | null;
  opportunityMatchId?: string | null;
  radarTier?: RadarTierAtExposure | null;
  nowMs?: number;
  ttlMs?: number;
}): string {
  const now = input.nowMs ?? Date.now();
  const ttl = input.ttlMs ?? OFFER_ATTRIBUTION_TOUCH_TTL_MS;
  const payload: OfferAttributionTouchPayload = {
    v: 1,
    uid: input.userId,
    rid: input.requestId,
    src: input.source,
    exp: now + ttl,
  };
  if (input.savedSearchId) payload.ssid = input.savedSearchId;
  if (input.alertRuleId) payload.arid = input.alertRuleId;
  if (input.opportunityMatchId) payload.omid = input.opportunityMatchId;
  if (input.radarTier) payload.tier = input.radarTier;

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function verifyOfferAttributionTouch(
  token: string | null | undefined,
  expected: { userId: string; requestId: string; nowMs?: number },
): OfferAttributionTouchPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  try {
    const expectedSig = Buffer.from(signPayload(payloadB64), "base64url");
    const actualSig = Buffer.from(sig, "base64url");
    if (
      expectedSig.length !== actualSig.length ||
      !timingSafeEqual(expectedSig, actualSig)
    ) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as {
      v?: number;
      uid?: string;
      rid?: string;
      src?: string;
      exp?: number;
      ssid?: string;
      arid?: string;
      omid?: string;
      tier?: string;
    };

    if (parsed.v !== 1) return null;
    if (typeof parsed.uid !== "string" || parsed.uid !== expected.userId) {
      return null;
    }
    if (typeof parsed.rid !== "string" || parsed.rid !== expected.requestId) {
      return null;
    }
    if (
      typeof parsed.src !== "string" ||
      !isOfferAcquisitionSource(parsed.src) ||
      parsed.src === "UNKNOWN"
    ) {
      return null;
    }
    const source = parsed.src;
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    const now = expected.nowMs ?? Date.now();
    if (parsed.exp <= now) return null;

    return {
      v: 1,
      uid: parsed.uid,
      rid: parsed.rid,
      src: source,
      exp: parsed.exp,
      ssid: typeof parsed.ssid === "string" ? parsed.ssid : undefined,
      arid: typeof parsed.arid === "string" ? parsed.arid : undefined,
      omid: typeof parsed.omid === "string" ? parsed.omid : undefined,
      tier:
        parsed.tier === "RADAR" ||
        parsed.tier === "FAST" ||
        parsed.tier === "HOT"
          ? parsed.tier
          : undefined,
    };
  } catch {
    return null;
  }
}
