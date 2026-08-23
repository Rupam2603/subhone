import { inr, discountPct, cx } from "../../lib/format";

const SIZES = {
  sm: "text-base",
  md: "text-[20px] leading-6",
  lg: "text-2xl",
};

export default function Price({ price, mrp, size = "md", showDiscount = true, className }) {
  const pct = discountPct(price, mrp);
  return (
    <div className={cx("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cx("font-display font-extrabold text-on-surface", SIZES[size])}>{inr(price)}</span>
      {mrp > price && (
        <span className="text-sm text-on-surface-variant line-through">{inr(mrp)}</span>
      )}
      {showDiscount && pct > 0 && (
        <span className="text-xs font-bold text-emerald-vibrant">{pct}% off</span>
      )}
    </div>
  );
}
