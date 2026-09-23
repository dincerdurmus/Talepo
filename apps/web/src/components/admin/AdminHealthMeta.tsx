"use client";
import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";
import { fetchAdminHealth } from "@/lib/admin-health-client";
type Health={lastUpdatedAt:string};
export function AdminHealthMeta(){
  const [data,setData]=useState<Health|null>(null);const [busy,setBusy]=useState(true);const [error,setError]=useState("");
  const load=useCallback(async(force=false)=>{try{const value=await fetchAdminHealth<Health>("/api/admin/health?days=30",{force});setData(value);setError("")}catch(e){setError(e instanceof Error?e.message:"Veriler alınamadı.")}finally{setBusy(false)}},[]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(timer)},[load]);
  if(busy)return <div className="mt-6 h-20 animate-pulse rounded-2xl bg-card"/>;
  if(error)return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><span>{error}</span><button onClick={()=>{setBusy(true);void load(true)}} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5"/>Yeniden dene</button></div>;
  if(!data)return null;return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-4 w-4 text-primary"/><span>Canlı platform verisi</span><span className="text-muted-foreground">·</span><span>Son güncelleme: {new Date(data.lastUpdatedAt).toLocaleString("tr-TR")}</span></div><button onClick={()=>{setBusy(true);void load(true)}} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/25 hover:text-primary"><RefreshCw className="h-3.5 w-3.5"/>Yenile</button></div>;
}
