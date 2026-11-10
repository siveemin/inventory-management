"use client";

import { useState } from "react";
import { useFormat } from "@/lib/settings";
import { inputClass } from "./ui";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Stored amount in USD, as a string ("" when empty). */
  value: string;
  /** Called with the new USD amount as a string. */
  onChange: (usd: string) => void;
};

/**
 * A price box in the user's currency. Staff type riel (or dollars); the form
 * keeps working in USD, which is what the database stores.
 */
export function MoneyInput({ value, onChange, className, ...rest }: Props) {
  const { currency, rate, toDisplay, fromDisplay } = useFormat();
  const toText = (usd: string) => (usd === "" ? "" : String(toDisplay(Number(usd))));
  const key = `${currency}:${rate}:${value}`;
  const [text, setText] = useState(() => toText(value));
  const [synced, setSynced] = useState(key);

  // The value changed from outside (product picked, form reset, currency switched).
  if (synced !== key) {
    setSynced(key);
    if (toText(value) !== text && !(text !== "" && fromDisplay(Number(text)) === Number(value))) setText(toText(value));
  }

  return (
    <div className="relative">
      <input
        {...rest}
        className={className || inputClass}
        type="number"
        inputMode={currency === "KHR" ? "numeric" : "decimal"}
        min="0"
        step={currency === "KHR" ? "1" : "0.01"}
        value={text}
        style={{ paddingRight: "2.25rem" }}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          const usd = next === "" ? "" : String(fromDisplay(Number(next)));
          setSynced(`${currency}:${rate}:${usd}`);
          onChange(usd);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">{currency === "KHR" ? "៛" : "$"}</span>
    </div>
  );
}
