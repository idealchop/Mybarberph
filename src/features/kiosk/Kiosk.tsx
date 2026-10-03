"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Banknote, Check, CreditCard, Shuffle, Smartphone, Wallet } from "lucide-react";
import { Avatar, Button, cn, Input, PhoneInput, ProgressRing, SampleDataTag, SegmentedControl, SuccessState } from "@river-apps/ui";
import { BarberIcon, HaircutArt, Portrait, Star } from "@/components/art";
import { Toggle } from "@/components/common/Dialog";
import { QrCode } from "@/components/common/QrCode";
import { Brand } from "@/components/shell/Brand";
import { getRepository, type Barber, type Centavos, type Chair, type PaymentMethod, type Service, type Ticket, type Transaction, type Voucher } from "@/data";
import { firstName, PAYMENT_LABEL, peso } from "@/lib/format";

export interface KioskData { barbers: Barber[]; chairs: Chair[]; services: Service[]; tickets: Ticket[]; waitingCount: number; vouchers: Voucher[]; shopName: string }
type Step = "barber" | "haircut" | "confirm" | "ticket" | "in_chair" | "payment" | "feedback" | "done";
type Lang = "en" | "fil";
const PHASE1: Step[] = ["barber", "haircut", "confirm"];
const TIPS = [0, 2000, 5000, 10000];
const FEEDBACK_TAGS = ["Clean fade", "Friendly", "On time", "Good value", "Great conversation", "Clean shop"];
const METHOD_ICON: Record<PaymentMethod, ReactNode> = {
  cash: <Banknote size={26} strokeWidth={1.75} />, gcash: <Smartphone size={26} strokeWidth={1.75} />, maya: <Wallet size={26} strokeWidth={1.75} />, card: <CreditCard size={26} strokeWidth={1.75} />,
};

export function Kiosk({ data }: { data: KioskData }) {
  const [lang, setLang] = useState<Lang>("en");
  const t = (en: string, fil: string) => (lang === "fil" ? fil : en);
  const [step, setStep] = useState<Step>("barber");
  const [barberId, setBarberId] = useState<string | "any" | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [sms, setSms] = useState(true);
  const [code, setCode] = useState("");
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [progress, setProgress] = useState(8);
  const [tip, setTip] = useState<Centavos>(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [awaitingOnline, setAwaitingOnline] = useState(false);
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [busy, setBusy] = useState(false);

  const fastest = [...data.barbers].sort((a, b) => (a.etaMins ?? 99) - (b.etaMins ?? 99))[0]!;
  const barber = barberId === "any" ? fastest : data.barbers.find((b) => b.id === barberId);
  const svc = (id: string | null) => data.services.find((s) => s.id === id);
  const service = svc(serviceId);
  const chairOf = (b: Barber) => data.chairs.find((c) => c.id === b.defaultChairId);
  const lineFor = (b: Barber) => data.tickets.filter((x) => x.status === "waiting" && x.barberId === b.id).length + 1;
  const recommended = barber ? barber.recommendedServiceIds.map((id) => svc(id)).filter((s): s is Service => !!s) : data.services.filter((s) => s.category === "haircut" && s.isDefault).slice(0, 5);
  const menu = barber ? data.services.filter((s) => barber.serviceIds.includes(s.id) && s.category !== "addon" && s.showInKiosk && s.active) : [];
  const addonList = barber ? data.services.filter((s) => barber.serviceIds.includes(s.id) && s.category === "addon" && s.showInKiosk && s.active) : [];
  const subtotal = (service?.price ?? 0) + addons.reduce((a, id) => a + (svc(id)?.price ?? 0), 0);
  const discount = voucher ? Math.min(subtotal, voucher.discountType === "fixed" ? voucher.value : Math.round((subtotal * voucher.value) / 100)) : 0;
  const total = subtotal - discount;
  const minutes = (service?.durationMins ?? 0) + addons.reduce((a, id) => a + (svc(id)?.durationMins ?? 0), 0);

  function reset() {
    setStep("barber"); setBarberId(null); setServiceId(null); setAddons([]); setName(""); setPhone(null); setSms(true); setCode(""); setVoucher(null); setVoucherError(null);
    setTicket(null); setProgress(8); setTip(0); setMethod("cash"); setAwaitingOnline(false); setTxn(null); setRating(0); setTags([]); setComment(""); setCountdown(10);
  }

  /* in-chair progress animation (demo) */
  useEffect(() => {
    if (step !== "in_chair") return;
    const id = setInterval(() => setProgress((p) => Math.min(92, p + 3)), 900);
    return () => clearInterval(id);
  }, [step]);
  /* auto restart after feedback */
  useEffect(() => {
    if (step !== "done") return;
    if (countdown <= 0) { reset(); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [step, countdown]);

  function pickBarber(id: string | "any") {
    setBarberId(id);
    const b = id === "any" ? fastest : data.barbers.find((x) => x.id === id)!;
    if (!serviceId || !b.serviceIds.includes(serviceId)) setServiceId(null);
    setAddons((a) => a.filter((x) => b.serviceIds.includes(x)));
  }
  function applyVoucher() {
    const v = data.vouchers.find((x) => x.code === code.trim().toUpperCase());
    if (!v || !v.active) { setVoucher(null); setVoucherError(t("That code isn’t valid here.", "Hindi valid ang code na ’yan.")); return; }
    setVoucher(v); setVoucherError(null);
  }
  async function getTicket() {
    if (!barber || !service) return;
    setBusy(true);
    const tk = await getRepository().createKioskTicket({ barberId: barberId === "any" ? "any" : barber.id, serviceIds: [service.id, ...addons], customerName: name.trim() || undefined, phone: phone ?? undefined, smsConsent: sms && !!phone });
    setTicket(tk); setBusy(false); setStep("ticket");
  }
  async function confirmDone() {
    if (ticket) await getRepository().confirmCompleted(ticket.id).catch(() => undefined);
    setProgress(100); setStep("payment");
  }
  async function pay() {
    if (!ticket) return;
    if (method !== "cash" && !awaitingOnline) { setAwaitingOnline(true); return; }
    setBusy(true);
    const tx = await getRepository().recordPayment(ticket.id, { method, tip });
    setTxn(tx); setBusy(false); setStep("feedback");
  }
  async function sendFeedback() {
    if (ticket && rating) await getRepository().submitFeedback({ ticketId: ticket.id, barberId: barber?.id, rating, tags, comment: comment.trim() || undefined });
    setStep("done");
  }

  const phase2 = !PHASE1.includes(step) && step !== "ticket";
  const steps = phase2 ? [["in_chair", t("In chair", "Nasa upuan")], ["payment", t("Payment", "Bayad")], ["feedback", "Feedback"]] as const
    : [["barber", t("Barber", "Barbero")], ["haircut", t("Haircut", "Gupit")], ["confirm", t("Confirm & ticket", "Kumpirma at ticket")]] as const;
  const order: Step[] = phase2 ? ["in_chair", "payment", "feedback", "done"] : ["barber", "haircut", "confirm", "ticket"];
  const cur = Math.min(order.indexOf(step), 2);

  /* bottom bar content per step */
  const canContinue = step === "barber" ? !!barber && !!service : step === "haircut" ? !!service : step === "confirm" ? !busy : true;
  const summaryTitle = barber ? `${barber.nickname}${service ? ` · ${service.name}` : ""}${addons.length ? ` + ${addons.length}` : ""}` : t("Pick a barber to start", "Pumili ng barbero");
  const summarySub = barber && service
    ? `${peso(total)} · ${t("about", "mga")} ${minutes} min · ${barber.etaMins ? t(`You’re #${lineFor(barber)} in ${barber.nickname === "Tin" ? "her" : "his"} line · ~${barber.etaMins} min`, `Ikaw ang #${lineFor(barber)} sa pila · ~${barber.etaMins} min`) : t("Free now", "Bakante na")}`
    : barber ? t("Now pick a haircut", "Pumili na ng gupit") : t("Or tap “Any barber” for the shortest wait", "O pindutin ang “Kahit sino” para sa pinakamabilis");

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[1180px] flex-col bg-canvas px-5 pb-[128px] pt-5 sm:px-8">
      <header className="flex h-12 items-center justify-between gap-3">
        <a href="/" aria-label="Barbers.ph home"><Brand /></a>
        <ol className="hidden items-center gap-2 text-[13.5px] font-bold md:flex" aria-label="Progress">
          {steps.map(([key, label], i) => (
            <li key={key} className="contents">
              {i > 0 ? <span aria-hidden className="h-px w-6 bg-grey-300" /> : null}
              <span aria-current={i === cur ? "step" : undefined} className={cn("inline-flex items-center gap-2 rounded-pill py-1.5 pl-1.5 pr-3.5", i === cur ? "bg-ink text-on-ink shadow-raised" : "bg-surface text-muted shadow-tile")}>
                <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[12px] font-extrabold", i === cur ? "bg-surface text-ink" : i < cur ? "bg-ink text-on-ink" : "bg-grey-100 text-ink")}>{i < cur ? <Check size={13} strokeWidth={3} /> : i + 1}</span>{label}
              </span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-3">
          <SampleDataTag className="hidden sm:inline-flex" />
          <SegmentedControl<Lang> label="Language" value={lang} onChange={setLang} options={[{ value: "en", label: "English" }, { value: "fil", label: "Filipino" }]} />
        </div>
      </header>

      {step === "barber" ? (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="rounded-pill bg-grey-100 px-2.5 py-[5px] text-[12px] font-bold leading-none text-ink-2">{data.shopName} · POS 2 Kiosk</span>
              <h1 className="mt-2.5 text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em]">{t("Who’s cutting your hair today?", "Sino ang gugupit sa’yo ngayon?")}</h1>
              <p className="mt-1 text-[16px] font-medium text-muted">{t(`Tap a barber. Wait times update live · ${data.waitingCount} people in the queue.`, `Pumili ng barbero. Live ang oras ng hintay · ${data.waitingCount} tao sa pila.`)}</p>
            </div>
            <Button size="lg" variant="secondary" className={cn(barberId === "any" && "ring-2 ring-ink")} leadingIcon={<Shuffle size={20} strokeWidth={1.75} />} onClick={() => pickBarber("any")} aria-pressed={barberId === "any"}>
              {t("Any barber", "Kahit sino")} <span className="font-semibold text-muted">· {t("fastest", "pinakamabilis")}: {fastest.nickname}, {fastest.etaMins ? `${fastest.etaMins} min` : t("now", "ngayon")}</span>
            </Button>
          </div>
          <section aria-label={t("Barbers", "Mga barbero")} className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.barbers.filter((b) => b.active).map((b) => <BarberCard key={b.id} b={b} chair={chairOf(b)} selected={barberId === b.id} onClick={() => pickBarber(b.id)} t={t} />)}
          </section>
          <div className="mt-6 flex items-baseline justify-between gap-3">
            <h2 className="text-[19px] font-extrabold tracking-[-0.02em]">{barber ? t(`Recommended by ${barber.nickname}`, `Rekomendado ni ${barber.nickname}`) : t("Popular haircuts", "Mga sikat na gupit")}</h2>
            <span className="text-[13.5px] font-semibold text-muted">{t("Prices include shampoo & hot towel", "Kasama na ang shampoo at hot towel")}</span>
          </div>
          <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {recommended.map((s, i) => (
              <HaircutCard key={s.id} s={s} preset={barber?.avatar ?? "sky"} selected={serviceId === s.id} disabled={!barber}
                badge={s.badge ? { label: s.badge, solid: true } : i === 1 && barber ? { label: `${barber.nickname}’s pick` } : undefined}
                onClick={() => setServiceId(s.id)} />
            ))}
          </section>
        </>
      ) : null}

      {step === "haircut" && barber ? (
        <>
          <Heading eyebrow={`${barber.nickname} · ${chairOf(barber)?.label ?? ""}`} title={t("Pick your haircut", "Pumili ng gupit")} sub={t(`Everything ${barber.nickname} does today. Add extras below.`, `Lahat ng kaya ni ${barber.nickname} ngayon. May dagdag sa ibaba.`)} />
          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {menu.map((s) => <HaircutCard key={s.id} s={s} preset={barber.avatar} selected={serviceId === s.id} onClick={() => setServiceId(s.id)}
              badge={s.badge ? { label: s.badge, solid: true } : barber.recommendedServiceIds.includes(s.id) ? { label: t("Recommended", "Rekomendado") } : undefined} />)}
          </section>
          {addonList.length ? (
            <>
              <h2 className="mt-6 text-[19px] font-extrabold tracking-[-0.02em]">{t("Add-ons", "Dagdag")}</h2>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {addonList.map((a) => {
                  const on = addons.includes(a.id);
                  return (
                    <button key={a.id} type="button" aria-pressed={on} onClick={() => setAddons((x) => on ? x.filter((y) => y !== a.id) : [...x, a.id])}
                      className={cn("inline-flex h-14 items-center gap-2.5 rounded-tile px-4 text-[15px] font-bold shadow-card", on ? "bg-ink text-on-ink" : "bg-surface")}>
                      <span className={cn("inline-flex size-6 items-center justify-center rounded-full", on ? "bg-surface text-ink" : "bg-grey-100")}>{on ? <Check size={14} strokeWidth={3} /> : "+"}</span>
                      {a.name}<span className={cn("font-semibold", on ? "text-on-ink-muted" : "text-muted")}>+{peso(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {step === "confirm" && barber && service ? (
        <>
          <Heading eyebrow={t("Almost done", "Malapit na")} title={t("Check your order", "Tingnan ang order mo")} sub={t("Leave your number if you want a text when you’re next. It’s optional.", "Iwan ang number mo kung gusto mong ma-text kapag ikaw na. Hindi required.")} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <section className="rounded-card bg-surface p-5 shadow-card">
              <div className="flex items-center gap-4">
                <span className="overflow-hidden rounded-[20px]"><Portrait preset={barber.avatar} size={96} /></span>
                <div className="flex flex-col leading-tight"><span className="text-[13px] font-semibold text-muted">{t("Your barber", "Barbero mo")}</span><b className="text-[22px] font-extrabold tracking-[-0.02em]">{barber.name}</b>
                  <span className="mt-1 text-[14px] font-semibold text-ink-2">{chairOf(barber)?.label} · {barber.etaMins ? t(`#${lineFor(barber)} in line · ~${barber.etaMins} min`, `#${lineFor(barber)} sa pila · ~${barber.etaMins} min`) : t("Free now", "Bakante na")}</span></div>
              </div>
              <dl className="mt-5 flex flex-col gap-2.5 rounded-[18px] bg-grey-100 p-4 text-[15px] font-semibold">
                <div className="flex items-center justify-between gap-3"><dt className="flex items-center gap-3"><HaircutArt kind={service.kind} size={40} preset={barber.avatar} />{service.name}</dt><dd>{peso(service.price)}</dd></div>
                {addons.map((id) => { const a = svc(id)!; return <div key={id} className="flex justify-between"><dt className="text-ink-2">+ {a.name}</dt><dd>{peso(a.price)}</dd></div>; })}
                {voucher ? <div className="flex justify-between"><dt className="text-ink-2">{voucher.code}</dt><dd>−{peso(discount)}</dd></div> : null}
                <div className="flex justify-between border-t border-grey-200 pt-2.5 text-[18px]"><dt className="font-extrabold">{t("Total", "Kabuuan")}</dt><dd className="font-extrabold">{peso(total)}</dd></div>
              </dl>
              <p className="mt-3 text-[13px] font-medium text-muted">{t("You pay after your haircut. Cash, GCash, Maya or card.", "Magbabayad pagkatapos ng gupit. Cash, GCash, Maya o card.")}</p>
            </section>
            <section className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-card">
              <Input label={t("Your name (optional)", "Pangalan (optional)")} placeholder="Juan" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
              <PhoneInput label={t("Mobile number (optional)", "Mobile number (optional)")} onChange={(_, e164) => setPhone(e164)} hint={t("We only use it for queue texts.", "Para lang sa text tungkol sa pila.")} />
              <div className="flex items-center justify-between gap-3 rounded-tile bg-grey-100 px-4 py-3">
                <span className="text-[14px] font-bold">{t("Text me when I’m next", "I-text ako kapag ako na")}</span>
                <Toggle label="SMS consent" checked={sms && !!phone} disabled={!phone} onChange={setSms} />
              </div>
              <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); applyVoucher(); }}>
                <Input size="md" label={t("Voucher code", "Voucher code")} placeholder="BALIK50" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} containerClassName="flex-1" className="font-mono uppercase" error={voucherError ?? undefined} hint={voucher ? `${voucher.code} · ${voucher.description}` : undefined} />
                <Button type="submit" variant="secondary" disabled={!code.trim()} className="mb-[1px]">{voucher ? <Check size={18} strokeWidth={2.2} /> : t("Apply", "Gamitin")}</Button>
              </form>
            </section>
          </div>
        </>
      ) : null}

      {step === "ticket" && ticket && barber && service ? (
        <div className="mt-8 grid items-center gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="relative overflow-hidden rounded-banner bg-ink p-7 text-on-ink shadow-raised">
            <i aria-hidden className="pointer-events-none absolute -right-20 -top-[120px] size-[300px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0)_65%)]" />
            <span className="rounded-pill bg-on-ink-subtle px-2.5 py-[5px] text-[12px] font-bold text-on-ink-muted">{t("Your ticket", "Ticket mo")}</span>
            <p className="mt-3 font-mono text-[84px] font-bold leading-none tracking-[0.02em]">{ticket.referenceId}</p>
            <p className="mt-3 text-[20px] font-extrabold tracking-[-0.02em]">{name.trim() ? `${t("Hi", "Hi")} ${name.trim().split(" ")[0]}! ` : ""}{barber.etaMins ? t(`You’re #${lineFor(barber)} in ${barber.nickname}’s line`, `Ikaw ang #${lineFor(barber)} sa pila ni ${barber.nickname}`) : t(`${barber.nickname} is free now`, `Bakante na si ${barber.nickname}`)}</p>
            <p className="mt-1 text-[15px] font-medium text-on-ink-muted">{service.name} · {chairOf(barber)?.label} · {barber.etaMins ? `~${barber.etaMins} min` : t("head to the chair", "pumunta na sa upuan")}</p>
            <div className="absolute -bottom-6 right-4 opacity-95"><BarberIcon name="ticket" size={120} /></div>
            <p className="relative mt-6 max-w-[70%] text-[13px] font-semibold text-on-ink-muted">{phone && sms ? t("We’ll text you when you’re next.", "I-te-text ka namin kapag ikaw na.") : t("Watch the screen or listen for your number.", "Abangan ang number mo sa screen.")}</p>
          </section>
          <section className="flex flex-col items-center rounded-card bg-surface p-6 text-center shadow-card">
            <QrCode value={`https://barbers.ph/t/${ticket.referenceId}`} size={180} label={`Track ticket ${ticket.referenceId}`} />
            <b className="mt-3 text-[17px]">{t("Track your place on your phone", "Tingnan ang pila sa phone mo")}</b>
            <span className="mt-1 text-[13.5px] font-medium text-muted">{t("Scan with your camera. No app needed.", "I-scan gamit ang camera. Walang app na kailangan.")}</span>
          </section>
        </div>
      ) : null}

      {step === "in_chair" && barber && service ? (
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col items-center">
            <ProgressRing value={progress} size={220} thickness={16} label={progress >= 100 ? <Check size={44} strokeWidth={2.4} /> : `${Math.max(1, Math.round((minutes * (100 - progress)) / 100))}m`} labelSize={40} ariaLabel={`Haircut ${progress}% done`} />
            <span className="mt-3 text-[14px] font-semibold text-muted">{t("Time left (estimate)", "Natitirang oras (tantiya)")}</span>
          </div>
          <div>
            <span className="rounded-pill bg-grey-100 px-2.5 py-[5px] text-[12px] font-bold text-ink-2">{ticket?.referenceId} · {chairOf(barber)?.label}</span>
            <h1 className="mt-3 text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em]">{t(`${barber.nickname} is on your ${service.name.toLowerCase()}`, `Ginugupitan ka na ni ${barber.nickname}`)}</h1>
            <p className="mt-2 text-[16px] font-medium text-muted">{t("Relax. When you’re happy with the cut, tap the button to confirm it’s done. Then you pay.", "Relax lang. Kapag okay na ang gupit, pindutin ang button para kumpirmahin. Saka magbayad.")}</p>
            <div className="mt-5 flex items-center gap-3 rounded-card bg-surface p-3 shadow-card">
              <Avatar name={barber.name} preset={barber.avatar} size={48} />
              <span className="flex flex-col leading-tight"><b className="text-[16px]">{barber.name}</b><span className="text-[13px] font-semibold text-muted">★ {barber.rating.avg.toFixed(1)} · {barber.cutsLabel}</span></span>
              <span className="ml-auto text-right text-[13px] font-semibold text-muted">{t("Started", "Nagsimula")} 6:40 PM<br />{minutes} min</span>
            </div>
            <p className="mt-3 text-[12.5px] font-medium text-subtle">{t("Your barber can also confirm from the queue. It auto-completes after 15 minutes.", "Puwede ring kumpirmahin ng barbero. Auto-complete pagkatapos ng 15 minuto.")}</p>
          </div>
        </div>
      ) : null}

      {step === "payment" && barber && service ? (
        <>
          <Heading eyebrow={`${ticket?.referenceId} · ${t("Haircut done", "Tapos na ang gupit")}`} title={t("How would you like to pay?", "Paano ka magbabayad?")} sub={t(`Tips go straight to ${barber.nickname} and aren’t counted as shop sales.`, `Diretso kay ${barber.nickname} ang tip at hindi kasama sa sales ng shop.`)} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
            <section className="rounded-card bg-surface p-5 shadow-card">
              <dl className="flex flex-col gap-2.5 text-[15px] font-semibold">
                <div className="flex justify-between"><dt>{service.name}</dt><dd>{peso(service.price)}</dd></div>
                {addons.map((id) => <div key={id} className="flex justify-between"><dt className="text-ink-2">+ {svc(id)!.name}</dt><dd>{peso(svc(id)!.price)}</dd></div>)}
                {voucher ? <div className="flex justify-between"><dt className="text-ink-2">{voucher.code}</dt><dd>−{peso(discount)}</dd></div> : null}
                <div className="flex justify-between border-t border-line pt-2.5"><dt className="font-extrabold">{t("Haircut", "Gupit")}</dt><dd className="font-extrabold">{peso(total)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-2">{t(`Tip for ${barber.nickname}`, `Tip para kay ${barber.nickname}`)}</dt><dd>{tip ? peso(tip) : "—"}</dd></div>
                <div className="flex justify-between rounded-[18px] bg-grey-100 px-4 py-3 text-[20px]"><dt className="font-extrabold">{t("To pay", "Babayaran")}</dt><dd className="font-extrabold">{peso(total + tip)}</dd></div>
              </dl>
              <p className="mb-2 mt-5 text-[14px] font-bold">{t("Add a tip?", "Magbibigay ng tip?")}</p>
              <div className="grid grid-cols-4 gap-2">
                {TIPS.map((v) => (
                  <button key={v} type="button" aria-pressed={tip === v} onClick={() => setTip(v)} className={cn("h-14 rounded-tile text-[16px] font-extrabold", tip === v ? "bg-ink text-on-ink shadow-raised" : "bg-grey-100")}>{v ? peso(v) : t("No tip", "Wala")}</button>
                ))}
              </div>
            </section>
            <section className="rounded-card bg-surface p-5 shadow-card">
              {awaitingOnline ? (
                <div className="flex flex-col items-center text-center">
                  <QrCode value={`https://pay.barbers.ph/${ticket?.referenceId}?m=${method}&a=${(total + tip) / 100}`} size={200} label={`${PAYMENT_LABEL[method]} payment QR`} />
                  <b className="mt-3 text-[18px]">{t(`Scan to pay ${peso(total + tip)} with ${PAYMENT_LABEL[method]}`, `I-scan para magbayad ng ${peso(total + tip)} sa ${PAYMENT_LABEL[method]}`)}</b>
                  <span className="mt-1 text-[13.5px] font-medium text-muted">{t("Show the receipt to the counter if asked.", "Ipakita ang resibo kung hingin.")}</span>
                  <Button variant="ghost" className="mt-3" onClick={() => setAwaitingOnline(false)}>{t("Choose another way", "Ibang paraan")}</Button>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-[14px] font-bold">{t("Payment method", "Paraan ng bayad")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["cash", "gcash", "maya", "card"] as PaymentMethod[]).map((m) => (
                      <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
                        className={cn("flex h-[104px] flex-col items-start justify-between rounded-[20px] p-4 text-left", method === m ? "bg-ink text-on-ink shadow-raised" : "bg-grey-100")}>
                        {METHOD_ICON[m]}<span className="flex w-full items-center justify-between"><b className="text-[17px]">{PAYMENT_LABEL[m]}</b><span className={cn("text-[12px] font-semibold", method === m ? "text-on-ink-muted" : "text-muted")}>{m === "cash" ? t("At the counter", "Sa counter") : t("Online", "Online")}</span></span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      ) : null}

      {step === "feedback" && barber ? (
        <div className="mx-auto mt-8 flex w-full max-w-[720px] flex-col items-center text-center">
          <span className="overflow-hidden rounded-full"><Portrait preset={barber.avatar} size={96} /></span>
          <span className="mt-4 rounded-pill bg-grey-100 px-2.5 py-[5px] text-[12px] font-bold text-ink-2">{t("Paid", "Bayad na")} {txn ? peso(txn.total + (txn.tip ?? 0)) : ""} · {PAYMENT_LABEL[method]}</span>
          <h1 className="mt-3 text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em]">{t(`How was your cut with ${barber.nickname}?`, `Kumusta ang gupit ni ${barber.nickname}?`)}</h1>
          <div className="mt-5 flex gap-2" role="radiogroup" aria-label={t("Rating", "Rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}
                className={cn("inline-flex size-[68px] items-center justify-center rounded-tile transition-transform active:scale-95", n <= rating ? "bg-surface shadow-card" : "bg-grey-100")}><Star size={38} filled={n <= rating} /></button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {FEEDBACK_TAGS.map((g) => { const on = tags.includes(g); return (
              <button key={g} type="button" aria-pressed={on} onClick={() => setTags((x) => on ? x.filter((y) => y !== g) : [...x, g])}
                className={cn("h-11 rounded-pill px-4 text-[14.5px] font-bold", on ? "bg-ink text-on-ink" : "bg-surface shadow-tile")}>{g}</button>
            ); })}
          </div>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("Anything else? (optional)", "May iba pa? (optional)")} aria-label="Comment"
            className="mt-5 w-full resize-none rounded-[18px] bg-surface p-4 text-[15px] font-medium shadow-card outline-none placeholder:text-subtle focus:ring-2 focus:ring-ink" />
        </div>
      ) : null}

      {step === "done" ? (
        <div className="mt-10 flex flex-col items-center">
          <SuccessState title={t(`Salamat${name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}! See you next time.`, `Salamat${name.trim() ? `, ${name.trim().split(" ")[0]}` : ""}! Balik ka ha.`)}
            description={t(`Your feedback goes to ${barber ? firstName(barber.name) : "the shop"}. Starting over in ${countdown}s.`, `Makikita ni ${barber ? firstName(barber.name) : "ng shop"} ang feedback mo. Uulit sa ${countdown}s.`)}>
            <Button size="lg" className="mt-6 w-[240px]" onClick={reset}>{t("Next customer", "Susunod")}</Button>
          </SuccessState>
        </div>
      ) : null}

      {/* bottom summary bar */}
      {step !== "done" ? (
        <div className="fixed inset-x-0 bottom-5 z-40 mx-auto w-[calc(100%-40px)] max-w-[1116px] sm:w-[calc(100%-64px)]">
          <div className="flex items-center justify-between gap-3 rounded-card bg-surface py-3 pl-4 pr-3 shadow-float">
            <span className="flex min-w-0 items-center gap-3">
              {barber ? <Avatar name={barber.name} preset={barber.avatar} size={48} /> : <span className="inline-flex size-12 items-center justify-center rounded-full bg-grey-100"><BarberIcon name="pole" size={30} /></span>}
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <b className="truncate text-[17px] font-extrabold tracking-[-0.01em]">{step === "ticket" || phase2 ? `${ticket?.referenceId ?? ""} · ${summaryTitle}` : summaryTitle}</b>
                <span className="truncate text-[13.5px] font-semibold text-muted">{step === "payment" ? `${t("To pay", "Babayaran")} ${peso(total + tip)} · ${PAYMENT_LABEL[method]}`
                  : step === "in_chair" ? `${barber ? chairOf(barber)?.label : ""} · ${t("started 6:40 PM", "nagsimula 6:40 PM")} · ${peso(total)}`
                  : step === "feedback" ? `${t("Paid", "Bayad na")} ${txn ? peso(txn.total + (txn.tip ?? 0)) : ""} · ${t("thank you!", "salamat!")}` : summarySub}</span>
              </span>
            </span>
            <span className="flex flex-none items-center gap-2.5">
              {step === "barber" || step === "haircut" || step === "confirm" || step === "ticket" ? (
                <Button size="lg" variant="ghost" onClick={step === "barber" || step === "ticket" ? reset : () => setStep(step === "confirm" ? "haircut" : "barber")}>
                  {step === "barber" ? t("Start over", "Ulitin") : step === "ticket" ? t("New customer", "Bagong customer") : t("Back", "Bumalik")}
                </Button>
              ) : step === "feedback" ? <Button size="lg" variant="ghost" onClick={() => setStep("done")}>{t("Skip", "Laktawan")}</Button> : null}
              {step === "barber" || step === "haircut" ? (
                <Button size="lg" className="w-[240px]" disabled={!canContinue} trailingIcon={<ArrowRight size={20} strokeWidth={2.2} />} onClick={() => setStep(step === "barber" ? "haircut" : "confirm")}>{t("Continue", "Tuloy")}</Button>
              ) : step === "confirm" ? (
                <Button size="lg" className="w-[240px]" disabled={busy} onClick={getTicket}>{busy ? "…" : t("Get my ticket", "Kunin ang ticket")}</Button>
              ) : step === "ticket" ? (
                <Button size="lg" className="w-[240px]" onClick={() => setStep("in_chair")}>{t("I’m in the chair", "Nasa upuan na ako")}</Button>
              ) : step === "in_chair" ? (
                <Button size="lg" className="w-[280px]" leadingIcon={<Check size={20} strokeWidth={2.2} />} onClick={confirmDone}>{t("Confirm haircut is done", "Tapos na ang gupit")}</Button>
              ) : step === "payment" ? (
                <Button size="lg" className="w-[280px]" disabled={busy} onClick={pay}>
                  {method === "cash" ? t(`Paid in cash · ${peso(total + tip)}`, `Bayad na sa cash · ${peso(total + tip)}`) : awaitingOnline ? t("I’ve paid", "Nakapagbayad na ako") : t(`Pay ${peso(total + tip)} with ${PAYMENT_LABEL[method]}`, `Magbayad sa ${PAYMENT_LABEL[method]}`)}
                </Button>
              ) : step === "feedback" ? (
                <Button size="lg" className="w-[240px]" disabled={!rating} onClick={sendFeedback}>{t("Send feedback", "Ipadala")}</Button>
              ) : null}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Heading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mt-6">
      <span className="rounded-pill bg-grey-100 px-2.5 py-[5px] text-[12px] font-bold leading-none text-ink-2">{eyebrow}</span>
      <h1 className="mt-2.5 text-[34px] font-extrabold leading-[1.1] tracking-[-0.035em]">{title}</h1>
      <p className="mt-1 text-[16px] font-medium text-muted">{sub}</p>
    </div>
  );
}

function BarberCard({ b, chair, selected, onClick, t }: { b: Barber; chair?: Chair; selected: boolean; onClick: () => void; t: (en: string, fil: string) => string }) {
  const free = !b.etaMins;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn("relative flex flex-col rounded-card bg-surface p-3 text-left shadow-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink", selected && "ring-2 ring-ink")}>
      <div className="relative flex h-[178px] w-full items-start justify-center overflow-hidden rounded-[20px]"><Portrait preset={b.avatar} size={236} /></div>
      {chair ? (
        <div className="absolute left-5 top-[146px] flex items-center gap-[9px] rounded-tile bg-surface/92 py-1.5 pl-1.5 pr-3 shadow-popover">
          <BarberIcon name={chair.art} size={26} /><span className="flex flex-col leading-[1.2]"><b className="text-[12.5px]">{chair.label}</b><small className="text-[11px] font-semibold text-muted">{free ? t("Free now", "Bakante") : t("In chair", "May ginugupitan")}</small></span>
        </div>
      ) : null}
      {selected ? <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-ink px-2.5 py-1 text-[12px] font-bold leading-none text-on-ink shadow-raised"><Check size={13} strokeWidth={2.6} />{t("Selected", "Napili")}</span> : null}
      <div className="px-1.5 pb-1 pt-3">
        <b className="block truncate text-[17px] font-extrabold tracking-[-0.02em]">{b.name}</b>
        <span className="mt-0.5 block truncate text-[13px] font-semibold text-muted">{b.specialty}</span>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink-2"><i aria-hidden className={cn("block size-[7px] rounded-full", free ? "bg-ink" : "bg-grey-400")} />{free ? t("Available now", "Bakante na") : t(`About ${b.etaMins} min`, `Mga ${b.etaMins} min`)}</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12.5px] font-semibold text-muted"><Star size={12} /><b className="text-ink">{b.rating.avg.toFixed(1)}</b> · {b.cutsLabel}</span>
        </div>
      </div>
    </button>
  );
}

function HaircutCard({ s, preset, selected, disabled, badge, onClick }: { s: Service; preset: Barber["avatar"]; selected: boolean; disabled?: boolean; badge?: { label: string; solid?: boolean }; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cn("flex items-center gap-3 rounded-card bg-surface p-3 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60", selected && "ring-2 ring-ink")}>
      <span className="flex-none overflow-hidden rounded-[19px]"><HaircutArt kind={s.kind} size={64} preset={preset} /></span>
      <span className="flex min-w-0 flex-col leading-[1.25]">
        <b className="truncate text-[15px] tracking-[-0.01em]">{s.name}</b><span className="text-[13px] font-semibold text-muted">{peso(s.price)} · {s.durationMins} min</span>
        <span className={cn("mt-1.5 inline-flex w-fit items-center rounded-pill px-2 py-[3px] text-[11px] font-bold leading-none", badge ? (badge.solid ? "bg-ink text-on-ink" : "bg-grey-100 text-ink") : "text-subtle")}>{badge?.label ?? "\u00a0"}</span>
      </span>
    </button>
  );
}
