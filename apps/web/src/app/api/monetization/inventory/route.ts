import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  importInventoryRows,
  parseInventoryCsv,
} from "@/server/monetization/inventory-import";
import { matchRequestToInventory } from "@/server/monetization/inventory-matching";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      action?: string;
      csv?: string;
      requestId?: string;
    };

    if (body.action === "import") {
      const ctx = await requireCompanyFeature(user.id, "inventory_import");
      if (!body.csv?.trim()) {
        return NextResponse.json({ ok: false, message: "CSV içeriği zorunlu." }, { status: 400 });
      }
      const rows = parseInventoryCsv(body.csv);
      const result = await importInventoryRows(ctx.companyId, rows);
      return NextResponse.json({ ok: true, result });
    }

    if (body.action === "match" && body.requestId) {
      const ctx = await requireCompanyFeature(user.id, "hidden_inventory");
      const matches = await matchRequestToInventory(body.requestId, ctx.companyId);
      return NextResponse.json({ ok: true, matches });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Envanter işlemi başarısız." }, { status: 500 });
  }
}
