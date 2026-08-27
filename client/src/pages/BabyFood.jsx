import { useState, useEffect, useMemo } from "react";
import { Search, Sparkles, RefreshCw, PackageX, Milk } from "lucide-react";
import { cx, discountPct } from "../lib/format";
import Button from "../components/ui/Button";
import ProductCard from "../components/ProductCard";

export default function BabyFood() {
  const [babyFood, setBabyFood] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popularity");

  useEffect(() => {
    setLoading(true);
    fetch("http://localhost:5000/api/baby-food")
      .then((res) => res.json())
      .then((data) => {
        setBabyFood(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load baby food:", err);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    babyFood.forEach((item) => {
      if (item.category) set.add(item.category);
      if (Array.isArray(item.categories)) item.categories.forEach((c) => set.add(c));
    });
    set.add("Baby Cereals");
    set.add("Infant Formula");
    set.add("Baby food & nutrition");
    return ["All", ...Array.from(set).sort()];
  }, [babyFood]);

  const filteredItems = useMemo(() => {
    let list = [...babyFood];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.brand && item.brand.toLowerCase().includes(q)) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== "All") {
      list = list.filter(
        (item) =>
          item.category === selectedCategory ||
          (Array.isArray(item.categories) && item.categories.includes(selectedCategory))
      );
    }

    switch (sortBy) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "discount":
        list.sort(
          (a, b) =>
            discountPct(b.price, b.originalPrice) -
            discountPct(a.price, a.originalPrice)
        );
        break;
      case "popularity":
      default:
        list.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
        break;
    }

    return list;
  }, [babyFood, search, selectedCategory, sortBy]);

  const handleClearFilters = () => {
    setSearch("");
    setSelectedCategory("All");
    setSortBy("popularity");
  };

  return (
    <div className="container-max py-6 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-600 to-orange-500 p-6 md:p-8 text-white shadow-lg">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur-sm mb-3">
            <Milk className="h-3.5 w-3.5" /> Stage-Based Pediatric Nutrition
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight">
            Baby Food & Nutrition
          </h1>
          <p className="mt-2 text-amber-100 text-sm md:text-base">
            Fortified cereals, infant formulas, purees, and snacks for healthy growth and digestion.
          </p>
        </div>

        {/* Search & Sort Controls */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search baby cereals, formula, Nestlé Cerelac, Similac..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-md"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-md"
          >
            <option value="popularity">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="discount">Biggest Discount</option>
          </select>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cx(
              "shrink-0 rounded-full px-4 py-2 text-xs md:text-sm font-bold transition-all",
              selectedCategory === cat
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-on-surface-variant">
            Showing <span className="font-bold text-on-surface">{filteredItems.length}</span> baby nutrition products
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse space-y-3">
                <div className="aspect-square bg-surface-container rounded-2xl" />
                <div className="h-4 bg-surface-container rounded w-3/4" />
                <div className="h-3 bg-surface-container rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty State */
          <div className="card p-12 text-center flex flex-col items-center justify-center space-y-4 border-dashed border-2 border-outline-variant/80">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-container-high text-on-surface-variant">
              <PackageX className="h-8 w-8 text-on-surface-variant/80" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="font-display text-lg font-bold text-on-surface">
                No baby food products found
                {selectedCategory !== "All" && <span> in "{selectedCategory}"</span>}
              </h3>
              <p className="text-sm text-on-surface-variant">
                Try searching with a different term or clearing your category filters.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="primary" size="sm" onClick={handleClearFilters}>
                <RefreshCw className="mr-2 h-4 w-4" /> Reset Filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}