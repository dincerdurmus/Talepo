export function formatOfferStatus(status: string) {
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
      return { label: "Geri çekildi", tone: "bg-[#f3f3ef] text-black/50" };
    case "EXPIRED":
      return { label: "Süresi doldu", tone: "bg-[#f3f3ef] text-black/50" };
    default:
      return { label: status, tone: "bg-[#f3f3ef] text-black/50" };
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
      return { label: "Çıkarıldı", tone: "bg-[#f3f3ef] text-black/45" };
    default:
      return { label: status, tone: "bg-[#f3f3ef] text-black/45" };
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
