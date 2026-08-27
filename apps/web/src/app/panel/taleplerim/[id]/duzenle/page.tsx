import { notFound, redirect } from "next/navigation";

import {
  EditRequestForm,
  type EditRequestInitial,
} from "@/components/panel/EditRequestForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { parseDiscoveryProjection } from "@/lib/discovery";
import { restoredFieldAnswers } from "@/server/request/mapper";
import { canEditRequestStatus } from "@/server/request/update-request";

export default async function EditMyRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ yeni?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const request = await prisma.request.findFirst({
    where: {
      id,
      createdById: user.id,
      deletedAt: null,
    },
    include: {
      category: { select: { slug: true, name: true } },
      fieldValues: {
        include: { field: { select: { key: true } } },
      },
    },
  });

  if (!request) notFound();

  if (!canEditRequestStatus(request.status)) {
    redirect(`/panel/taleplerim/${request.id}`);
  }

  /**
   * KALICI CEVAPLAR TEK KANONİK OKUYUCUDAN GELİR (D3f Dilim 3c, 2026-08-28).
   *
   * Burada eskiden yalnız `textValue` okunuyordu. Değer taşımayan bilinçli
   * cevapta (`{ mode }` → `jsonValue`) `textValue` tasarım gereği `null`dır,
   * bu yüzden kullanıcının "Bilmiyorum" cevabı düzenleme ekranına hiç
   * dönmüyor ve kaydedildiğinde kayboluyordu. Okuma, yazma tarafıyla AYNI
   * modülün fail-closed okuyucusuna bağlanır; ikinci bir ayrıştırma yazılmaz.
   */
  const fieldAnswers = restoredFieldAnswers(
    request.fieldValues.map((value) => ({
      key: value.field.key,
      textValue: value.textValue,
      numberValue: value.numberValue,
      booleanValue: value.booleanValue,
      jsonValue: value.jsonValue,
    })),
  );
  /* Değer taşıyan cevapların metin görünümü — mevcut sözleşme korunur. */
  const fieldValues: Record<string, string> = {};
  for (const [key, answer] of Object.entries(fieldAnswers)) {
    if (answer.mode === "VALUE") fieldValues[key] = answer.value;
  }

  const initial: EditRequestInitial = {
    id: request.id,
    title: request.title,
    description: request.description,
    rawInput: request.rawInput,
    professionalDescription: request.professionalDescription,
    city: request.city,
    budget: request.budgetMin ? String(Number(request.budgetMin)) : null,
    isUrgent: request.isUrgent,
    categorySlug: request.category.slug,
    fieldValues,
    fieldAnswers,
    /**
     * TAZELİK BAĞLAMI — SUNUCUDAN GELİR (D3f Dilim 3e, 2026-08-28).
     *
     * `?yeni=1` gibi bir sorgu parametresi tazelik kanıtı DEĞİLDİR: istemci
     * kontrolündedir ve yenilemede kaybolur. Bağlam yalnız sunucunun okuduğu
     * talep durumundan ve sunucunun yazdığı onay damgasından türer; bozuk
     * kayıt fail-closed olarak damgasız okunur.
     */
    status: request.status,
    fieldConfirmations:
      parseDiscoveryProjection(request.discoveryProjection)
        ?.fieldConfirmations ?? null,
  };

  return (
    <EditRequestForm
      initial={initial}
      cloneSuccess={query.yeni === "1"}
    />
  );
}
