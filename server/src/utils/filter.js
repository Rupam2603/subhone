// Shared filtering & sorting helpers for catalog endpoints.

function discountPct(item) {
  if (!item.originalPrice || item.originalPrice <= item.price) return 0;
  return Math.round((1 - item.price / item.originalPrice) * 100);
}

function csv(value) {
  return String(value)
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function applyFilters(items, query = {}) {
  let out = [...items];
  const { search, brand, dosageForm, category, minPrice, maxPrice, inStock, minRating } = query;

  if (search) {
    const s = search.toLowerCase();
    out = out.filter((i) =>
      [i.name, i.brand, i.description, i.category, ...(i.tags || [])]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(s))
    );
  }
  if (brand) {
    const brands = csv(brand);
    out = out.filter((i) => i.brand && brands.includes(i.brand.toLowerCase()));
  }
  if (dosageForm) {
    const forms = csv(dosageForm);
    out = out.filter((i) => i.dosageForm && forms.includes(i.dosageForm.toLowerCase()));
  }
  if (category) {
    const cats = csv(category);
    out = out.filter((i) => i.category && cats.includes(i.category.toLowerCase()));
  }
  if (minPrice !== undefined && minPrice !== "") out = out.filter((i) => i.price >= Number(minPrice));
  if (maxPrice !== undefined && maxPrice !== "") out = out.filter((i) => i.price <= Number(maxPrice));
  if (inStock === "true" || inStock === true) out = out.filter((i) => i.inStock !== false);
  if (minRating) out = out.filter((i) => (i.rating || 0) >= Number(minRating));

  return out;
}

function applySort(items, sort) {
  const out = [...items];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.price - b.price);
    case "price-desc":
      return out.sort((a, b) => b.price - a.price);
    case "rating":
      return out.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "discount":
      return out.sort((a, b) => discountPct(b) - discountPct(a));
    case "popularity":
    default:
      return out.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  }
}

module.exports = { applyFilters, applySort, discountPct };
