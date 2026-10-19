import Link from "next/link";
import { LEGAL_DRAFT_NOTICE, type LegalDoc } from "@/lib/legal";

/**
 * Escapes everything, then re-allows only <b>…</b>. The legal copy is our own static text in
 * src/lib/legal.ts, but the sink stays safe even if someone later pastes other markup into it.
 */
export function boldOnly(html: string): string {
  return html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&lt;(\/?)b&gt;/g, "<$1b>");
}

/** Terms / Privacy page. Content is our own static text (simple <b> markup only). */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "terms" ? { href: "/privacy", label: "Privacy Policy" } : { href: "/terms", label: "Terms of Service" };
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-6 lg:px-[30px] lg:pt-10">
      <Link href="/" className="text-[14px] font-bold text-muted">← Barbers.ph</Link>
      <h1 className="mt-4 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{doc.title}</h1>
      <p className="mt-1 text-[13.5px] font-semibold text-muted">{doc.effective} · {LEGAL_DRAFT_NOTICE}</p>
      <div className="mt-5 flex flex-col gap-3 text-[15px] leading-[1.55]">
        {doc.intro.map((p) => <p key={p}>{p}</p>)}
      </div>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-7 scroll-mt-6">
          <h2 className="text-[17px] font-extrabold tracking-[-0.01em]">{s.title}</h2>
          <div className="mt-2 flex flex-col gap-2.5 text-[15px] leading-[1.55]">
            {s.blocks.map((b, i) => typeof b === "string"
              ? <p key={i} dangerouslySetInnerHTML={{ __html: boldOnly(b) }} />
              : <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5">{b.list.map((li) => <li key={li} dangerouslySetInnerHTML={{ __html: boldOnly(li) }} />)}</ul>)}
          </div>
        </section>
      ))}
      <p className="mt-10 border-t border-line pt-4 text-[13.5px] font-semibold text-muted">
        See also <Link href={other.href} className="text-ink underline">{other.label}</Link>.
      </p>
    </main>
  );
}
