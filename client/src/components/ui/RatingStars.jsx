import { Star } from "lucide-react";
import { cx } from "../../lib/format";

export default function RatingStars({ rating = 0, reviews, size = "sm", showValue = true, className }) {
  const dims = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">
        <Star className={cx(dims, "fill-current")} strokeWidth={0} />
        {showValue && <span className="text-xs font-bold tabular">{Number(rating).toFixed(1)}</span>}
      </span>
      {reviews != null && (
        <span className="text-xs text-on-surface-variant">
          ({Number(reviews).toLocaleString("en-IN")})
        </span>
      )}
    </div>
  );
}
