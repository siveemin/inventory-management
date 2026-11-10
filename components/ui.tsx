"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { statusTone } from "@/lib/format";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const inputClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-[#A3988C] focus:border-forest focus:ring-4 focus:ring-forest/10";

const buttonStyles = {
  primary: "bg-forest text-white hover:bg-forest-deep",
  outline: "border border-forest bg-white text-forest hover:bg-mist",
  ghost: "text-ink-soft hover:bg-black/5",
  danger: "bg-danger text-white hover:bg-[#7e2918]",
  subtle: "border border-line bg-white text-ink hover:bg-[#fbf8f2]",
};

export function Button({
  children,
  variant = "primary",
  className,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof buttonStyles }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        buttonStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputClass, "min-h-24 resize-y", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cx("min-w-0 max-w-full rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(28,25,21,0.04),0_16px_40px_rgba(28,25,21,0.04)]", className)}>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[1.75rem] leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-xl text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone[status] || "gray";
  const tones = {
    green: "bg-[#e5f4ea] text-[#17663a]",
    yellow: "bg-[#fbf3d8] text-[#8a5a10]",
    red: "bg-[#fbe8e4] text-[#9c341f]",
    gray: "bg-[#f1ebe3] text-[#665e54]",
    blue: "bg-[#e5f0f6] text-[#1d5678]",
  };
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]", tones[tone])}>
      {label || status}
    </span>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid items-end p-3 sm:place-items-center sm:p-4">
      <button className="absolute inset-0 bg-[#141311]/45" onClick={onClose} aria-label="Close" />
      <div className={cx("relative max-h-[min(92vh,100%)] w-full overflow-y-auto rounded-[24px] border border-line bg-card p-4 shadow-2xl sm:p-6", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-serif text-2xl">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-ink-soft hover:bg-black/5">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-ink-soft">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="subtle" onClick={onClose}>{cancelLabel}</Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-ink-soft">
      <span className="tabular-nums">{total} records</span>
      <div className="flex items-center gap-1">
        <Button variant="subtle" className="px-3 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <Button variant="subtle" className="px-3 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [inner, setInner] = useState(value);
  const [outer, setOuter] = useState(value);
  if (value !== outer) {
    setOuter(value);
    setInner(value);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inner !== value) onChange(inner);
    }, 280);
    return () => clearTimeout(timer);
  }, [inner, onChange, value]);
  return <input value={inner} onChange={(event) => setInner(event.target.value)} placeholder={placeholder} className={cx(inputClass, "w-full min-w-0 sm:max-w-xs")} />;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
        <rect x="10" y="22" width="52" height="36" rx="10" stroke="#1F7A4D" strokeWidth="2" />
        <path d="M10 32h52" stroke="#1F7A4D" strokeWidth="2" />
        <path d="M26 16h20l6 6H20l6-6Z" stroke="#C4622D" strokeWidth="2" />
      </svg>
      <p className="mt-4 font-serif text-2xl">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mb-4 rounded-2xl bg-[#fbe8e4] px-4 py-3 text-sm text-danger">{message}</p>;
}

export function LoadingBlock() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-2xl bg-[#ebe4d8]" />
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-6 w-11 rounded-full transition", checked ? "bg-forest" : "bg-[#ddd4c8]")}
    >
      <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-5" : "left-0.5")} />
    </button>
  );
}

/**
 * On phones each row turns into a small card: the header text becomes a label
 * above each value (copied into data-label), so no column is hidden off-screen.
 */
export function Table({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const label = () => {
      const heads = [...table.querySelectorAll("thead th")].map((th) => th.textContent?.trim() || "");
      for (const row of table.querySelectorAll("tbody tr")) {
        [...row.children].forEach((cell, index) => {
          const text = heads[index] || "";
          if (cell.getAttribute("data-label") !== text) cell.setAttribute("data-label", text);
        });
      }
    };
    label();
    // Rows change with paging, searching and language: keep labels in step.
    const watch = new MutationObserver(label);
    watch.observe(table, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, []);
  return (
    <div className="rtable max-w-full overflow-x-auto overscroll-x-contain">
      <table ref={ref} className="w-full min-w-0 border-collapse text-sm sm:min-w-[40rem]">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cx("px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft", className)}>{children}</th>;
}

/**
 * `cell` controls the phone card: "title" is the card heading (defaults to the
 * first column), "media" (e.g. a thumbnail) is hidden on phones.
 */
export function Td({ children, className, cell, colSpan }: { children?: React.ReactNode; className?: string; cell?: "title" | "media"; colSpan?: number }) {
  return <td data-cell={cell} colSpan={colSpan} className={cx("px-4 py-3 align-middle", className)}>{children}</td>;
}
