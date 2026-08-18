export function negotiationInboxPath(
  recipientRole: "buyer" | "seller",
  offerId: string,
  negotiationId: string,
) {
  const base =
    recipientRole === "seller" ? "/panel/teklifler" : "/panel/gelen-teklifler";
  return `${base}?teklif=${encodeURIComponent(offerId)}&tur=${encodeURIComponent(negotiationId)}`;
}
