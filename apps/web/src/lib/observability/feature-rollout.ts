import type { ShadowRolloutMode } from "./shadow";
import { resolveShadowMode } from "./shadow";

/**
 * Minimal rollout extension point for risky intelligence capabilities.
 * Not a full feature-flag platform.
 */

export type FeatureRolloutMode = ShadowRolloutMode;

export type FeatureRolloutConfig = {
  key: string;
  mode: FeatureRolloutMode;
  /** Optional percentage for LIMITED (0-100). */
  limitedPercent?: number;
};

export function getFeatureRollout(key: string): FeatureRolloutConfig {
  const envKey = `TALEPO_ROLLOUT_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const mode = resolveShadowMode(process.env[envKey], "OFF");
  const pctRaw = process.env[`${envKey}_PERCENT`];
  const limitedPercent = pctRaw ? Number(pctRaw) : undefined;
  return {
    key,
    mode,
    limitedPercent:
      limitedPercent !== undefined && Number.isFinite(limitedPercent)
        ? Math.max(0, Math.min(100, limitedPercent))
        : undefined,
  };
}

export function shouldAffectProduction(mode: FeatureRolloutMode): boolean {
  return mode === "ON" || mode === "LIMITED";
}

export function shouldRunShadow(mode: FeatureRolloutMode): boolean {
  return mode === "SHADOW" || mode === "LIMITED" || mode === "ON";
}
