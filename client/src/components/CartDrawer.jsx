import { useNavigate } from "react-router-dom";
import { X, ShoppingBag, Truck, FileText, ArrowRight, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "../context/CartContext";
import { inr } from "../lib/format";
import { useLockBodyScroll, useEscapeKey } from "../lib/hooks";
import QuantitySelector from "./ui/QuantitySelector";
import Button from "./ui/Button";

const FREE_DELIVERY_ABOVE = 499;

function CartLine({ item }) {
  const { updateItem, removeItem } = useCart();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 py-4"
    >
      <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-container-high p-1">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-contain mix-blend-multiply" />
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
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => removeItem(item)}
            className="shrink-0 rounded-full p-1.5 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
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
    </motion.li>
  );
}

export default function CartDrawer() {
  const { items, subtotal, savings, count, drawerOpen, closeDrawer } = useCart();
  const navigate = useNavigate();

  useLockBodyScroll(drawerOpen);
  useEscapeKey(closeDrawer, drawerOpen);

  const hasRx = items.some((i) => i.prescriptionRequired);
  const toFree = Math.max(0, FREE_DELIVERY_ABOVE - subtotal);
  const freePct = Math.min(100, Math.round((subtotal / FREE_DELIVERY_ABOVE) * 100));

  const goCheckout = () => {
    closeDrawer();
    navigate("/checkout");
  };

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-[80]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-navy-deep/60 backdrop-blur-sm"
            onClick={closeDrawer}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-surface-container-lowest shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant/60 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-on-surface">
                <ShoppingBag className="h-5 w-5 text-primary" /> Your cart
                {count > 0 && <span className="text-sm font-semibold text-on-surface-variant">({count})</span>}
              </h2>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={closeDrawer}
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <motion.span
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="grid h-20 w-20 place-items-center rounded-full bg-surface-container"
                >
                  <ShoppingBag className="h-9 w-9 text-on-surface-variant" />
                </motion.span>
                <div>
                  <p className="font-display text-lg font-bold text-on-surface">Your cart is empty</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Add medicines, supplements or personal care items to get started.</p>
                </div>
                <Button variant="primary" onClick={() => { closeDrawer(); navigate("/medicines"); }}>
                  Browse medicines
                </Button>
              </div>
            ) : (
              <>
                {/* Free delivery progress */}
                <div className="border-b border-outline-variant/60 px-5 py-3 bg-surface-container-lowest">
                  <p className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                    <Truck className="h-4 w-4 text-primary" />
                    {toFree > 0 ? (
                      <span>Add <b>{inr(toFree)}</b> more for free delivery</span>
                    ) : (
                      <span className="text-primary font-bold">🎉 You've unlocked free delivery!</span>
                    )}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${freePct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Lines */}
                <div className="custom-scrollbar flex-1 overflow-y-auto px-5">
                  <ul className="divide-y divide-outline-variant/50">
                    <AnimatePresence initial={false}>
                      {items.map((item) => (
                        <CartLine key={`${item.type}-${item.id}`} item={item} />
                      ))}
                    </AnimatePresence>
                  </ul>
                  {hasRx && (
                    <div className="my-4 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <span>Some items require a doctor's prescription. You can attach it during checkout.</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-outline-variant/60 bg-surface-container-lowest px-5 py-4 shadow-lg">
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
                  <motion.div whileTap={{ scale: 0.98 }} className="mt-3">
                    <Button variant="primary" size="lg" fullWidth onClick={goCheckout}>
                      Proceed to checkout <ArrowRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
