import { useNavigate } from "react-router-dom";
import { X, ShoppingBag, Truck, FileText, ArrowRight, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { inr, cx } from "../lib/format";
import { useLockBodyScroll, useEscapeKey } from "../lib/hooks";
import QuantitySelector from "./ui/QuantitySelector";
import Button from "./ui/Button";

const FREE_DELIVERY_ABOVE = 499;

function CartLine({ item }) {
  const { updateItem, removeItem } = useCart();
  return (
    <li className="flex gap-3 py-4">
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-container-high">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-6 w-6 text-on-surface-variant" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.brand && <p className="truncate text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{item.brand}</p>}
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-on-surface">{item.name}</p>
          </div>
          <button
            onClick={() => removeItem(item)}
            className="shrink-0 rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <QuantitySelector
            size="sm"
            quantity={item.quantity}
            onIncrease={() => updateItem(item, item.quantity + 1)}
            onDecrease={() => updateItem(item, item.quantity - 1)}
            onDelete={() => removeItem(item)}
          />
          <div className="text-right">
            <p className="font-display text-sm font-bold text-on-surface">{inr(item.price * item.quantity)}</p>
            {item.originalPrice > item.price && (
              <p className="text-xs text-on-surface-variant line-through">{inr(item.originalPrice * item.quantity)}</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function CartDrawer() {
  const { items, subtotal, savings, count, drawerOpen, closeDrawer } = useCart();
  const navigate = useNavigate();

  useLockBodyScroll(drawerOpen);
  useEscapeKey(closeDrawer, drawerOpen);

  if (!drawerOpen) return null;

  const hasRx = items.some((i) => i.prescriptionRequired);
  const toFree = Math.max(0, FREE_DELIVERY_ABOVE - subtotal);
  const freePct = Math.min(100, Math.round((subtotal / FREE_DELIVERY_ABOVE) * 100));

  const goCheckout = () => {
    closeDrawer();
    navigate("/checkout");
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm animate-fade-in" onClick={closeDrawer} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface-container-lowest shadow-drawer animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-on-surface">
            <ShoppingBag className="h-5 w-5 text-primary" /> Your cart
            {count > 0 && <span className="text-sm font-semibold text-on-surface-variant">({count})</span>}
          </h2>
          <button onClick={closeDrawer} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container" aria-label="Close cart">
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-surface-container">
              <ShoppingBag className="h-9 w-9 text-on-surface-variant" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-on-surface">Your cart is empty</p>
              <p className="mt-1 text-sm text-on-surface-variant">Add medicines, supplements or a lab test to get started.</p>
            </div>
            <Button variant="primary" onClick={() => { closeDrawer(); navigate("/medicines"); }}>
              Browse medicines
            </Button>
          </div>
        ) : (
          <>
            {/* Free delivery progress */}
            <div className="border-b border-outline-variant/60 px-5 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                <Truck className="h-4 w-4 text-primary" />
                {toFree > 0 ? (
                  <span>Add <b>{inr(toFree)}</b> more for free delivery</span>
                ) : (
                  <span className="text-primary">You've unlocked free delivery!</span>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${freePct}%` }} />
              </div>
            </div>

            {/* Lines */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-5">
              <ul className="divide-y divide-outline-variant/50">
                {items.map((item) => (
                  <CartLine key={`${item.type}-${item.id}`} item={item} />
                ))}
              </ul>
              {hasRx && (
                <div className="mb-4 flex items-start gap-2 rounded-xl bg-warning-amber/15 p-3 text-xs text-navy-deep">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Some items need a valid prescription. You can upload it at checkout.</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-outline-variant/60 bg-surface-container-lowest px-5 py-4">
              {savings > 0 && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  <span>Total savings</span>
                  <span>{inr(savings)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Subtotal</span>
                <span className="font-display text-xl font-extrabold text-on-surface">{inr(subtotal)}</span>
              </div>
              <p className="mt-0.5 text-xs text-on-surface-variant">Taxes & delivery calculated at checkout.</p>
              <Button variant="primary" size="lg" fullWidth className="mt-3" onClick={goCheckout}>
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
