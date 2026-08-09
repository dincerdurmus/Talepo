"use client";

import { useCallback, useState } from "react";
import { BellRing, LoaderCircle, Plus, Trash2 } from "lucide-react";

import type { AlertRule } from "@/lib/alerts/alert-rules-store";

type AlertRulesManagerProps = {
  initialRules: AlertRule[];
  initialStorageNote?: string | null;
};

export function AlertRulesManager({
  initialRules,
  initialStorageNote = null,
}: AlertRulesManagerProps) {
  const [rules, setRules] = useState(initialRules);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [cityKeyword, setCityKeyword] = useState("");
  const [storageNote, setStorageNote] = useState(initialStorageNote);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/alert-rules");
      const data = (await response.json()) as {
        ok?: boolean;
        rules?: AlertRule[];
        storageNote?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message || "Kurallar yüklenemedi.");
      }
      setRules(data.rules ?? []);
      setStorageNote(data.storageNote ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Kurallar yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          categoryKeyword,
          cityKeyword,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        rules?: AlertRule[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message || "Kural eklenemedi.");
      }

      setRules(data.rules ?? []);
      setCategoryKeyword("");
      setCityKeyword("");
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Kural eklenemedi.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
    );

    const response = await fetch("/api/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id, enabled }),
    });

    if (!response.ok) {
      void loadRules();
    }
  }

  async function deleteRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id));

    const response = await fetch("/api/alert-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });

    if (!response.ok) {
      void loadRules();
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-orange-200/60 bg-gradient-to-br from-[#fff7ed] via-white to-[#fef3c7] p-6 shadow-[0_16px_55px_rgba(234,88,12,0.08)]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-300/25 blur-[40px]" />

        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[#0f172a]">Yeni kural</h2>
            <p className="mt-2 text-sm leading-6 text-black/45">
              Kategori ve/veya şehir anahtar kelimesi eşleştiğinde bildirim
              alırsınız. Eşleşme motoru yakında devreye girecek; kurallarınız
              şimdiden kaydedilir.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="relative mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-black/40">
              Kategori anahtar kelimesi
            </span>
            <input
              value={categoryKeyword}
              onChange={(event) => setCategoryKeyword(event.target.value)}
              placeholder="Örn. mobilya, matbaa, yazılım"
              className="h-12 w-full rounded-[14px] border border-orange-200/70 bg-white/90 px-4 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-black/40">
              Şehir / bölge anahtar kelimesi
            </span>
            <input
              value={cityKeyword}
              onChange={(event) => setCityKeyword(event.target.value)}
              placeholder="Örn. İstanbul, Ankara, Ege"
              className="h-12 w-full rounded-[14px] border border-orange-200/70 bg-white/90 px-4 text-sm outline-none"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-600 to-rose-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-45"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Kural ekle
            </button>
          </div>
        </form>

        {error && (
          <div className="relative mt-4 rounded-[16px] bg-[#ffe4df] p-3 text-sm font-semibold text-[#8b352b]">
            {error}
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-[0_16px_55px_rgba(0,0,0,0.04)]">
        <h2 className="text-xl font-semibold">Kayıtlı kurallar</h2>
        {storageNote && (
          <p className="mt-2 text-xs leading-5 text-black/35">{storageNote}</p>
        )}

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-black/45">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : rules.length === 0 ? (
          <div className="mt-6 rounded-[20px] bg-[#f6f8f6] p-5 text-sm text-black/45">
            Henüz kural yok. Yukarıdan kategori veya şehir filtresi ekleyin.
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-orange-100 bg-gradient-to-r from-[#fff7ed] to-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-[#0f172a]">
                    {[rule.categoryKeyword, rule.cityKeyword]
                      .filter(Boolean)
                      .join(" · ") || "Genel kural"}
                  </p>
                  <p className="mt-1 text-xs text-black/40">
                    {new Intl.DateTimeFormat("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(rule.createdAt))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-black/55">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) =>
                        void toggleRule(rule.id, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-orange-300 text-orange-600"
                    />
                    {rule.enabled ? "Aktif" : "Kapalı"}
                  </label>
                  <button
                    type="button"
                    onClick={() => void deleteRule(rule.id)}
                    className="rounded-full p-2 text-rose-700 transition hover:bg-rose-50"
                    aria-label="Kuralı sil"
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
