"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";

import {
  LETTER_SEND_DURATION_MS,
  LetterSendButton,
} from "@/components/panel/LetterSendButton";

type OfferSendCtaProps = {
  href: string;
};

export function OfferSendCta({ href }: OfferSendCtaProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  function handleClick() {
    if (sending) return;
    setSending(true);
    window.setTimeout(() => {
      router.push(href);
    }, LETTER_SEND_DURATION_MS);
  }

  return (
    <LetterSendButton
      sending={sending}
      onClick={handleClick}
      statusLabel="Teklif formu açılıyor…"
      withCloud={false}
    >
      <span className="flex min-w-0 items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
          <Send className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-lg font-semibold tracking-tight">
            Bu talebe teklif ver
          </span>
          <span className="mt-0.5 block text-sm text-white/75">
            Tutar ve kısa açıklama ile hemen gönder
          </span>
        </span>
      </span>
      <ArrowRight className="h-6 w-6 shrink-0 transition group-hover:translate-x-1" />
    </LetterSendButton>
  );
}
