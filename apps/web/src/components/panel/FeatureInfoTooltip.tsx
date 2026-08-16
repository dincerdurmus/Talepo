"use client";
import { Info } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { PRO_FEATURE_PRESENTATION } from "@/lib/membership/feature-presentation";
export function FeatureInfoTooltip({ feature, label, description }: { feature: keyof typeof PRO_FEATURE_PRESENTATION; label?: string; description?: string }) {
  const [open, setOpen] = useState(false); const id = useId(); const info = PRO_FEATURE_PRESENTATION[feature];
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [open]);
  if (!info) return null;
  const tooltipDescription = description ?? info.description;
  return <span className="relative inline-flex" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}><button type="button" aria-label={`Bilgi: ${label ?? info.label}`} aria-describedby={open ? id : undefined} onClick={() => setOpen((value) => !value)} onFocus={() => setOpen(true)} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-900/5 text-teal-800/65 transition hover:bg-teal-900/10 hover:text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700/30" title={tooltipDescription}><Info className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" /></button>{open && <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-teal-900/10 bg-white p-3 text-left text-xs leading-5 text-teal-950/75 shadow-[0_12px_30px_rgba(15,31,29,0.14)]"><span className="block font-semibold text-teal-950">{info.label}</span><span className="mt-1 block">{tooltipDescription}</span>{info.trustNote && <span className="mt-2 block border-t border-teal-900/8 pt-2 font-medium text-teal-800/75">{info.trustNote}</span>}</span>}</span>;
}
