import { Link } from "react-router-dom";
import { Plus, Truck, ShieldCheck, Clock, BadgeIndianRupee } from "lucide-react";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { label: "Medicines", to: "/medicines" },
      { label: "Health supplements", to: "/supplements" },
      { label: "Lab tests & checkups", to: "/lab-tests" },
      { label: "Upload prescription", to: "/upload-prescription" },
    ],
  },
  {
    title: "Care",
    links: [
      { label: "Consult a doctor", to: "/consult" },
      { label: "My orders", to: "/orders" },
      { label: "Track an order", to: "/orders" },
      { label: "Health guides", to: "/" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About SubhOne", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Partner pharmacies", to: "/" },
      { label: "Contact us", to: "/" },
    ],
  },
];

const TRUST = [
  { icon: Truck, label: "Delivery in 30–90 min" },
  { icon: ShieldCheck, label: "100% genuine medicines" },
  { icon: BadgeIndianRupee, label: "Best price, always" },
  { icon: Clock, label: "24×7 pharmacist support" },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-outline-variant/60 bg-surface-container-low">
      {/* Trust bar */}
      <div className="border-b border-outline-variant/60">
        <div className="container-max grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-on-surface">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="container-max grid gap-8 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-on-primary shadow-pill">
              <Plus className="h-5 w-5" strokeWidth={3} />
            </span>
            <span className="font-display text-xl font-extrabold tracking-tight text-on-surface">
              Subh<span className="text-primary">One</span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-on-surface-variant">
            Your neighbourhood health companion — medicines, supplements, lab tests and doctor consults, delivered with care.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-on-surface transition-colors hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-outline-variant/60">
        <div className="container-max flex flex-col items-center justify-between gap-2 py-5 text-xs text-on-surface-variant sm:flex-row">
          <p>© 2026 SubhOne Health. For demo purposes only — not a real pharmacy.</p>
          <p className="flex items-center gap-4">
            <Link to="/" className="hover:text-primary">Privacy</Link>
            <Link to="/" className="hover:text-primary">Terms</Link>
            <span>Made with care in Kolkata</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
