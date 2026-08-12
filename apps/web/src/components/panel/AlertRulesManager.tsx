"use client";

import { useCallback, useMemo, useState } from "react";
import { BellRing, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";

import {
  summarizeCanonicalFilter,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { getFilterSelectOptions } from "@/lib/explore/category-filters";
import { getAlertAttributeDefs } from "@/lib/monetization/alert-rule-attributes";

type CategoryOption = { id: string; name: string; slug: string };

type AlertRuleRow = {
  id: string;
  name: string;
  isActive: boolean;
  categoryId: string | null;
  city: string | null;
  district: string | null;
  minBudget: string | number | null;
  maxBudget: string | number | null;
  keywords: string | null;
  attributes: Record<string, unknown> | null;
  discoveryFilter?: CanonicalDiscoveryFilter | null;
  createdAt: string;
  updatedAt: string;
  category?: CategoryOption | null;
};

type AlertRulesManagerProps = {
  initialRules: AlertRuleRow[];
  categories: CategoryOption[];
};

const emptyForm = {
  name: "",
  categoryId: "",
  city: "",
  district: "",
  minBudget: "",
  maxBudget: "",
  keywords: "",
};

function toNumberOrNull(raw: string): number | null {
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function AlertRulesManager({
  initialRules,
  categories,
}: AlertRulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [attributeForm, setAttributeForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedCategorySlug = useMemo(
    () => categories.find((c) => c.id === form.categoryId)?.slug ?? "",
    [categories, form.categoryId],
  );
  const attributeDefs = useMemo(
    () => getAlertAttributeDefs(selectedCategorySlug || null),
    [selectedCategorySlug],
  );

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/monetization/alerts");
      const data = (await response.json()) as {
        ok?: boolean;
        rules?: AlertRuleRow[];
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "Kurallar yüklenemedi.");
      }
      setRules(data.rules ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Kurallar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Kural adı zorunlu.");
      setSaving(false);
      return;
    }

    const payload = {
      action: editingId ? "update" : "create",
      ...(editingId ? { id: editingId } : {}),
      name,
      categoryId: form.categoryId || null,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      minBudget: toNumberOrNull(form.minBudget),
      maxBudget: toNumberOrNull(form.maxBudget),
      keywords: form.keywords.trim() || null,
      attributes:
        Object.keys(attributeForm).length > 0
          ? Object.fromEntries(
              Object.entries(attributeForm).filter(([, v]) => v.trim()),
            )
          : null,
    };

    try {
      const response = await fetch("/api/monetization/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        rule?: AlertRuleRow;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Kural kaydedilemedi.");
      }

      if (editingId) {
        await loadRules();
      } else if (data.rule) {
        setRules((current) => [data.rule!, ...current]);
      }

      setForm(emptyForm);
      setAttributeForm({});
      setEditingId(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Kural kaydedilemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(rule: AlertRuleRow) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      categoryId: rule.categoryId ?? "",
      city: rule.city ?? "",
      district: rule.district ?? "",
      minBudget: rule.minBudget != null ? String(rule.minBudget) : "",
      maxBudget: rule.maxBudget != null ? String(rule.maxBudget) : "",
      keywords: rule.keywords ?? "",
    });
    const attrs = rule.attributes ?? {};
    setAttributeForm(
      Object.fromEntries(
        Object.entries(attrs).map(([k, v]) => [k, String(v ?? "")]),
      ),
    );
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setAttributeForm({});
  }

  async function toggleRule(id: string, isActive: boolean) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, isActive } : rule)),
    );

    const response = await fetch("/api/monetization/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, isActive }),
    });

    if (!response.ok) void loadRules();
  }

  async function deleteRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id));

    const response = await fetch("/api/monetization/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });

    if (!response.ok) void loadRules();
  }

  function ruleSummary(rule: AlertRuleRow) {
    if (rule.discoveryFilter) {
      const canonical = summarizeCanonicalFilter(rule.discoveryFilter);
      const extras: string[] = [];
      if (rule.city && !rule.discoveryFilter.location?.city) extras.push(rule.city);
      if (rule.district) extras.push(rule.district);
      return extras.length ? `${canonical} · ${extras.join(" · ")}` : canonical;
    }
    const parts: string[] = [];
    if (rule.category?.name) parts.push(rule.category.name);
    if (rule.city) parts.push(rule.city);
    if (rule.district) parts.push(rule.district);
    if (rule.keywords) parts.push(`"${rule.keywords}"`);
    if (rule.minBudget != null || rule.maxBudget != null) {
      parts.push(
        `Bütçe: ${rule.minBudget ?? "—"} – ${rule.maxBudget ?? "—"} ₺`,
      );
    }
    return parts.length > 0 ? parts.join(" · ") : "Tüm talepler";
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-teal-900/10 bg-gradient-to-br from-teal-50/40 via-white to-white p-6 shadow-[0_16px_55px_rgba(15,60,50,0.06)]">
        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-900 text-white">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-teal-950">
              {editingId ? "Kuralı düzenle" : "Yeni alarm kuralı"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-teal-950/50">
              Kategori, bölge, bütçe ve anahtar kelimeye göre eşleşen yeni
              talepler bildirim olarak iletilir.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative mt-5 grid gap-3 sm:grid-cols-2"
        >
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Kural adı *
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Örn. İstanbul mobilya talepleri"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Kategori
            </span>
            <select
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            >
              <option value="">Tüm kategoriler</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Anahtar kelimeler
            </span>
            <input
              value={form.keywords}
              onChange={(e) =>
                setForm((f) => ({ ...f, keywords: e.target.value }))
              }
              placeholder="Örn. ofis, baskı, yazılım"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Şehir
            </span>
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Örn. İstanbul"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              İlçe
            </span>
            <input
              value={form.district}
              onChange={(e) =>
                setForm((f) => ({ ...f, district: e.target.value }))
              }
              placeholder="Örn. Kadıköy"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Min bütçe (₺)
            </span>
            <input
              value={form.minBudget}
              onChange={(e) =>
                setForm((f) => ({ ...f, minBudget: e.target.value }))
              }
              placeholder="ör. 10000"
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-teal-950/45">
              Max bütçe (₺)
            </span>
            <input
              value={form.maxBudget}
              onChange={(e) =>
                setForm((f) => ({ ...f, maxBudget: e.target.value }))
              }
              placeholder="ör. 500000"
              inputMode="numeric"
              className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
            />
          </label>

          {attributeDefs.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-950/45">
                Kategoriye özel kriterler
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {attributeDefs.map((def) => {
                  const value = attributeForm[def.param] ?? "";
                  if (def.input === "select") {
                    const options = getFilterSelectOptions(
                      selectedCategorySlug,
                      def.fieldKey,
                    );
                    return (
                      <label key={def.param} className="block">
                        <span className="mb-2 block text-xs font-medium text-teal-950/45">
                          {def.label}
                        </span>
                        <select
                          value={value}
                          onChange={(e) =>
                            setAttributeForm((a) => ({
                              ...a,
                              [def.param]: e.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
                        >
                          <option value="">Tümü</option>
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  return (
                    <label key={def.param} className="block">
                      <span className="mb-2 block text-xs font-medium text-teal-950/45">
                        {def.label}
                      </span>
                      <input
                        value={value}
                        onChange={(e) =>
                          setAttributeForm((a) => ({
                            ...a,
                            [def.param]: e.target.value,
                          }))
                        }
                        placeholder={def.placeholder}
                        inputMode={def.input === "number" ? "numeric" : undefined}
                        className="h-11 w-full rounded-xl border border-teal-900/10 bg-white px-4 text-sm outline-none focus:border-teal-600/50"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingId ? "Güncelle" : "Kural ekle"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-teal-900/15 px-5 py-2.5 text-sm font-semibold text-teal-900/70"
              >
                İptal
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="relative mt-4 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-800">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-teal-900/8 bg-white p-6 shadow-[0_16px_55px_rgba(15,60,50,0.04)]">
        <h2 className="text-xl font-semibold text-teal-950">Kayıtlı kurallar</h2>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-teal-950/45">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : rules.length === 0 ? (
          <div className="mt-6 rounded-xl bg-teal-50/60 p-5 text-sm text-teal-950/50">
            Henüz kural yok. Yukarıdan ilk alarm kuralınızı ekleyin.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-900/8 bg-teal-50/30 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-teal-950">{rule.name}</p>
                  <p className="mt-1 text-xs text-teal-950/50">
                    {ruleSummary(rule)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-teal-950/60">
                    <input
                      type="checkbox"
                      checked={rule.isActive}
                      onChange={(e) =>
                        void toggleRule(rule.id, e.target.checked)
                      }
                      className="h-4 w-4 rounded border-teal-300 text-teal-700"
                    />
                    {rule.isActive ? "Aktif" : "Kapalı"}
                  </label>
                  <button
                    type="button"
                    onClick={() => startEdit(rule)}
                    className="rounded-full p-2 text-teal-800 transition hover:bg-teal-100"
                    aria-label="Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRule(rule.id)}
                    className="rounded-full p-2 text-rose-700 transition hover:bg-rose-50"
                    aria-label="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
