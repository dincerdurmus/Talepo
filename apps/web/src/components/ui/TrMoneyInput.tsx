"use client";

import type { InputHTMLAttributes } from "react";

import {
  formatTrNumber,
  formatTrNumberInput,
} from "@/lib/format/tr-number";

type TrMoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "onChange" | "value" | "defaultValue"
> & {
  value?: string;
  defaultValue?: string | number | null;
  onValueChange?: (formatted: string) => void;
  /** Keep non-numeric text (budget ranges / labels) as-is */
  allowFreeText?: boolean;
};

function toDefaultString(
  value: string | number | null | undefined,
  allowFreeText: boolean,
): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return formatTrNumber(value) || undefined;
  const formatted = formatTrNumberInput(value, { allowFreeText });
  return formatted || value;
}

export function TrMoneyInput({
  value,
  defaultValue,
  onValueChange,
  allowFreeText = false,
  ...rest
}: TrMoneyInputProps) {
  const isControlled = value !== undefined;

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={isControlled ? value : undefined}
      defaultValue={
        isControlled
          ? undefined
          : toDefaultString(defaultValue, allowFreeText)
      }
      onChange={(event) => {
        const formatted = formatTrNumberInput(event.target.value, {
          allowFreeText,
        });
        if (!isControlled) {
          event.target.value = formatted;
        }
        onValueChange?.(formatted);
      }}
    />
  );
}
