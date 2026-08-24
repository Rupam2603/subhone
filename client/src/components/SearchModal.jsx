import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Pill, Leaf, FlaskConical, TrendingUp, CornerDownLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import api from "../lib/api";
import { inr, cx } from "../lib/format";
import { useDebouncedValue, useLockBodyScroll, useEscapeKey } from "../lib/hooks";

const TRENDING = ["Paracetamol", "Whey Protein", "Full Body Checkup", "Vitamin D", "Thyroid", "Omega 3"];

const GROUPS = [
  { key: "medicines", label: "Medicines", icon: Pill, path: "/medicines" },
  { key: "supplements", label: "Supplements", icon: Leaf, path: "/supplements" },
  { key: "labTests", label: "Lab Tests", icon: FlaskConical, path: "/lab-tests" },
];

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounced = useDebouncedValue(query, 250);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useLockBodyScroll(open);
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let active = true;
    setLoading(true);
    api
      .search(q)
      .then((data) => active && setResults(data))
      .catch(() => active && setResults(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, open]);

  const go = (path, q) => {
    navigate(q ? `${path}?search=${encodeURIComponent(q)}` : path);
    onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    if (query.trim()) go("/medicines", query.trim());
  };

  const hasResults = results && results.total > 0;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex justify-center px-4 pt-[8vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-navy-deep/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -15 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative z-10 h-fit w-full max-w-2xl overflow-hidden rounded-3xl bg-surface-container-lowest shadow-2xl border border-outline-variant/50"
          >
            <form onSubmit={submit} className="flex items-center gap-3 border-b border-outline-variant/60 px-5 py-4 bg-surface-container-low/50">
              <Search className="h-5 w-5 shrink-0 text-primary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search medicines, supplements & lab tests…"
                className="flex-1 bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant/60 font-medium"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Close search"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </form>

            <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-4">
              {query.trim().length < 2 ? (
                <div className="p-2 space-y-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                    <TrendingUp className="h-4 w-4 text-primary" /> Trending searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TRENDING.map((t) => (
                      <motion.button
                        key={t}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setQuery(t)}
                        className="pill"
                      >
                        {t}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ) : loading ? (
                <div className="p-8 text-center space-y-2">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <p className="text-sm text-on-surface-variant font-medium">Searching catalog…</p>
                </div>
              ) : !hasResults ? (
                <div className="p-8 text-center">
                  <p className="font-bold text-on-surface">No matches for “{query}”</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Try searching for generic salts, brand name, or health concern.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {GROUPS.map(({ key, label, icon: Icon, path }) => {
                    const list = results[key] || [];
                    if (!list.length) return null;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between px-2 pb-1.5">
                          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                            <Icon className="h-3.5 w-3.5 text-primary" /> {label}
                          </p>
                          <button onClick={() => go(path, query.trim())} className="text-xs font-bold text-primary hover:underline">
                            See all
                          </button>
                        </div>
                        <div className="space-y-1">
                          {list.slice(0, 4).map((item) => (
                            <motion.button
                              key={item.id}
                              whileHover={{ x: 3 }}
                              onClick={() => go(path, query.trim())}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-container"
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-container-high p-1">
                                {item.image ? (
                                  <img src={item.image} alt="" className="h-full w-full object-contain mix-blend-multiply" />
                                ) : (
                                  <Icon className="h-5 w-5 text-on-surface-variant" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-on-surface">{item.name}</span>
                                <span className="block truncate text-xs text-on-surface-variant">
                                  {item.brand || item.category}
                                </span>
                              </span>
                              <span className="shrink-0 font-display text-sm font-bold text-primary">{inr(item.price)}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => go("/medicines", query.trim())}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary/10 py-3 text-sm font-bold text-primary hover:bg-primary/15 transition-colors"
                  >
                    See all {results.total} results <CornerDownLeft className="h-4 w-4" />
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
