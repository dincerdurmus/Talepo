import type { CatalogPreviewModel } from "@/lib/catalog/consumer";

type Props = {
  model: CatalogPreviewModel;
  compact?: boolean;
};

export function CatalogIdentityPreview({ model, compact = false }: Props) {
  if (!model.vehicle && !model.soughtPart) return null;

  return (
    <div className={compact ? "space-y-2.5" : "space-y-3.5"}>
      {model.vehicle ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-950/35">
            {model.vehicle.label}
          </p>
          <p
            className={
              compact
                ? "mt-0.5 text-sm font-semibold text-[#0f1f1d]"
                : "mt-1 text-base font-semibold tracking-tight text-[#0f1f1d]"
            }
          >
            {model.vehicle.title}
          </p>
          {model.vehicle.detail ? (
            <p className="mt-0.5 text-sm text-teal-950/55">{model.vehicle.detail}</p>
          ) : null}
        </div>
      ) : null}
      {model.soughtPart ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-950/35">
            {model.soughtPart.label}
          </p>
          <p
            className={
              compact
                ? "mt-0.5 text-sm font-semibold text-[#0f1f1d]"
                : "mt-1 text-base font-semibold tracking-tight text-[#0f1f1d]"
            }
          >
            {model.soughtPart.title}
          </p>
        </div>
      ) : null}
    </div>
  );
}
