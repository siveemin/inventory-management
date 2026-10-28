"use client";

import { useState } from "react";
import { useToast } from "@/components/providers";
import { Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";
import { formatKhr, formatUsd } from "@/lib/format";
import { useI18n, useSettings, type Preferences, type SystemSettings } from "@/lib/settings";

export default function SettingsPage() {
  const settings = useSettings();
  // The form starts from the saved settings, so wait until they have been read from the browser.
  return settings.ready ? <SettingsForm /> : null;
}

function SettingsForm() {
  const { t } = useI18n();
  const toast = useToast();
  const settings = useSettings();
  const [tab, setTab] = useState<"general" | "invoice" | "preferences">("general");
  const [system, setSystem] = useState<SystemSettings>(settings.system);
  const [rate, setRate] = useState(String(settings.rate));
  const [prefs, setPrefs] = useState<Preferences>(settings.prefs);
  const sample = 12.5;
  const numericRate = Number(rate) || 0;

  return (
    <div>
      <PageHeader title={t("page.settings")} subtitle={t("sub.settings")} />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["general", "invoice", "preferences"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-sm ${tab === item ? "bg-ink text-white" : "border border-line bg-white"}`}>
            {t(`settings.${item}`)}
          </button>
        ))}
      </div>
      {tab === "general" ? (
        <Card className="grid max-w-xl gap-4 p-6">
          <Field label={t("label.systemName")}><TextInput value={system.name} onChange={(event) => setSystem({ ...system, name: event.target.value })} /></Field>
          <Field label={t("label.subtitle")}><TextInput value={system.subtitle} onChange={(event) => setSystem({ ...system, subtitle: event.target.value })} /></Field>
          <Button onClick={() => { settings.updateSystem(system); toast(t("common.saved")); }}>{t("action.save")}</Button>
        </Card>
      ) : null}
      {tab === "invoice" ? (
        <Card className="grid max-w-xl gap-4 p-6">
          <Field label={`${t("label.exchange")} · USD → KHR`} hint={t("settings.rateHint")}>
            <TextInput type="number" min="1" value={rate} onChange={(event) => setRate(event.target.value)} />
          </Field>
          <div className="rounded-2xl bg-[#fbf8f2] p-4">
            <p className="text-sm text-ink-soft">Sample amount</p>
            <p className="font-serif text-3xl">{formatUsd(sample)}</p>
            <p>{formatKhr(sample * numericRate)}</p>
          </div>
          <Button onClick={() => { settings.updateRate(numericRate); toast(t("common.saved")); }}>{t("action.save")}</Button>
        </Card>
      ) : null}
      {tab === "preferences" ? (
        <Card className="grid max-w-xl gap-4 p-6">
          <Field label={t("label.language")}>
            <Select value={prefs.language} onChange={(event) => setPrefs({ ...prefs, language: event.target.value as Preferences["language"] })}>
              <option value="en">English</option>
              <option value="km">ភាសាខ្មែរ</option>
            </Select>
          </Field>
          <Field label={t("label.dateFormat")}>
            <Select value={prefs.dateFormat} onChange={(event) => setPrefs({ ...prefs, dateFormat: event.target.value as Preferences["dateFormat"] })}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </Select>
          </Field>
          <Field label={t("label.timezone")}>
            <Select value={prefs.timezone} onChange={(event) => setPrefs({ ...prefs, timezone: event.target.value })}>
              <option value="Asia/Phnom_Penh">Asia/Phnom_Penh</option>
              <option value="Asia/Bangkok">Asia/Bangkok</option>
              <option value="UTC">UTC</option>
            </Select>
          </Field>
          <Button onClick={() => { settings.updatePrefs(prefs); toast(t("common.saved")); }}>{t("action.save")}</Button>
        </Card>
      ) : null}
    </div>
  );
}
