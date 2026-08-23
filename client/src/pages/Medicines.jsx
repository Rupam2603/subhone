import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../context/CartContext';

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetch('http://localhost:5000/api/medicines')
      .then(res => res.json())
      .then(data => setMedicines(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter-desktop items-start">
      {/* Sidebar Filters */}
      <aside className="hidden md:flex md:col-span-3 flex-col gap-stack-md sticky top-[120px]">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-stack-md shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-headline-md text-[20px] font-semibold text-on-surface">Filters</h2>
            <button className="font-label-bold text-label-bold text-primary hover:underline">Clear All</button>
          </div>
          
          {/* Brand Filter */}
          <div className="py-4 border-b border-outline-variant">
            <h3 className="font-label-bold text-label-bold text-on-surface mb-3 flex justify-between items-center">Brand</h3>
            <div className="space-y-2">
              {['Cipla', 'Sun Pharma', "Dr. Reddy's", 'Abbott', 'Mankind'].map(brand => (
                <label key={brand} className="flex items-center space-x-3 group cursor-pointer">
                  <input type="checkbox" className="form-checkbox h-4 w-4 text-emerald-vibrant rounded border-outline focus:ring-emerald-vibrant" />
                  <span className="font-body-sm text-on-surface group-hover:text-primary">{brand}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Dosage Form */}
          <div className="py-4">
            <h3 className="font-label-bold text-label-bold text-on-surface mb-3">Dosage Form</h3>
            <div className="flex flex-wrap gap-2">
              <button className="bg-secondary-container text-on-secondary-container font-label-bold text-[12px] px-3 py-1.5 rounded-full">Tablet</button>
              <button className="bg-surface-container text-on-surface-variant font-label-bold text-[12px] px-3 py-1.5 rounded-full border border-outline-variant">Capsule</button>
              <button className="bg-surface-container text-on-surface-variant font-label-bold text-[12px] px-3 py-1.5 rounded-full border border-outline-variant">Syrup</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Product Listing */}
      <section className="col-span-1 md:col-span-9 flex flex-col gap-stack-md">
        <div className="flex justify-between items-center bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Medicines</h1>
            <p className="font-body-sm text-on-surface-variant">Showing {medicines.length} products</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {medicines.map(med => (
            <div key={med.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 flex flex-col group hover:shadow-md transition-shadow">
               <div className="relative mb-3 bg-surface-container-low rounded-lg p-4 aspect-square flex items-center justify-center">
                 {med.prescriptionRequired && (
                   <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-1 rounded">Rx Required</span>
                 )}
                 <img src={med.image} alt={med.name} className="h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105" />
               </div>
               <div className="flex-grow">
                 <h4 className="font-label-bold text-label-bold text-navy-deep mb-1">{med.name}</h4>
                 <p className="text-[12px] text-on-surface-variant mb-2">{med.brand} • {med.dosageForm}</p>
                 <div className="flex items-center gap-1 mb-3">
                   <span className="material-symbols-outlined text-warning-amber text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                   <span className="font-label-bold text-[12px]">{med.rating}</span>
                 </div>
               </div>
               <div className="flex items-center justify-between mt-auto">
                 <div>
                   <div className="font-price-display text-[16px] font-bold text-primary">₹{med.price}</div>
                   <div className="text-[12px] text-outline line-through">₹{med.originalPrice}</div>
                 </div>
                 <button 
                   onClick={() => addToCart(med, 'medicine')}
                   className="bg-primary hover:bg-emerald-vibrant text-white font-label-bold px-4 py-2 rounded-lg transition-colors"
                 >
                   Add
                 </button>
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
