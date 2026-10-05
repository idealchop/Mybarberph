"use client";
import { useRef, useState } from "react";
import { Check, Plus, RotateCcw, Send, X } from "lucide-react";
import { Badge, Button, Card, cn, Input, ListItem, Topbar } from "@river-apps/ui";
import { SelectField, Toggle } from "@/components/common/Dialog";
import { Panel, PanelHeader, Pill } from "@/components/common/ui";
import { PageColumn } from "@/components/shell/PageColumn";
import { getRepository, type MessageLog, type MessageTemplate } from "@/data";

export interface MessagesData { templates: MessageTemplate[]; log: MessageLog[] }

/** Variables a template can use; the values are what the preview shows. */
export const VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: "customerName", label: "Customer name", sample: "Miguel" },
  { key: "queueNumber", label: "Queue number", sample: "36" },
  { key: "waitMins", label: "Wait (min)", sample: "12" },
  { key: "barberName", label: "Barber", sample: "Caloy" },
  { key: "shopName", label: "Shop name", sample: "Kanto Kings" },
  { key: "feedbackLink", label: "Feedback link", sample: "brbr.ph/f/A036" },
];
const TRIGGERS = ["When a ticket is created", "When the ticket is called", "When the visit is completed", "Manual · 30+ days since last visit", "On the customer’s birthday", "Manual send only"];

export function render(body: string) {
  return VARIABLES.reduce((s, v) => s.replaceAll(`{{${v.key}}}`, v.sample), body);
}
/** GSM-7 SMS: 160 chars for one part, 153 per part after that. */
export function smsParts(text: string) { return text.length <= 160 ? 1 : Math.ceil(text.length / 153); }

export function Messages({ data }: { data: MessagesData }) {
  const [templates, setTemplates] = useState(data.templates);
  const emptyTpl: MessageTemplate = { id: "mt-empty", key: "custom_empty", name: "New template", channel: "sms", body: "Hi {{customerName}}!", trigger: "Manual send only", enabled: false, isDefault: false, sentThisMonth: 0 };
  const [selectedId, setSelectedId] = useState(data.templates[0]?.id ?? emptyTpl.id);
  const [draft, setDraft] = useState<MessageTemplate>(data.templates[0] ?? emptyTpl);
  const [saved, setSaved] = useState(false);
  const [tested, setTested] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [log, setLog] = useState(data.log);
  const ta = useRef<HTMLTextAreaElement>(null);
  const [defaults] = useState<Record<string, string>>(() => Object.fromEntries(data.templates.map((t) => [t.id, t.body])));

  const select = (t: MessageTemplate) => { setSelectedId(t.id); setDraft(t); setSaved(false); setTested(false); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(templates.find((t) => t.id === selectedId));
  const preview = render(draft.body);
  const sent = templates.reduce((a, t) => a + t.sentThisMonth, 0);

  function insert(key: string) {
    const el = ta.current; const token = `{{${key}}}`;
    const start = el?.selectionStart ?? draft.body.length; const end = el?.selectionEnd ?? start;
    setDraft({ ...draft, body: draft.body.slice(0, start) + token + draft.body.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  }
  async function save() {
    setTemplates((all) => all.some((t) => t.id === draft.id) ? all.map((t) => t.id === draft.id ? draft : t) : [...all, draft]);
    setSaved(true);
    await getRepository().saveMessageTemplate(draft).catch(() => undefined);
  }
  function addTemplate() {
    const t: MessageTemplate = { id: `mt-custom-${Date.now()}`, key: `custom_${Date.now()}`, name: "New template", channel: "sms", trigger: "Manual send only", enabled: false, isDefault: false, sentThisMonth: 0, body: "Hi {{customerName}}! " };
    setTemplates((all) => [...all, t]); select(t);
  }

  return (
    <PageColumn wide>
      <Topbar
        className="px-1"
        title="Messages"
        subtitle={`SMS · ${sent.toLocaleString("en-PH")} sent this month · default texts plus your own`}
        actions={<Button size="md" leadingIcon={<Plus size={18} strokeWidth={1.75} />} onClick={addTemplate}>New template</Button>}
      />

      <div className="mt-4 grid gap-5 xl:grid-cols-[360px_1fr]">
        <Panel className="pb-3">
          <PanelHeader className="mb-2" title="Templates" subtitle="Default texts send automatically" />
          <ul className="flex flex-col gap-1.5">
            {templates.map((t) => (
              <li key={t.id}>
                <div className={cn("flex items-center gap-3 rounded-[18px] p-3 transition-colors", t.id === selectedId ? "bg-ink text-on-ink" : "bg-grey-100 hover:bg-grey-200/70")}>
                  <button type="button" onClick={() => select(t)} className="flex min-w-0 flex-1 flex-col text-left leading-tight" aria-current={t.id === selectedId}>
                    <span className="flex items-center gap-1.5"><b className="truncate text-[14.5px]">{t.name}</b>{t.isDefault ? <Badge variant={t.id === selectedId ? "on-ink" : "soft"} size="sm" className={t.id === selectedId ? "" : "bg-surface"}>Default</Badge> : null}</span>
                    <span className={cn("mt-1 truncate text-[12px] font-semibold", t.id === selectedId ? "text-on-ink-muted" : "text-muted")}>{t.trigger} · {t.sentThisMonth} sent</span>
                  </button>
                  <span className={cn(t.id === selectedId && "[&>button]:ring-1 [&>button]:ring-on-ink-line")}><Toggle label={`${t.name} enabled`} checked={t.enabled} onChange={(v) => { const next = { ...t, enabled: v }; setTemplates((all) => all.map((x) => x.id === t.id ? next : x)); if (t.id === selectedId) setDraft((d) => ({ ...d, enabled: v })); void getRepository().saveMessageTemplate(next).catch(() => undefined); }} /></span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <Panel className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelHeader title={draft.isDefault ? `${draft.name} (default)` : "Edit template"} subtitle={draft.isDefault ? "You can reword it; the trigger is fixed." : "Custom template"} />
              <span className="flex items-center gap-2"><span className="text-[13px] font-bold">{draft.enabled ? "On" : "Off"}</span><Toggle label="Enabled" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} /></span>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="flex min-w-0 flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input size="md" label="Name" value={draft.name} disabled={draft.isDefault} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  {draft.isDefault ? <Input size="md" label="Sends" value={draft.trigger} disabled readOnly /> :
                    <SelectField label="Sends" value={draft.trigger} onChange={(v) => setDraft({ ...draft, trigger: v })} options={TRIGGERS.map((t) => ({ value: t, label: t }))} />}
                </div>
                <div className="flex flex-col">
                  <label htmlFor="tpl-body" className="mb-2 text-[14px] font-bold">Message</label>
                  <textarea id="tpl-body" ref={ta} rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    className="resize-y rounded-[18px] bg-canvas p-4 font-mono text-[13.5px] font-medium leading-relaxed text-ink outline-none focus:bg-surface focus:ring-2 focus:ring-ink" />
                  <div className="mt-2 flex justify-between text-[12px] font-semibold text-muted"><span>{preview.length} characters with sample values</span><span>{smsParts(preview)} SMS part{smsParts(preview) > 1 ? "s" : ""}</span></div>
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-semibold text-muted">Insert a variable</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <button key={v.key} type="button" title={`{{${v.key}}}`} onClick={() => insert(v.key)} className="inline-flex items-center gap-1.5 rounded-pill bg-grey-100 px-2.5 py-1.5 text-[12px] font-bold hover:bg-grey-200">
                        <Plus size={12} strokeWidth={2.2} />{v.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                  <Button disabled={!dirty} leadingIcon={saved && !dirty ? <Check size={17} strokeWidth={2} /> : undefined} onClick={save}>{saved && !dirty ? "Saved" : "Save template"}</Button>
                  <Button variant="secondary" leadingIcon={tested ? <Check size={17} strokeWidth={2} /> : <Send size={16} strokeWidth={1.75} />} onClick={() => void (async () => {
                    setTestError(null);
                    try {
                      const entry = await getRepository().sendMessage({
                        templateId: draft.id,
                        to: "+639175550142",
                        customerName: "You (test)",
                        body: preview,
                      });
                      setLog((prev) => [entry, ...prev]);
                      setTested(true);
                      if (entry.status === "failed") setTestError("Logged outbound — SMS provider not configured yet. Add BREVO_SMS_API_KEY to send for real.");
                    } catch (e) {
                      setTestError(e instanceof Error ? e.message : "Send failed");
                    }
                  })()}>{tested ? "Test logged" : "Send test to me"}</Button>
                  {draft.isDefault && draft.body !== defaults[draft.id] ? <Button variant="ghost" leadingIcon={<RotateCcw size={16} strokeWidth={1.75} />} onClick={() => setDraft({ ...draft, body: defaults[draft.id]! })}>Reset to default</Button> : null}
                </div>
                {testError ? <p className="text-[12.5px] font-semibold text-muted">{testError}</p> : null}
              </div>

              {/* phone preview */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[300px] rounded-[34px] bg-ink p-2.5 shadow-raised">
                  <div className="flex min-h-[300px] flex-col rounded-[26px] bg-canvas px-3 pb-4 pt-3">
                    <div className="mx-auto mb-3 h-[5px] w-16 rounded-pill bg-grey-200" />
                    <span className="text-center text-[11.5px] font-semibold text-muted">KANTOKINGS · Text message</span>
                    <span className="mb-2 text-center text-[11px] font-medium text-subtle">Today 6:40 PM</span>
                    <p className="max-w-[88%] whitespace-pre-wrap break-words rounded-[18px] rounded-bl-[6px] bg-surface px-3.5 py-2.5 text-[13.5px] font-medium leading-snug shadow-card">{preview || "…"}</p>
                  </div>
                </div>
                <span className="mt-2 text-[12px] font-semibold text-muted">Preview with sample values</span>
              </div>
            </div>
          </Panel>

          <Card padding="none" className="px-4 py-1.5">
            <div className="px-1 pb-2 pt-3">
              <PanelHeader title="Recent sends" subtitle="Numbers are masked" />
            </div>
            <ul aria-label="Recent sends">
              {log.map((m) => (
                <li key={m.id} className="border-b border-line last:border-b-0">
                  <ListItem
                    variant="row"
                    className="py-2.5"
                    title={m.customerName}
                    subtitle={`${m.at} · ${m.templateName} · ${m.toMasked}`}
                    trailing={m.status === "failed" ? <Pill tone="solid"><X size={12} strokeWidth={2.4} />Failed</Pill> : <Pill tone="outline"><Check size={12} strokeWidth={2.4} />{m.status === "delivered" ? "Delivered" : "Sent"}</Pill>}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </PageColumn>
  );
}
