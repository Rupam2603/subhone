import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../context/CartContext';

export default function BabyFood() {
  const [babyFood, setBabyFood] = useState([]);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetch('http://localhost:5000/api/baby-food')
      .then(res => res.json())
      .then(data => setBabyFood(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-stack-lg">
      <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm text-center">
        <h1 className="font-headline-lg text-headline-lg text-navy-deep mb-2">Baby Food & Nutrition</h1>
        <p className="font-body-md text-on-surface-variant">Organic cereals, purees, meals and snacks — stage-based nutrition for every milestone.</p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {['Baby Cereals', 'Infant Formula'].map(cat => (
            <button key={cat} className="bg-surface-container text-on-surface-variant font-label-bold px-4 py-2 rounded-full border border-outline-variant hover:bg-secondary-container hover:text-on-secondary-container transition-colors">
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {babyFood.map(item => (
          <div key={item.id} className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 flex flex-col group hover:shadow-md transition-shadow">
             <div className="relative mb-3 bg-surface-container-low rounded-lg p-4 aspect-square flex items-center justify-center">
               <img src={item.image} alt={item.name} className="h-full object-contain mix-blend-multiply transition-transform group-hover:scale-105" />
             </div>
             <div className="flex-grow">
               <h4 className="font-label-bold text-label-bold text-navy-deep mb-1 line-clamp-2">{item.name}</h4>
               <p className="text-[12px] text-on-surface-variant mb-2">{item.brand} • {item.category} • {item.ageGroup}</p>
               <div className="flex items-center gap-1 mb-3">
                 <span className="material-symbols-outlined text-warning-amber text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                 <span className="font-label-bold text-[12px]">{item.rating}</span>
               </div>
             </div>
             <div className="flex items-center justify-between mt-auto">
               <div>
                 <div className="font-price-display text-[16px] font-bold text-primary">₹{item.price}</div>
                 <div className="text-[12px] text-outline line-through">₹{item.originalPrice}</div>
               </div>
               <button 
                 onClick={() => addToCart(item, 'babyfood')}
                 className="bg-primary hover:bg-emerald-vibrant text-white font-label-bold px-4 py-2 rounded-lg transition-colors"
               >
                 Add
               </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}