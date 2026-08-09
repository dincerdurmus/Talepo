import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ALERT_RULES_COOKIE,
  createAlertRule,
  parseAlertRules,
  serializeAlertRules,
  validateAlertRuleInput,
  type AlertRule,
} from "@/lib/alerts/alert-rules-store";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

function readRules(jar: Awaited<ReturnType<typeof cookies>>) {
  return parseAlertRules(jar.get(ALERT_RULES_COOKIE)?.value);
}

function writeRules(
  jar: Awaited<ReturnType<typeof cookies>>,
  rules: AlertRule[],
) {
  jar.set(ALERT_RULES_COOKIE, serializeAlertRules(rules), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

async function assertAlertRulesAccess() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );

  if (!entitlements.features.alert_rules) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, message: "Talep bildirim kuralları planınızda kapalı." },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, user, entitlements };
}

export async function GET() {
  try {
    const access = await assertAlertRulesAccess();
    if (!access.ok) return access.response;

    const jar = await cookies();
    const rules = readRules(jar);

    return NextResponse.json({
      ok: true,
      rules,
      storageNote:
        "Kurallar geçici olarak hesabınıza bağlı çerezde saklanır. Kalıcı depolama için AlertRule tablosu eklenecek.",
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Kurallar yüklenemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await assertAlertRulesAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as {
      action?: string;
      categoryKeyword?: string;
      cityKeyword?: string;
      id?: string;
      enabled?: boolean;
    };

    const jar = await cookies();
    let rules = readRules(jar);

    if (body.action === "create") {
      const validation = validateAlertRuleInput(body);
      if (validation) {
        return NextResponse.json({ ok: false, message: validation }, { status: 400 });
      }

      if (rules.length >= 20) {
        return NextResponse.json(
          { ok: false, message: "En fazla 20 kural ekleyebilirsiniz." },
          { status: 400 },
        );
      }

      const rule = createAlertRule({
        categoryKeyword: body.categoryKeyword ?? "",
        cityKeyword: body.cityKeyword ?? "",
      });
      rules = [rule, ...rules];
      writeRules(jar, rules);

      return NextResponse.json({ ok: true, rule, rules });
    }

    if (body.action === "toggle" && body.id) {
      rules = rules.map((rule) =>
        rule.id === body.id ? { ...rule, enabled: Boolean(body.enabled) } : rule,
      );
      writeRules(jar, rules);
      return NextResponse.json({ ok: true, rules });
    }

    if (body.action === "delete" && body.id) {
      rules = rules.filter((rule) => rule.id !== body.id);
      writeRules(jar, rules);
      return NextResponse.json({ ok: true, rules });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Kural kaydedilemedi." },
      { status: 500 },
    );
  }
}
