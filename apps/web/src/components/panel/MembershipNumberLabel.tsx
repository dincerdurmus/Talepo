"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type MembershipNumberLabelProps = {
  membershipNumber: string;
  className?: string;
};

export function MembershipNumberLabel({
  membershipNumber,
  className = "",
}: MembershipNumberLabelProps) {
  const [copied, setCopied] = useState(false);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(membershipNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={`mt-1 flex items-center gap-1.5 ${className}`}>
      <p className="truncate text-xs text-teal-950/45">
        Üyelik no:{" "}
        <span className="font-mono font-medium text-teal-950/60">
          {membershipNumber}
        </span>
      </p>
      <button
        type="button"
        onClick={() => void copyNumber()}
        aria-label="Üyelik numarasını kopyala"
        className="shrink-0 rounded-md p-0.5 text-teal-950/35 transition hover:bg-teal-900/[0.04] hover:text-teal-800"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-teal-700" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
