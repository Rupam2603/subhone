import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Search, Filter, Star, Sparkles, Check, RefreshCw } from 'lucide-react';
import { inr, cx, discountPct } from '../lib/format';
import Button from '../components/ui/Button';

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedDosage, setSelectedDosage] = useState('All');
  const [sortBy, setSortBy] = useState('popularity');
  const { addItem } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch('http://localhost:5000/api/medicines')
      .then((res) => res.json())
      .then((data) => {
        setMedicines(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load medicines:', err);
        setLoading(false);
      });
  }, []);

  // Extract unique categories, brands, and dosage forms
  const categories = useMemo(() => {
    const set = new Set(medicines.map((m) => m.category).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [medicines]);

  const brands = useMemo(() => {
    const set = new Set(medicines.map((m) => m.brand).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [medicines]);

  const dosageForms = useMemo(() => {
    const set = new Set(medicines.map((m) => m.dosageForm).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [medicines]);

  // Filter and sort items
  const filteredMedicines = useMemo(() => {
    let list = [...medicines];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.brand && m.brand.toLowerCase().includes(q)) ||
          (m.category && m.category.toLowerCase().includes(q)) ||
          (m.description && m.description.toLowerCase().includes(q)) ||
          (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (selectedCategory !== 'All') {
      list = list.filter((m) => m.category === selectedCategory);
    }

    if (selectedBrand !== 'All') {
      list = list.filter((m) => m.brand === selectedBrand);
    }

    if (selectedDosage !== 'All') {
      list = list.filter((m) => m.dosageForm === selectedDosage);
    }

    // Sort
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
  }, [medicines, search, selectedCategory, selectedBrand, selectedDosage, sortBy]);

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedDosage('All');
    setSortBy('popularity');
  };

  return (
    <div className="container-max py-6 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 to-teal-800 p-6 md:p-8 text-white shadow-lg">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur-sm mb-3">
            <Sparkles className="h-3.5 w-3.5" /> 100% Genuine Pharmacy & Wellness
          </div>
          <h1 className="font-display text-2xl md:text-4xl font-extrabold tracking-tight">
            Medicines & Healthcare Catalog
          </h1>
          <p className="mt-2 text-emerald-100 text-sm md:text-base">
            Search over {medicines.length} doctor-prescribed, OTC, Ayurvedic, Homeopathic medicines and diagnostics.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search medicine name, brand (Cipla, Dolo, Zandu, Dabur), symptom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-md"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 shadow-md"
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

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Filter Sidebar */}
        <aside className="hidden md:block md:col-span-3 space-y-4 sticky top-24">
          <div className="card p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <span className="flex items-center gap-2 font-display text-base font-bold text-on-surface">
                <Filter className="h-4 w-4 text-primary" /> Filters
              </span>
              {(selectedCategory !== 'All' || selectedBrand !== 'All' || selectedDosage !== 'All' || search) && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Dosage Form Filter */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                Dosage Form
              </label>
              <div className="flex flex-wrap gap-1.5">
                {dosageForms.map((form) => (
                  <button
                    key={form}
                    onClick={() => setSelectedDosage(form)}
                    className={cx(
                      'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                      selectedDosage === form
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    )}
                  >
                    {form}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
                Brand
              </label>
              <div className="max-h-56 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {brands.map((b) => (
                  <label
                    key={b}
                    className={cx(
                      'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors',
                      selectedBrand === b ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container text-on-surface-variant'
                    )}
                    onClick={() => setSelectedBrand(b)}
                  >
                    <span>{b}</span>
                    {selectedBrand === b && <Check className="h-3.5 w-3.5 text-primary" />}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Product Cards Grid */}
        <section className="col-span-1 md:col-span-9 space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-on-surface-variant">
              Showing <span className="font-bold text-on-surface">{filteredMedicines.length}</span> medicines
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card p-4 animate-pulse space-y-3">
                  <div className="aspect-square bg-surface-container rounded-2xl" />
                  <div className="h-4 bg-surface-container rounded w-3/4" />
                  <div className="h-3 bg-surface-container rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredMedicines.length === 0 ? (
            <div className="card p-12 text-center space-y-3">
              <p className="font-display text-lg font-bold text-on-surface">No medicines match your search.</p>
              <p className="text-sm text-on-surface-variant">Try searching for a different keyword or clear active filters.</p>
              <Button variant="outline" onClick={handleClearFilters} className="mt-2">
                <RefreshCw className="mr-2 h-4 w-4" /> Reset Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredMedicines.map((med) => {
                const discount = discountPct(med.price, med.originalPrice);
                return (
                  <div
                    key={med.id}
                    className="card p-4 flex flex-col justify-between group hover:shadow-lg transition-all hover:border-primary/40"
                  >
                    <div>
                      {/* Image Box */}
                      <div className="relative mb-3 bg-surface-container-low rounded-2xl p-4 aspect-square flex items-center justify-center overflow-hidden">
                        {med.prescriptionRequired && (
                          <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                            Rx Required
                          </span>
                        )}
                        {discount > 0 && (
                          <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                            {discount}% OFF
                          </span>
                        )}
                        <img
                          src={med.image}
                          alt={med.name}
                          className="h-full w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      {/* Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                          <span className="font-bold text-primary">{med.brand}</span>
                          <span>•</span>
                          <span>{med.dosageForm}</span>
                        </div>
                        <h3 className="font-display text-sm font-bold text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {med.name}
                        </h3>
                        <p className="text-xs text-on-surface-variant truncate">{med.packSize || med.description}</p>
                      </div>
                    </div>

                    {/* Footer / Pricing & Add */}
                    <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                      <div>
                        <div className="font-display text-base font-extrabold text-on-surface">
                          {inr(med.price)}
                        </div>
                        {med.originalPrice && med.originalPrice > med.price && (
                          <div className="text-xs text-on-surface-variant/70 line-through">
                            {inr(med.originalPrice)}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          addItem({
                            id: med.id,
                            type: 'medicine',
                            name: med.name,
                            brand: med.brand,
                            price: med.price,
                            originalPrice: med.originalPrice,
                            image: med.image,
                            prescriptionRequired: med.prescriptionRequired,
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
    </div>
  );
}
