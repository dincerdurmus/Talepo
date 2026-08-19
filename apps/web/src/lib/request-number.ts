export function formatRequestNumber(requestNumber: number | null | undefined) {
  return requestNumber ? `TLP-REQ-${String(requestNumber).padStart(6, "0")}` : "TLP-REQ-BEKLİYOR";
}

export function parseRequestNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  const number = Number(digits);
  return Number.isInteger(number) && number > 0 ? number : null;
}
