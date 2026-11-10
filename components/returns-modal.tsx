"use client";

import { Button, inputClass, Modal } from "./ui";
import { useState } from "react";
import { useFormat, useI18n } from "@/lib/settings";
import { useWhen, WhenField, whenToIso } from "./order-activity";
import type { SalesOrder } from "@/lib/types";

/** Enter how many of each line the customer brought back (total so far, not an increment). */
export function ReturnsModal({ order, busy, onClose, onSave }: { order: SalesOrder; busy: boolean; onClose: () => void; onSave: (returns: Record<string, number>, at?: string) => void }) {
  const { t } = useI18n();
  const money = useFormat();
  const [when, setWhen] = useWhen();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(order.items.map((item) => [item.id, String(item.returnedQty)])));
  const num = (id: string) => Math.max(0, Number(values[id]) || 0);
  const due = order.items.reduce((sum, item) => sum + Math.max(0, item.quantity - num(item.id)) * item.unitPrice, 0);
  const subtotalAfterDiscount = Math.max(0, due - order.discount) * (1 + order.taxPct / 100);
  return (
    <Modal open title={t("action.recordReturns")} onClose={onClose} wide>
      <div className="grid gap-2">
        {order.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_90px_110px] items-center gap-3 rounded-2xl border border-line bg-[#fbf8f2] p-3 text-sm">
            <div>
              <p className="font-medium">{item.product?.name}</p>
              <p className="text-xs text-ink-soft">{money.dateTime(item.createdAt || order.orderDate)} · {t("label.taken")}: {item.quantity}</p>
            </div>
            <label className="text-xs text-ink-soft">
              {t("label.returned")}
              <input
                className={inputClass}
                type="number"
                min="0"
                max={item.quantity}
                step="1"
                value={values[item.id]}
                onChange={(event) => setValues({ ...values, [item.id]: event.target.value })}
              />
            </label>
            <p className="text-right">
              <span className="block text-xs text-ink-soft">{t("label.sold")}</span>
              <span className="font-medium tabular-nums">{Math.max(0, item.quantity - num(item.id))}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 max-w-xs"><WhenField value={when} onChange={setWhen} /></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-soft">{t("label.amountDue")}</p>
          <p className="font-serif text-3xl tabular-nums">{money.amount(subtotalAfterDiscount)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>{t("action.close")}</Button>
          <Button disabled={busy} onClick={() => onSave(Object.fromEntries(order.items.map((item) => [item.id, num(item.id)])), whenToIso(when))}>{t("action.save")}</Button>
        </div>
      </div>
    </Modal>
  );
}

