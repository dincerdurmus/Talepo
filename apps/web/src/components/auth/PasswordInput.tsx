"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  inputClassName?: string;
  wrapClassName?: string;
};

export function PasswordInput({
  inputClassName = "",
  wrapClassName = "relative",
  className,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const fieldClass = `${inputClassName || className || ""} pr-12`.trim();

  return (
    <div className={wrapClassName}>
      <input {...props} type={visible ? "text" : "password"} className={fieldClass} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-black/40 transition hover:bg-black/[0.04] hover:text-black/70"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}
