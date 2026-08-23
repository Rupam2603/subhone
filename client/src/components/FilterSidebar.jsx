import { Star, Check } from "lucide-react";
import { inr, cx } from "../lib/format";

// Presentational filter panel. Parent owns `value` and converts arrays → CSV for the API.
// value = { brand:[], dosageForm:[], category:[], maxPrice:number|"", inStock:bool, minRating:number }
export default function FilterSidebar({ facets = {}, value, onChange, onClear, priceMax = 2000, className }) {
  const { brands = [], dosageForms = [], categories = [] } = facets;

  const toggle = (key, item) => {
    const list = value[key] || [];
    const next = list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
    onChange({ ...value, [key]: next });
  };

  const set = (patch) => onChange({ ...value, ...patch });

  const activeCount =
    (value.brand?.length || 0) +
    (value.dosageForm?.length || 0) +
    (value.category?.length || 0) +
    (value.inStock ? 1 : 0) +
    (value.minRating ? 1 : 0) +
    (value.maxPrice ? 1 : 0);

  return (
    <div className={cx("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-extrabold text-on-surface">
          Filters {activeCount > 0 && <span className="text-primary">({activeCount})</span>}
        </h3>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs font-semibold text-primary hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Price */}
      <Section title="Max price">
        <input
          type="range"
          min={0}
          max={priceMax}
          step={50}
          value={value.maxPrice || priceMax}
          onChange={(e) => set({ maxPrice: Number(e.target.value) === priceMax ? "" : Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="mt-1 flex justify-between text-xs font-semibold text-on-surface-variant">
          <span>{inr(0)}</span>
          <span className="text-on-surface">Up to {value.maxPrice ? inr(value.maxPrice) : inr(priceMax)}</span>
        </div>
      </Section>

      {categories.length > 0 && (
        <Section title="Category">
          {categories.map((c) => (
            <CheckRow key={c} label={c} checked={value.category?.includes(c)} onClick={() => toggle("category", c)} />
          ))}
        </Section>
      )}

      {dosageForms.length > 0 && (
        <Section title="Form">
          {dosageForms.map((d) => (
            <CheckRow key={d} label={d} checked={value.dosageForm?.includes(d)} onClick={() => toggle("dosageForm", d)} />
          ))}
        </Section>
      )}

      {brands.length > 0 && (
        <Section title="Brand">
          <div className="custom-scrollbar max-h-52 space-y-0.5 overflow-y-auto pr-1">
            {brands.map((b) => (
              <CheckRow key={b} label={b} checked={value.brand?.includes(b)} onClick={() => toggle("brand", b)} />
            ))}
          </div>
        </Section>
      )}

      {/* Rating */}
      <Section title="Rating">
        {[4, 3].map((r) => (
          <button
            key={r}
            onClick={() => set({ minRating: value.minRating === r ? 0 : r })}
            className={cx(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
              value.minRating === r ? "bg-primary/10 font-semibold text-primary" : "text-on-surface hover:bg-surface-container"
            )}
          >
            <Star className={cx("h-4 w-4", value.minRating === r ? "fill-warning-amber text-warning-amber" : "fill-warning-amber/70 text-warning-amber/70")} />
            {r}+ & above
          </button>
        ))}
      </Section>

      {/* In stock */}
      <label className="flex cursor-pointer items-center justify-between rounded-xl bg-surface-container-low px-3 py-2.5">
        <span className="text-sm font-semibold text-on-surface">In stock only</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!value.inStock}
          onClick={() => set({ inStock: !value.inStock })}
          className={cx("relative h-6 w-11 rounded-full transition-colors", value.inStock ? "bg-primary" : "bg-outline-variant")}
        >
          <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", value.inStock ? "translate-x-[22px]" : "translate-x-0.5")} />
        </button>
      </label>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function CheckRow({ label, checked, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
    >
      <span
        className={cx(
          "grid h-4.5 w-4.5 shrink-0 place-items-center rounded-[5px] border transition-colors",
          checked ? "border-primary bg-primary text-on-primary" : "border-outline-variant"
        )}
        style={{ height: "1.15rem", width: "1.15rem" }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={cx("truncate capitalize", checked && "font-semibold text-primary")}>{label}</span>
    </button>
  );
}
