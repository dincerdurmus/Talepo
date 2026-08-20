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
    <section className="rounded-[18px] border border-teal-900/10 bg-[linear-gradient(145deg,#fcfdfc_0%,#f4f8f7_55%,#eef5f3_100%)] p-4 shadow-[0_12px_32px_rgba(15,31,29,0.045)] sm:flex sm:items-center sm:gap-5 sm:p-5">
      <span className="mb-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-teal-800/15 bg-white text-teal-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:mb-0">
        <Send className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3d5c58]/85">
          Teklif ver
        </p>
        <p className="mt-1 text-[15px] font-semibold tracking-tight text-[#0f1f1d] sm:text-[16px]">
          Bu talebe uygun teklifinizi oluşturun
        </p>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-[#0f1f1d]/58">
          Başlık, fiyat ve temel bilgileri girin; detaylarla teklifinizi
          güçlendirin.
        </p>
      </div>

      <div className="mt-4 w-full shrink-0 sm:mt-0 sm:w-auto sm:min-w-[13.75rem] [&_button]:!h-[48px] [&_button]:!w-full sm:[&_button]:!w-auto sm:[&_button]:!justify-center sm:[&_button]:!px-5 sm:[&_button]:!py-3 [&_button]:!rounded-[14px] [&_button]:!shadow-[0_10px_22px_rgba(15,118,110,0.22)]">
        <LetterSendButton
          sending={sending}
          onClick={handleClick}
          statusLabel="Teklif formu açılıyor…"
          withCloud={false}
        >
          <span className="relative z-10 flex w-full items-center justify-center gap-2 text-[14px] font-semibold">
            Bu talebe teklif ver
            <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
          </span>
        </LetterSendButton>
      </div>
    </section>
  );
}
