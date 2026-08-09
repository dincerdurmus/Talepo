export function formatOfferStatus(
  status: string,
  options?: { hasConversation?: boolean },
) {
  const negotiating =
    options?.hasConversation &&
    (status === "SUBMITTED" || status === "VIEWED");

  if (negotiating) {
    return {
      label: "Pazarlık",
      tone: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80",
    };
  }

  switch (status) {
    case "SUBMITTED":
      return { label: "Gönderildi", tone: "bg-[#eef3fb] text-[#2a4a74]" };
    case "VIEWED":
      return { label: "Görüldü", tone: "bg-[#fbf4ea] text-[#7a4e1a]" };
    case "ACCEPTED":
      return { label: "Kabul", tone: "bg-[#e7f7f2] text-[#0f766e]" };
    case "REJECTED":
      return { label: "Red", tone: "bg-[#fff1ee] text-[#8b352b]" };
    case "WITHDRAWN":
      return { label: "Geri çekildi", tone: "bg-[#f0f4f3] text-teal-950/50" };
    case "EXPIRED":
      return { label: "Süresi doldu", tone: "bg-[#f0f4f3] text-teal-950/50" };
    default:
      return { label: status, tone: "bg-[#f0f4f3] text-teal-950/50" };
  }
}

export function formatMemberRole(role: string) {
  switch (role) {
    case "OWNER":
      return "Sahip";
    case "ADMIN":
      return "Yönetici";
    case "MANAGER":
      return "Müdür";
    case "MEMBER":
      return "Üye";
    case "VIEWER":
      return "İzleyici";
    default:
      return role;
  }
}

export function formatMemberStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return { label: "Aktif", tone: "bg-[#e7f7f2] text-[#0f766e]" };
    case "INVITED":
      return { label: "Davet", tone: "bg-[#fbf4ea] text-[#7a4e1a]" };
    case "REJECTED":
      return { label: "Red", tone: "bg-[#fff1ee] text-[#8b352b]" };
    case "REMOVED":
      return { label: "Çıkarıldı", tone: "bg-[#f0f4f3] text-teal-950/45" };
    default:
      return { label: status, tone: "bg-[#f0f4f3] text-teal-950/45" };
  }
}

export function formatMoney(amount: { toString(): string }, currency: string) {
  const value = Number(amount.toString());
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}
