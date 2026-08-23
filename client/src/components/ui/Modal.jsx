import { X } from "lucide-react";
import { cx } from "../../lib/format";
import { useEscapeKey, useLockBodyScroll } from "../../lib/hooks";

const SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

export default function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }) {
  useLockBodyScroll(open);
  useEscapeKey(onClose, open);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-surface-container-lowest shadow-drawer animate-scale-in sm:rounded-3xl",
          SIZES[size]
        )}
      >
        {(title || onClose) && (
          <div className="flex items-start justify-between gap-4 border-b border-outline-variant/60 px-6 py-4">
            <div>
              {title && <h3 className="text-lg font-bold text-on-surface">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="-mr-2 shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="border-t border-outline-variant/60 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
