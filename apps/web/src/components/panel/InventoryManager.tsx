"use client";

import { FormEvent, useState } from "react";
import { Boxes, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export type InventoryItemDTO = {
  id: string;
  title: string;
  categoryLabel: string | null;
  quantity: number;
  unit: string;
  sku: string | null;
  city: string | null;
  notes: string | null;
};

export function InventoryManager({
  companyName,
  initialItems,
  canImport = false,
}: {
  companyName: string;
  initialItems: InventoryItemDTO[];
  /** Corporate inventory_import entitlement */
  canImport?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState(
    "name,sku,brand,model,quantity,price,city,category\n",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    categoryLabel: "Mobilya ve Ofis",
    quantity: "1",
    unit: "adet",
    city: "",
    sku: "",
    notes: "",
  });

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/company/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          categoryLabel: form.categoryLabel,
          quantity: Number(form.quantity),
          unit: form.unit,
          city: form.city || undefined,
          sku: form.sku || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        item?: InventoryItemDTO;
      };

      if (!response.ok || !data.ok || !data.item) {
        setError(data.message ?? "Eklenemedi.");
        return;
      }

      setItems((current) => [data.item!, ...current]);
      setForm({
        title: "",
        categoryLabel: "Mobilya ve Ofis",
        quantity: "1",
        unit: "adet",
        city: "",
        sku: "",
        notes: "",
      });
      setOpen(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  async function onImportCsv(event: FormEvent) {
    event.preventDefault();
    if (!canImport) return;
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const response = await fetch("/api/monetization/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", csv: csvText }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        created?: number;
        updated?: number;
        skipped?: number;
        errors?: Array<{ row: number; message: string }>;
      };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "İçe aktarma başarısız.");
        return;
      }
      setImportMessage(
        `Oluşturulan: ${data.created ?? 0} · Güncellenen: ${data.updated ?? 0} · Atlanan: ${data.skipped ?? 0}${
          data.errors?.length ? ` · Hata: ${data.errors.length}` : ""
        }`,
      );
      setImportOpen(false);
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/company/inventory/${id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message ?? "Silinemedi.");
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/45">
          {companyName} stokları · talep eşleştirmesinde kullanılır
        </p>
        <div className="flex flex-wrap gap-2">
          {canImport ? (
            <button
              type="button"
              onClick={() => setImportOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-teal-800/20 bg-white px-4 py-2.5 text-sm font-semibold text-teal-900"
            >
              CSV’den içe aktar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            Stok ekle
          </button>
        </div>
      </div>

      {importMessage ? (
        <p className="text-xs font-medium text-teal-800">{importMessage}</p>
      ) : null}

      {importOpen && canImport ? (
        <form
          onSubmit={onImportCsv}
          className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-semibold text-teal-950">CSV içe aktarma</p>
          <p className="mt-1 text-xs text-teal-950/50">
            Kolonlar: name|title, sku, brand, model, quantity, price, city, category
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="mt-3 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 font-mono text-xs outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            İçe aktar
          </button>
        </form>
      ) : null}

      {open && (
        <form
          onSubmit={onCreate}
          className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-black/40">Ürün adı</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Örn. Mesh ofis sandalyesi"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none focus:border-teal-700/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-black/40">Kategori</span>
              <input
                value={form.categoryLabel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryLabel: e.target.value }))
                }
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-black/40">Şehir</span>
              <input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="İstanbul"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-black/40">Adet</span>
              <input
                required
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-black/40">SKU</span>
              <input
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                placeholder="OPS-MESH-01"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-black/40">Not</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Renk, ölçü, montaj bilgisi…"
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-[#f7f8f6] px-3 py-2.5 text-sm outline-none"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-medium"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-[28px] border border-black/[0.06] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f7f2] text-teal-800">
            <Boxes className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Henüz stok yok</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-black/45">
            Elinizdeki ürünleri ekleyin; uygun talepler geldiğinde eşleşme
            skoru yükselir.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs text-black/45">
                    {[item.categoryLabel, item.city, item.sku]
                      .filter(Boolean)
                      .join(" · ") || "Stok kalemi"}
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-sm text-black/50">{item.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-teal-800">
                    {item.quantity} {item.unit}
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRemove(item.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Kaldır
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {error && !open && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
