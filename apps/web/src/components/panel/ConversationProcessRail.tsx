import {
  formatConversationProcessTime,
  type ConversationProcessStep,
} from "@/lib/message/conversation-process";

export function ConversationProcessRail({
  steps,
  amountLabel,
  heading = true,
}: {
  steps: ConversationProcessStep[];
  amountLabel?: string | null;
  heading?: boolean;
}) {
  if (steps.length === 0) return null;

  const currentId = steps[steps.length - 1]?.id;
  const acceptedDetail = steps.find((step) => step.id === "accepted")?.detail;
  const showAmountSummary =
    Boolean(amountLabel) &&
    !(acceptedDetail && amountLabel && acceptedDetail.includes(amountLabel));

  return (
    <aside className="talepo-conversation-process" aria-label="Süreç">
      {heading ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f1f1d]/42">
          Süreç
        </p>
      ) : null}
      <ol className={`talepo-conversation-process-list ${heading ? "mt-3" : ""}`}>
        {steps.map((step, index) => {
          const current = step.id === currentId;
          const timeLabel = formatConversationProcessTime(step.at);
          return (
            <li
              key={step.id}
              className={`talepo-conversation-process-step ${
                current
                  ? "talepo-conversation-process-step--current"
                  : "talepo-conversation-process-step--done"
              }`}
            >
              <span className="talepo-conversation-process-mark" aria-hidden>
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-5">
                  {step.label}
                </span>
                {step.detail ? (
                  <span className="talepo-conversation-process-detail">
                    {step.detail}
                  </span>
                ) : null}
                {timeLabel ? (
                  <time
                    dateTime={step.at ?? undefined}
                    className="mt-0.5 block text-[11px] tabular-nums text-[#0f1f1d]/40"
                  >
                    {timeLabel}
                  </time>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
      {showAmountSummary ? (
        <p className="mt-3 border-t border-[#0f1f1d]/8 pt-2.5 text-[12px] leading-5 text-[#0f1f1d]/52">
          {amountLabel}
        </p>
      ) : null}
    </aside>
  );
}
