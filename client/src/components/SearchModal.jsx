import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Pill, Leaf, FlaskConical, TrendingUp, CornerDownLeft } from "lucide-react";
import api from "../lib/api";
import { inr, cx } from "../lib/format";
import { useDebouncedValue, useLockBodyScroll, useEscapeKey } from "../lib/hooks";

const TRENDING = ["Paracetamol", "Whey Protein", "Full Body Checkup", "Vitamin D", "Thyroid"];

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

  if (!open) return null;

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
    <div className="fixed inset-0 z-[95] flex justify-center px-4 pt-[8vh]">
      <div className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 h-fit w-full max-w-2xl overflow-hidden rounded-3xl bg-surface-container-lowest shadow-drawer animate-scale-in">
        <form onSubmit={submit} className="flex items-center gap-3 border-b border-outline-variant/60 px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-on-surface-variant" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search medicines, supplements & lab tests…"
            className="flex-1 bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant/60"
          />
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container" aria-label="Close search">
            <X className="h-5 w-5" />
          </button>
        </form>

        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto p-3">
          {query.trim().length < 2 ? (
            <div className="p-3">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                <TrendingUp className="h-4 w-4" /> Trending searches
              </p>
              <div className="flex flex-wrap gap-2">
                {TRENDING.map((t) => (
                  <button key={t} onClick={() => setQuery(t)} className="pill">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : loading ? (
            <p className="p-6 text-center text-sm text-on-surface-variant">Searching…</p>
          ) : !hasResults ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-on-surface">No matches for “{query}”</p>
              <p className="mt-1 text-sm text-on-surface-variant">Try a brand, molecule or test name.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {GROUPS.map(({ key, label, icon: Icon, path }) => {
                const list = results[key] || [];
                if (!list.length) return null;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between px-2 pb-1">
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </p>
                      <button onClick={() => go(path, query.trim())} className="text-xs font-semibold text-primary hover:underline">
                        See all
                      </button>
                    </div>
                    {list.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => go(path, query.trim())}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-container"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-container-high">
                          {item.image ? (
                            <img src={item.image} alt="" className="h-full w-full object-cover" />
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
                        <span className="shrink-0 font-display text-sm font-bold text-on-surface">{inr(item.price)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
              <button onClick={() => go("/medicines", query.trim())} className={cx("flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-low py-3 text-sm font-semibold text-primary hover:bg-surface-container")}>
                See all {results.total} results <CornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
