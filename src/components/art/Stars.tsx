const STAR = "M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8Z";

/** Monochrome star (containers stay monochrome, per the kit style rules). */
export function Star({ size = 12, filled = true }: { size?: number; filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={STAR} fill={filled ? "#0A0A0A" : "#D4D4DA"} /></svg>;
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]" role="img" aria-label={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} filled={i <= value} />)}
    </span>
  );
}
