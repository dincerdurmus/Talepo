"use client";
import { useEffect, useState } from "react";
import { publicCategoryDefinition, type PublicCategory } from "@/lib/public-categories";
import { registerRuntimeCategories, type RequestCategory } from "@/lib/request-category-engine";

export function usePublicCategories() {
  const [categories, setCategories] = useState<RequestCategory[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    let running = false;
    const controller = new AbortController();
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const response = await fetch("/api/categories/active", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Category list unavailable");
        const data = await response.json() as { categories: PublicCategory[] };
        registerRuntimeCategories(data.categories);
        if (!cancelled) setCategories(data.categories.map(publicCategoryDefinition));
      } catch {
        // Never fall back to a static list that could reveal archived categories.
        // Keep an open form mounted during a temporary refresh failure.
        // Publishing still checks current availability on the server.
      } finally { running = false; }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => { cancelled = true; controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, []);
  return categories;
}
