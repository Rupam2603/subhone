import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Search, Sparkles, Check, RefreshCw } from 'lucide-react';
import { inr, cx, discountPct } from '../lib/format';
import Button from '../components/ui/Button';

export default function Supplements() {
  const [supplements, setSupplements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('popularity');
  const { addItem } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:5000/api/supplements')
      .then((res) => res.json())
      .then((data) => {
        setSupplements(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load supplements:', err);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set(supplements.map((s) => s.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [supplements]);

  const filteredSupplements = useMemo(() => {
    let list = [...supplements];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.brand && s.brand.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          (s.highlights && s.highlights.some((h) => h.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'All') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    switch (sortBy) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'discount':
        list.sort((a, b) => discountPct(b.price, b.originalPrice) - discountPct(a.price, a.originalPrice));
        break;
      case 'popularity':
      default:
        list.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
        break;
    }

    return list;
  }, [supplements, search, selectedCategory, sortBy]);

  return (
    <div className="container-max py-6 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-700 via-orange-800 to-emerald-900 p-6 md:p-8 text-white shadow-lg">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur-sm mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Nutrition, Wellness & Personal Care
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight">
            Health Supplements & Wellness
          </h1>
          <p className="mt-2 text-amber-100 text-sm md:text-base">
            Discover {supplements.length} premium multivitamins, whey protein, fish oils, skincare, and daily wellness essentials.
          </p>
        </div>

        {/* Search & Sort */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search protein, multivitamin, fish oil, brand (Tata 1mg, Minimalist, Cetaphil)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-md"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-md"
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
              'shrink-0 rounded-full px-4 py-2 text-xs md:text-sm font-bold transition-all',
              selectedCategory === cat
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <section className="space-y-4">
        <p className="text-sm font-semibold text-on-surface-variant px-1">
          Showing <span className="font-bold text-on-surface">{filteredSupplements.length}</span> wellness products
        </p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-4 animate-pulse space-y-3">
                <div className="aspect-square bg-surface-container rounded-2xl" />
                <div className="h-4 bg-surface-container rounded w-3/4" />
                <div className="h-3 bg-surface-container rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredSupplements.length === 0 ? (
          <div className="card p-12 text-center space-y-3">
            <p className="font-display text-lg font-bold text-on-surface">No supplements found matching your filter.</p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('');
                setSelectedCategory('All');
              }}
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Clear Filter
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredSupplements.map((item) => {
              const discount = discountPct(item.price, item.originalPrice);
              return (
                <div
                  key={item.id}
                  className="card p-4 flex flex-col justify-between group hover:shadow-lg transition-all hover:border-primary/40"
                >
                  <div>
                    {/* Image Box */}
                    <div className="relative mb-3 bg-surface-container-low rounded-2xl p-4 aspect-square flex items-center justify-center overflow-hidden">
                      {item.veg && (
                        <span className="absolute top-2 left-2 flex items-center justify-center h-4 w-4 border border-emerald-600 bg-white rounded-sm p-0.5" title="100% Vegetarian">
                          <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        </span>
                      )}
                      {discount > 0 && (
                        <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          {discount}% OFF
                        </span>
                      )}
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>

                    {/* Info */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span className="font-bold text-primary">{item.brand}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                      </div>
                      <h3 className="font-display text-sm font-bold text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs text-on-surface-variant line-clamp-2">{item.description}</p>
                    </div>

                    {/* Highlights tags */}
                    {item.highlights && item.highlights.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.highlights.slice(0, 2).map((h) => (
                          <span key={h} className="rounded-md bg-surface-container px-1.5 py-0.5 text-[10px] font-medium text-on-surface-variant">
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer / Price & Add */}
                  <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                    <div>
                      <div className="font-display text-base font-extrabold text-on-surface">
                        {inr(item.price)}
                      </div>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <div className="text-xs text-on-surface-variant/70 line-through">
                          {inr(item.originalPrice)}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        addItem({
                          id: item.id,
                          type: 'supplement',
                          name: item.name,
                          brand: item.brand,
                          price: item.price,
                          originalPrice: item.originalPrice,
                          image: item.image,
                        })
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
