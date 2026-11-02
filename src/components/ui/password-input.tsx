"use client";

import { useState, type InputHTMLAttributes } from "react";
import { IconEye, IconEyeOff } from "@/components/icons";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** Password field with a show/hide toggle. The toggle never submits the form. */
export function PasswordInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...rest}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={rest.id}
        disabled={rest.disabled}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
      >
        {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </div>
  );
}
