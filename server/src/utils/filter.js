// Mongo query-builder for catalog endpoints. Replaces the old in-memory
// applyFilters/applySort helpers — the catalog now lives in Mongo and prices
// are stored in paise, so numeric filters compare against pricePaise directly.

const SORTS = {
  "price-asc": { pricePaise: 1 },
  "price-desc": { pricePaise: -1 },
  "rating-desc": { rating: -1 },
  "name-asc": { name: 1 },
  discount: { discountPct: -1 },
  popularity: { reviews: -1 },
};

const buildSort = (sort) => SORTS[sort] || { reviews: -1 };

function buildFilter(query, base = {}) {
  const filter = { ...base };
  if (query.search) filter.name = { $regex: String(query.search).trim(), $options: "i" };
  if (query.brand) filter.brand = query.brand;
  if (query.category) filter.category = query.category;
  if (query.dosageForm) filter.dosageForm = query.dosageForm;
  if (String(query.inStock) === "true") filter.inStock = true;
  const min = query.minPrice === undefined ? null : Number(query.minPrice);
  const max = query.maxPrice === undefined ? null : Number(query.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    filter.pricePaise = {};
    if (Number.isFinite(min)) filter.pricePaise.$gte = min;
    if (Number.isFinite(max)) filter.pricePaise.$lte = max;
  }
  return filter;
}

module.exports = { buildFilter, buildSort };
