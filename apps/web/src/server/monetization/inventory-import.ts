import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { InventoryImportResult } from "@/lib/monetization/types";

import { buildInventoryAttributesForWrite } from "./inventory-projection";

export type InventoryImportRow = {
  name: string;
  sku?: string;
  brand?: string;
  model?: string;
  quantity?: number;
  price?: number;
  city?: string;
  categoryLabel?: string;
};

export function parseInventoryCsv(text: string): InventoryImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);

  const rows: InventoryImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",").map((c) => c.trim());
    const name = cols[idx("name")] ?? cols[idx("title")] ?? cols[0];
    if (!name) continue;
    rows.push({
      name,
      sku: cols[idx("sku")] || undefined,
      brand: cols[idx("brand")] || undefined,
      model: cols[idx("model")] || undefined,
      quantity: cols[idx("quantity")]
        ? Number(cols[idx("quantity")])
        : undefined,
      price: cols[idx("price")] ? Number(cols[idx("price")]) : undefined,
      city: cols[idx("city")] || undefined,
      categoryLabel: cols[idx("category")] || undefined,
    });
  }
  return rows;
}

export function validateInventoryRow(row: InventoryImportRow): string | null {
  if (!row.name?.trim()) return "Ürün adı zorunlu.";
  if (row.quantity !== undefined && (!Number.isFinite(row.quantity) || row.quantity < 1)) {
    return "Geçersiz adet.";
  }
  if (row.price !== undefined && (!Number.isFinite(row.price) || row.price < 0)) {
    return "Geçersiz fiyat.";
  }
  return null;
}

export async function importInventoryRows(
  companyId: string,
  rows: InventoryImportRow[],
): Promise<InventoryImportResult> {
  const result: InventoryImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const err = validateInventoryRow(row);
    if (err) {
      result.errors.push({ row: i + 1, message: err });
      result.skipped += 1;
      continue;
    }

    const name = row.name.trim();
    const brand = row.brand?.trim() || null;
    const model = row.model?.trim() || null;
    const categoryLabel = row.categoryLabel?.trim() || null;
    const city = row.city?.trim() || null;
    const { attributes } = buildInventoryAttributesForWrite({
      name,
      brand,
      model,
      categoryLabel,
      city,
      quantity: row.quantity ?? 1,
      sku: row.sku?.trim() || null,
    });

    if (row.sku) {
      const existing = await prisma.companyInventoryItem.findFirst({
        where: { companyId, sku: row.sku },
        select: { id: true, attributes: true },
      });
      if (existing) {
        const { attributes: nextAttrs } = buildInventoryAttributesForWrite(
          {
            name,
            brand,
            model,
            categoryLabel,
            city,
            quantity: row.quantity ?? 1,
            sku: row.sku.trim(),
          },
          existing.attributes,
        );
        await prisma.companyInventoryItem.update({
          where: { id: existing.id },
          data: {
            name,
            title: name,
            brand,
            model,
            quantity: row.quantity ?? 1,
            price: row.price ?? null,
            city,
            categoryLabel,
            attributes: nextAttrs as Prisma.InputJsonValue,
          },
        });
        result.updated += 1;
        continue;
      }
    }

    await prisma.companyInventoryItem.create({
      data: {
        companyId,
        name,
        title: name,
        sku: row.sku?.trim() || null,
        brand,
        model,
        quantity: row.quantity ?? 1,
        price: row.price ?? null,
        city,
        categoryLabel,
        attributes: attributes as Prisma.InputJsonValue,
      },
    });
    result.created += 1;
  }

  return result;
}

/** ERP adapter boundary — no real integration in this phase. */
export interface ErpInventoryAdapter {
  fetchItems(companyId: string): Promise<InventoryImportRow[]>;
}

export class UnconfiguredErpAdapter implements ErpInventoryAdapter {
  async fetchItems(): Promise<InventoryImportRow[]> {
    return [];
  }
}

export const erpAdapter: ErpInventoryAdapter = new UnconfiguredErpAdapter();
