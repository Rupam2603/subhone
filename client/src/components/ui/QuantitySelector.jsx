import { Minus, Plus, Trash2 } from "lucide-react";
import { cx } from "../../lib/format";

// Compact +/- stepper. When at `min` and `onDelete` is provided, the minus
// button turns into a trash action (used inside the cart).
export default function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  onDelete,
  min = 1,
  max = 99,
  size = "md",
  className,
}) {
  const h = size === "sm" ? "h-8" : "h-10";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const atMin = quantity <= min;
  const showTrash = atMin && typeof onDelete === "function";

  const btn =
    "grid aspect-square place-items-center text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div
      className={cx(
        "inline-flex items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-lowest",
        h,
        className
      )}
    >
      <button
        type="button"
        className={cx(btn, h, showTrash && "text-error")}
        onClick={showTrash ? onDelete : onDecrease}
        aria-label={showTrash ? "Remove item" : "Decrease quantity"}
      >
        {showTrash ? <Trash2 className={iconSize} /> : <Minus className={iconSize} />}
      </button>
      <span className="min-w-[2ch] px-1 text-center text-sm font-bold tabular">{quantity}</span>
      <button
        type="button"
        className={cx(btn, h)}
        onClick={onIncrease}
        disabled={quantity >= max}
        aria-label="Increase quantity"
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}
