"use client";

import { ChevronDown } from "lucide-react";

import { NeighborhoodMultiSelect } from "@/components/request/NeighborhoodMultiSelect";
import {
  getDistrictsForProvince,
  TURKEY_IL_NAMES,
} from "@/lib/geo/turkey-districts";

type RealEstateLocationFieldsProps = {
  il: string;
  ilce: string;
  mahalleler?: string[];
  onIlChange: (il: string) => void;
  onIlceChange: (ilce: string) => void;
  onMahallelerChange?: (mahalleler: string[]) => void;
  /** Show that values came from AI but remain editable */
  aiSuggested?: boolean;
  selectClassName?: string;
  labelClassName?: string;
  badgeClassName?: string;
  neighborhoodControlClassName?: string;
};

export function RealEstateLocationFields({
  il,
  ilce,
  mahalleler = [],
  onIlChange,
  onIlceChange,
  onMahallelerChange,
  aiSuggested = false,
  selectClassName = "h-12 w-full appearance-none rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-4 pr-10 text-sm font-medium outline-none transition focus:border-[#0f766e]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]",
  labelClassName = "text-xs font-medium text-black/40",
  badgeClassName = "rounded-full bg-[#ffe8e3] px-2 py-0.5 text-[10px] font-semibold text-[#a44b3d]",
  neighborhoodControlClassName,
}: RealEstateLocationFieldsProps) {
  const districts = il ? getDistrictsForProvince(il) : [];

  return (
    <div className="contents">
      {(il || ilce) && aiSuggested && (
        <p className="col-span-full -mb-1 text-[11px] leading-4 text-black/40 sm:col-span-2">
          AI konum önerdi — listeden istediğiniz gibi değiştirebilirsiniz.
        </p>
      )}

      <label>
        <div className="mb-2 flex items-center gap-2">
          <span className={labelClassName}>İl *</span>
          <span className={badgeClassName}>Zorunlu</span>
          {aiSuggested && il && (
            <span className="rounded-full bg-[#e8f3ea] px-2 py-0.5 text-[10px] font-semibold text-[#2f6b34]">
              Düzenlenebilir
            </span>
          )}
        </div>
        <div className="relative">
          <select
            value={il}
            onChange={(event) => {
              onIlChange(event.target.value);
            }}
            className={selectClassName}
          >
            <option value="">İl seçiniz</option>
            {TURKEY_IL_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
        </div>
      </label>

      <label>
        <div className="mb-2 flex items-center gap-2">
          <span className={labelClassName}>İlçe *</span>
          <span className={badgeClassName}>Zorunlu</span>
        </div>
        <div className="relative">
          <select
            value={ilce}
            onChange={(event) => onIlceChange(event.target.value)}
            disabled={!il}
            className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">
              {il ? "İlçe seçiniz" : "Önce il seçiniz"}
            </option>
            {districts.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
        </div>
      </label>

      {onMahallelerChange && (
        <NeighborhoodMultiSelect
          il={il}
          ilce={ilce}
          value={mahalleler}
          onChange={onMahallelerChange}
          labelClassName={labelClassName}
          badgeClassName={badgeClassName}
          controlClassName={
            neighborhoodControlClassName ??
            "min-h-12 w-full rounded-2xl border border-black/[0.08] bg-[#fafaf8] px-3 py-2 text-sm outline-none transition focus-within:border-[#0f766e]/40 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.1)]"
          }
        />
      )}
    </div>
  );
}
