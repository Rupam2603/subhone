import { Loader2 } from "lucide-react";
import { cx } from "../../lib/format";

export function Spinner({ className }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-primary", className)} />;
}

export function SectionHeader({ eyebrow, title, subtitle, action, className }) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && <span className="eyebrow mb-2">{eyebrow}</span>}
        <h2 className="text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-body-md text-on-surface-variant">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, className }) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant bg-surface-container-low px-6 py-16 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-on-surface-variant">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-square w-full" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-3 w-2/5 rounded" />
        <div className="skeleton mt-3 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}

export function LabCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton h-3 w-1/4 rounded" />
      <div className="skeleton mt-3 h-5 w-3/4 rounded" />
      <div className="skeleton mt-4 h-16 w-full rounded-xl" />
      <div className="skeleton mt-4 h-10 w-full rounded-full" />
    </div>
  );
}

export function CardGridSkeleton({ count = 8, variant = "product" }) {
  const Item = variant === "lab" ? LabCardSkeleton : ProductCardSkeleton;
  return (
    <div
      className={cx(
        "grid gap-4",
        variant === "lab"
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}
