import { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Search, ShoppingCart, Menu, X, Upload, Stethoscope, Package, MapPin, Plus, ArrowLeft, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { cx } from "../lib/format";
import SearchModal from "./SearchModal";

const NAV = [
  { to: "/medicines", label: "Medicines" },
  { to: "/supplements", label: "Supplements" },
  { to: "/lab-tests", label: "Lab Tests" },
  { to: "/consult", label: "Consult" },
];

function Logo({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex shrink-0 items-center gap-2 group">
      <motion.span
        whileHover={{ scale: 1.05, rotate: 5 }}
        whileTap={{ scale: 0.95 }}
        className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-on-primary shadow-pill"
      >
        <Plus className="h-5 w-5" strokeWidth={3} />
      </motion.span>
      <span className="font-display text-xl font-extrabold tracking-tight text-on-surface">
        Subh<span className="text-primary">One</span>
      </span>
    </Link>
  );
}

export default function Header() {
  const { count, openDrawer } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navClass = ({ isActive }) =>
    cx(
      "relative py-1 text-sm font-semibold transition-colors hover:text-primary",
      isActive ? "text-primary font-bold" : "text-on-surface-variant"
    );

  return (
    <>
      {/* Announcement strip */}
      <div className="bg-primary text-on-primary">
        <div className="container-max flex h-9 items-center justify-center gap-2 text-center text-xs font-medium sm:text-[13px]">
          <MapPin className="h-3.5 w-3.5" />
          <span>
            Get <b>20% off</b> your first order with <b>FIRST20</b> · Free delivery over ₹499
          </span>
        </div>
      </div>

      <header
        className={cx(
          "sticky top-0 z-50 border-b bg-surface-container-lowest/90 backdrop-blur-md transition-all duration-300",
          scrolled ? "border-outline-variant/60 shadow-header py-0.5" : "border-transparent"
        )}
      >
        <div className="container-max flex h-16 items-center gap-3 md:gap-6">
          {!isHome && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}
          <Logo />

          {/* Desktop search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden h-11 flex-1 items-center gap-3 rounded-full border border-outline-variant bg-surface-container-low px-4 text-left text-sm text-on-surface-variant transition-all hover:border-primary/50 hover:bg-surface-container-lowest hover:shadow-sm md:flex"
          >
            <Search className="h-4 w-4 text-primary" />
            <span>Search for medicines, supplements & lab tests…</span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {({ isActive }) => (
                  <span className="relative">
                    {n.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavTab"
                        className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setSearchOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </motion.button>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                to="/upload-prescription"
                className="hidden items-center gap-2 rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 md:inline-flex"
              >
                <Upload className="h-4 w-4" /> Upload Rx
              </Link>
            </motion.div>

            {isAuthenticated ? (
              <div className="group relative hidden sm:block">
                <button className="flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                  {user?.name?.split(" ")[0]}
                </button>
                <div className="absolute right-0 top-full mt-1 hidden w-48 flex-col overflow-hidden rounded-2xl border border-outline-variant/60 bg-surface-container-lowest shadow-lg group-hover:flex">
                  <Link to="/orders" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-on-surface hover:bg-surface-container">
                    <Package className="h-4 w-4 text-primary" /> My orders
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-error hover:bg-error/5">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/login" className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 sm:flex">
                  Sign in
                </Link>
              </motion.div>
            )}

            {/* Cart Button with animated badge */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={openDrawer}
              className="relative grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              aria-label={`Cart with ${count} items`}
            >
              <ShoppingCart className="h-5 w-5" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-warning-amber px-1 text-[11px] font-bold text-navy-deep shadow-sm"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setMobileOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-navy-deep/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="absolute right-0 top-0 flex h-full w-[82%] max-w-xs flex-col bg-surface-container-lowest shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/60 px-5 py-4">
                <Logo onClick={() => setMobileOpen(false)} />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full p-2 hover:bg-surface-container"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        "rounded-xl px-4 py-3 text-base font-semibold transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container"
                      )
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
                <div className="my-2 h-px bg-outline-variant/60" />
                <Link to="/upload-prescription" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-on-surface hover:bg-surface-container">
                  <Upload className="h-5 w-5 text-primary" /> Upload prescription
                </Link>
                <Link to="/consult" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-on-surface hover:bg-surface-container">
                  <Stethoscope className="h-5 w-5 text-primary" /> Consult a doctor
                </Link>
                {isAuthenticated ? (
                  <>
                    <Link to="/orders" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-on-surface hover:bg-surface-container">
                      <Package className="h-5 w-5 text-primary" /> My orders
                    </Link>
                    <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold text-error hover:bg-error/5">
                      <LogOut className="h-5 w-5" /> Sign out ({user?.name})
                    </button>
                  </>
                ) : (
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-base font-semibold text-on-primary">
                    Sign in
                  </Link>
                )}
              </nav>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
