import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MapPin, CreditCard, Truck, ShoppingBag, Tag, ChevronRight,
  ArrowLeft, Package, Shield, Clock, CheckCircle2, AlertCircle,
  Banknote, Smartphone, Building2, X, FileText, Loader2
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { inr, cx, discountPct } from "../lib/format";
import api from "../lib/api";
import { sendOrderConfirmationNotification } from "../lib/emailjs";
import Button from "../components/ui/Button";
import QuantitySelector from "../components/ui/QuantitySelector";

const FREE_DELIVERY_ABOVE = 499;
const DELIVERY_FEE = 49;

const PAYMENT_METHODS = [
  { id: "cod", label: "Cash on Delivery", icon: Banknote, desc: "Pay when your order arrives" },
  { id: "upi", label: "UPI", icon: Smartphone, desc: "Google Pay, PhonePe, Paytm" },
  { id: "card", label: "Credit / Debit Card", icon: CreditCard, desc: "Visa, Mastercard, RuPay" },
  { id: "netbanking", label: "Net Banking", icon: Building2, desc: "All major banks supported" },
];

function OrderLine({ item, updateItem, removeItem }) {
  return (
    <li className="flex gap-3 py-3">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-container-high">
        {item.image ? (
          <img src={item.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <FileText className="h-5 w-5 text-on-surface-variant" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {item.brand && (
              <p className="truncate text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                {item.brand}
              </p>
            )}
            <p className="line-clamp-1 text-sm font-semibold leading-tight text-on-surface">{item.name}</p>
          </div>
          <button
            onClick={() => removeItem(item)}
            className="shrink-0 rounded-full p-1 text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
            aria-label={`Remove ${item.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
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
              <p className="text-[11px] text-on-surface-variant line-through">{inr(item.originalPrice * item.quantity)}</p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function AddressInput({ label, field, type = "text", placeholder, value, error, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className={cx("input", error && "!border-error !ring-error/10")}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

function StepBadge({ step, active, done }) {
  return (
    <span
      className={cx(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-all",
        done
          ? "bg-primary text-on-primary"
          : active
            ? "bg-primary text-on-primary shadow-pill"
            : "bg-surface-container-high text-on-surface-variant"
      )}
    >
      {done ? <CheckCircle2 className="h-4 w-4" /> : step}
    </span>
  );
}

const emptyAddress = { name: "", phone: "", street: "", city: "", state: "", pincode: "" };

export default function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, savings, count, updateItem, removeItem, clear } = useCart();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState(1); // 1: Address, 2: Payment, 3: Confirm
  const [address, setAddress] = useState(emptyAddress);
  const [addressErrors, setAddressErrors] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);

  const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  const couponDiscount = couponApplied ? couponApplied.discount : 0;
  const total = Math.max(0, subtotal + deliveryFee - couponDiscount);
  const hasRx = items.some((i) => i.prescriptionRequired);

  const stepLabels = ["Delivery", "Payment", "Review"];

  // Address validation
  const validateAddress = () => {
    const errs = {};
    if (!address.name.trim()) errs.name = "Full name is required";
    if (!address.phone.trim()) errs.phone = "Phone number is required";
    else if (!/^[6-9]\d{9}$/.test(address.phone.trim())) errs.phone = "Enter a valid 10-digit number";
    if (!address.street.trim()) errs.street = "Street address is required";
    if (!address.city.trim()) errs.city = "City is required";
    if (!address.state.trim()) errs.state = "State is required";
    if (!address.pincode.trim()) errs.pincode = "PIN code is required";
    else if (!/^\d{6}$/.test(address.pincode.trim())) errs.pincode = "Enter a valid 6-digit PIN";
    setAddressErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddressField = (field, value) => {
    setAddress((a) => ({ ...a, [field]: value }));
    if (addressErrors[field]) setAddressErrors((e) => ({ ...e, [field]: undefined }));
  };

  const goToStep = (s) => {
    if (s === 2 && !validateAddress()) return;
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Coupon
  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const data = await api.validateCoupon(couponCode.trim());
      setCouponApplied({ code: couponCode.trim().toUpperCase(), discount: data.discount || data.discountPaise / 100 || 50 });
    } catch (e) {
      setCouponError(e.message || "Invalid coupon code");
      setCouponApplied(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
  };

  // Place order
  const placeOrder = async () => {
    setPlacing(true);
    try {
      const order = await api.checkout({
        address,
        paymentMethod,
        couponCode: couponApplied?.code || undefined,
        items: items.map((i) => ({
          id: i.id,
          type: i.type,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          originalPrice: i.originalPrice,
        })),
      });
      setOrderPlaced(order);
      clear();

      // Trigger EmailJS order confirmation notification
      sendOrderConfirmationNotification(order).catch((err) =>
        console.debug("[Order EmailJS]", err)
      );
    } catch (e) {
      alert(e.message || "Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  // ─── ORDER PLACED SUCCESS ───
  if (orderPlaced) {
    return (
      <div className="container-max py-12">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-on-surface">Order Placed!</h1>
          <p className="mt-3 text-on-surface-variant">
            Your order <span className="font-bold text-on-surface">#{orderPlaced.id || orderPlaced.orderId || "—"}</span> has
            been placed successfully.
          </p>
          <div className="mt-6 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Total paid</span>
              <span className="font-display text-lg font-extrabold text-on-surface">{inr(total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Payment</span>
              <span className="font-semibold text-on-surface">{PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">Delivery to</span>
              <span className="font-semibold text-on-surface">{address.name}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-primary font-semibold">
            <Clock className="h-4 w-4" />
            Estimated delivery in 2–4 business days
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="primary" onClick={() => navigate("/orders")}>
              <Package className="h-4 w-4" /> View Orders
            </Button>
            <Button variant="outline" onClick={() => navigate("/")}>
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── EMPTY CART ───
  if (!items.length) {
    return (
      <div className="container-max py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-surface-container">
            <ShoppingBag className="h-12 w-12 text-on-surface-variant" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-on-surface">Your cart is empty</h1>
          <p className="mt-2 text-on-surface-variant">Add medicines, supplements or a lab test to proceed to checkout.</p>
          <Button variant="primary" className="mt-6" onClick={() => navigate("/medicines")}>
            Browse Medicines
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="container-max py-6 md:py-10">
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="font-display text-2xl font-extrabold text-on-surface md:text-3xl">Checkout</h1>

      {/* Step progress */}
      <div className="mt-6 flex items-center gap-2 md:gap-3">
        {stepLabels.map((label, i) => {
          const s = i + 1;
          return (
            <button
              key={label}
              onClick={() => s < step && goToStep(s)}
              disabled={s > step}
              className={cx(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-all",
                s === step && "bg-primary/10 text-primary",
                s < step && "text-on-surface-variant hover:text-primary",
                s > step && "text-on-surface-variant/50 cursor-not-allowed"
              )}
            >
              <StepBadge step={s} active={s === step} done={s < step} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="text-xs text-on-surface-variant">Step {step} of 3</span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* ─── LEFT COLUMN ─── */}
        <div className="min-w-0">
          {/* STEP 1: Address */}
          {step === 1 && (
            <div className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-on-surface">
                <MapPin className="h-5 w-5 text-primary" /> Delivery Address
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <AddressInput label="Full Name" field="name" placeholder="Subhasis Das" value={address.name} error={addressErrors.name} onChange={handleAddressField} />
                <AddressInput label="Phone Number" field="phone" type="tel" placeholder="9876543210" value={address.phone} error={addressErrors.phone} onChange={handleAddressField} />
                <div className="sm:col-span-2">
                  <AddressInput label="Street Address" field="street" placeholder="123 MG Road, Apt 4B" value={address.street} error={addressErrors.street} onChange={handleAddressField} />
                </div>
                <AddressInput label="City" field="city" placeholder="Kolkata" value={address.city} error={addressErrors.city} onChange={handleAddressField} />
                <AddressInput label="State" field="state" placeholder="West Bengal" value={address.state} error={addressErrors.state} onChange={handleAddressField} />
                <AddressInput label="PIN Code" field="pincode" type="text" placeholder="700001" value={address.pincode} error={addressErrors.pincode} onChange={handleAddressField} />
              </div>
              <div className="mt-6 flex justify-end">
                <Button variant="primary" onClick={() => goToStep(2)}>
                  Continue to Payment <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment */}
          {step === 2 && (
            <div className="card p-6">
              <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-on-surface">
                <CreditCard className="h-5 w-5 text-primary" /> Payment Method
              </h2>
              <div className="mt-5 grid gap-3">
                {PAYMENT_METHODS.map((pm) => {
                  const Icon = pm.icon;
                  const selected = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      onClick={() => setPaymentMethod(pm.id)}
                      className={cx(
                        "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                        selected
                          ? "border-primary bg-primary/5 shadow-pill"
                          : "border-outline-variant/60 bg-surface-container-lowest hover:border-primary/30"
                      )}
                    >
                      <span
                        className={cx(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors",
                          selected ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-on-surface">{pm.label}</p>
                        <p className="text-xs text-on-surface-variant">{pm.desc}</p>
                      </div>
                      <span
                        className={cx(
                          "h-5 w-5 shrink-0 rounded-full border-2 transition-all",
                          selected ? "border-primary bg-primary" : "border-outline-variant"
                        )}
                      >
                        {selected && (
                          <span className="flex h-full w-full items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-on-primary" />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={() => goToStep(1)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button variant="primary" onClick={() => goToStep(3)}>
                  Review Order <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Address summary */}
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-bold text-on-surface">Deliver to: {address.name}</p>
                      <p className="mt-0.5 text-sm text-on-surface-variant">
                        {address.street}, {address.city}, {address.state} – {address.pincode}
                      </p>
                      <p className="mt-0.5 text-sm text-on-surface-variant">Phone: {address.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => goToStep(1)} className="text-sm font-semibold text-primary hover:underline">
                    Change
                  </button>
                </div>
              </div>

              {/* Payment summary */}
              <div className="card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const pm = PAYMENT_METHODS.find((m) => m.id === paymentMethod);
                      const Icon = pm.icon;
                      return (
                        <>
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-bold text-on-surface">{pm.label}</p>
                            <p className="text-xs text-on-surface-variant">{pm.desc}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button onClick={() => goToStep(2)} className="text-sm font-semibold text-primary hover:underline">
                    Change
                  </button>
                </div>
              </div>

              {/* Items */}
              <div className="card p-5">
                <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-on-surface">
                  <ShoppingBag className="h-4 w-4 text-primary" /> Items ({count})
                </h3>
                <ul className="mt-2 divide-y divide-outline-variant/50">
                  {items.map((item) => (
                    <OrderLine key={`${item.type}-${item.id}`} item={item} updateItem={updateItem} removeItem={removeItem} />
                  ))}
                </ul>
              </div>

              {hasRx && (
                <div className="flex items-start gap-2 rounded-xl bg-warning-amber/15 p-4 text-sm text-navy-deep">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>
                    Some items require a valid prescription. Our pharmacist will contact you after the order is placed.{" "}
                    <Link to="/upload-prescription" className="font-semibold text-primary underline">
                      Upload now
                    </Link>
                  </span>
                </div>
              )}

              {/* Place order button (mobile) */}
              <div className="lg:hidden">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={placeOrder}
                  disabled={placing}
                >
                  {placing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Placing Order…
                    </>
                  ) : (
                    <>
                      Place Order • {inr(total)}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-xs text-on-surface-variant">
                  <Shield className="mr-1 inline h-3.5 w-3.5" />
                  Your data is encrypted and secure
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT COLUMN: ORDER SUMMARY ─── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h3 className="font-display text-lg font-extrabold text-on-surface">Order Summary</h3>

            {/* Compact item list */}
            <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto custom-scrollbar">
              {items.map((item) => (
                <li key={`${item.type}-${item.id}`} className="flex items-center justify-between text-sm">
                  <span className="line-clamp-1 flex-1 text-on-surface-variant">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="ml-2 shrink-0 font-semibold text-on-surface">{inr(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className="my-4 h-px bg-outline-variant/60" />

            {/* Coupon */}
            <div className="mb-4">
              {couponApplied ? (
                <div className="flex items-center justify-between rounded-xl bg-primary/10 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Tag className="h-4 w-4" />
                    {couponApplied.code} applied • –{inr(couponApplied.discount)}
                  </div>
                  <button onClick={removeCoupon} className="text-on-surface-variant hover:text-error">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1 !h-10 text-sm"
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value); setCouponError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    />
                    <Button variant="outline" size="sm" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}>
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  {couponError && <p className="mt-1 text-xs text-error">{couponError}</p>}
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">Try: WELCOME50, HEALTH10</p>
                </div>
              )}
            </div>

            {/* Pricing breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Subtotal ({count} items)</span>
                <span className="font-semibold text-on-surface">{inr(subtotal)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-primary">
                  <span className="font-semibold">Savings</span>
                  <span className="font-semibold">–{inr(savings)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span className="font-semibold">Coupon discount</span>
                  <span className="font-semibold">–{inr(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Delivery</span>
                {deliveryFee === 0 ? (
                  <span className="font-semibold text-primary">FREE</span>
                ) : (
                  <span className="font-semibold text-on-surface">{inr(deliveryFee)}</span>
                )}
              </div>
            </div>

            <div className="my-4 h-px bg-outline-variant/60" />

            <div className="flex items-center justify-between">
              <span className="font-display text-base font-extrabold text-on-surface">Total</span>
              <span className="font-display text-xl font-extrabold text-on-surface">{inr(total)}</span>
            </div>

            {/* Desktop place order */}
            <div className="mt-4 hidden lg:block">
              {step === 3 ? (
                <Button variant="primary" size="lg" fullWidth onClick={placeOrder} disabled={placing}>
                  {placing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Placing Order…
                    </>
                  ) : (
                    <>Place Order • {inr(total)}</>
                  )}
                </Button>
              ) : (
                <Button variant="primary" size="lg" fullWidth onClick={() => goToStep(step + 1)}>
                  {step === 1 ? "Continue to Payment" : "Review Order"} <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              <p className="mt-2 text-center text-xs text-on-surface-variant">
                <Shield className="mr-1 inline h-3.5 w-3.5" />
                Your data is encrypted and secure
              </p>
            </div>
          </div>

          {/* Trust signals */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: Truck, text: "Free delivery over ₹499" },
              { icon: Shield, text: "100% genuine products" },
              { icon: Clock, text: "2–4 day delivery" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-3 text-center"
              >
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-[11px] font-semibold leading-tight text-on-surface-variant">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
