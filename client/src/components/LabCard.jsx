import { FlaskConical, Home, Clock, Check, TestTube2, CalendarClock } from "lucide-react";
import { useCart } from "../context/CartContext";
import { discountPct, cx } from "../lib/format";
import Price from "./ui/Price";
import Button from "./ui/Button";

// Health-package card. If `onBook` is provided the primary action books a slot;
// otherwise it adds the package to the cart.
export default function LabCard({ test, onBook }) {
  const { addItem, isInCart } = useCart();
  const pct = discountPct(test.price, test.originalPrice);
  const inCart = isInCart(test.id, "labTest");

  const handlePrimary = () => {
    if (typeof onBook === "function") onBook(test);
    else addItem(test);
  };

  return (
    <article className="card card-hover flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tertiary">
          <TestTube2 className="h-4 w-4" /> {test.category}
        </span>
        {test.bestseller && <span className="badge badge-best">Bestseller</span>}
      </div>

      <h3 className="mt-2 font-display text-lg font-extrabold leading-tight text-on-surface">{test.name}</h3>

      <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
        <FlaskConical className="h-4 w-4" /> {test.testCount} tests included
      </div>

      {Array.isArray(test.includes) && (
        <ul className="mt-3 space-y-1.5">
          {test.includes.slice(0, 3).map((inc) => (
            <li key={inc} className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Check className="h-4 w-4 shrink-0 text-emerald-vibrant" /> {inc}
            </li>
          ))}
          {test.includes.length > 3 && (
            <li className="pl-6 text-sm font-semibold text-primary">
              +{test.includes.length - 3} more parameters
            </li>
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-on-surface-variant">
        {test.homeCollection && (
          <span className="inline-flex items-center gap-1"><Home className="h-3.5 w-3.5" /> Free home collection</span>
        )}
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.reportsIn || test.turnaroundTime}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-outline-variant/60 pt-4">
        <Price price={test.price} mrp={test.originalPrice} />
        {pct > 0 && (
          <span className="rounded-full bg-warning-amber/20 px-2 py-0.5 text-xs font-bold text-navy-deep">
            Save {pct}%
          </span>
        )}
      </div>

      <Button
        variant="primary"
        size="md"
        fullWidth
        className={cx("mt-4", inCart && !onBook && "!bg-primary-container")}
        onClick={handlePrimary}
      >
        {onBook ? (
          <><CalendarClock className="h-4 w-4" /> Book now</>
        ) : inCart ? (
          "Added to cart"
        ) : (
          "Add to cart"
        )}
      </Button>
    </article>
  );
}
