"use client";
import { usePartner } from "./PartnerShell";
import { ListCard, PageTitle, Section, VisitRow } from "./parts";

export function PartnerHistory() {
  const { visits } = usePartner();
  const groups = visits.reduce<Record<string, typeof visits>>((acc, v) => {
    const day = v.atLabel.startsWith("Today") ? "Today" : v.atLabel.split(" ")[0]!;
    (acc[day] ??= []).push(v);
    return acc;
  }, {});
  const ok = visits.filter((v) => v.status !== "no_show").length;
  const noShow = visits.length - ok;
  return (
    <>
      <PageTitle title="History" subtitle="Verified River Mobile visits" back={null} />
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2.5">
        {[["This week", String(ok)], ["No-shows", String(noShow)], ["Show rate", `${Math.round((ok / Math.max(1, visits.length)) * 100)}%`]].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-[18px] bg-surface p-3 leading-tight shadow-card"><small className="text-[12px] font-semibold text-muted">{k}</small><b className="mt-0.5 text-[20px] font-extrabold tracking-[-0.02em]">{v}</b></div>
        ))}
      </div>
      {Object.entries(groups).map(([day, list]) => (
        <Section key={day} title={{ Today: "Today", Sat: "Saturday", Fri: "Friday", Thu: "Thursday", Wed: "Wednesday", Tue: "Tuesday", Mon: "Monday" }[day] ?? day} aside={`${list.length}`}>
          <ListCard>{list.map((v, i) => <VisitRow key={v.id} v={v} first={i === 0} />)}</ListCard>
        </Section>
      ))}
    </>
  );
}
