"use client";
import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
type Health={lastUpdatedAt:string};
export function AdminHealthMeta(){
  const [data,setData]=useState<Health|null>(null);const [busy,setBusy]=useState(true);const [error,setError]=useState("");
  const load=useCallback(async()=>{try{const r=await fetch("/api/admin/health?days=30",{cache:"no-store"});const value=await r.json();if(!r.ok||!value.ok)throw new Error(value.message??"Veriler alınamadı.");setData(value);setError("")}catch(e){setError(e instanceof Error?e.message:"Veriler alınamadı.")}finally{setBusy(false)}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
  if(busy)return <div className="mt-6 h-20 animate-pulse rounded-2xl bg-white/[.06]"/>;
  if(error)return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-sm text-rose-100"><span>{error}</span><button onClick={()=>{setBusy(true);void load()}} className="inline-flex items-center gap-2 rounded-xl border border-rose-200/30 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5"/>Yeniden dene</button></div>;
  if(!data)return null;return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><div className="flex items-center gap-2 text-xs text-white/45"><Database className="h-4 w-4 text-emerald-300"/><span>Canlı platform verisi</span><span className="text-white/25">·</span><span>Son güncelleme: {new Date(data.lastUpdatedAt).toLocaleString("tr-TR")}</span></div><button onClick={()=>{setBusy(true);void load()}} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60 hover:border-emerald-300/40 hover:text-emerald-200"><RefreshCw className="h-3.5 w-3.5"/>Yenile</button></div>;
}
