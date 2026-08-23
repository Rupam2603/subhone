// Formatting & small pure helpers.

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export const discountPct = (price, mrp) =>
  mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : 0;

export const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A stable label -> type map used across the app.
export const TYPE_LABEL = {
  medicine: "Medicine",
  supplement: "Supplement",
  labTest: "Lab Test",
};

export const cx = (...args) => args.filter(Boolean).join(" ");
