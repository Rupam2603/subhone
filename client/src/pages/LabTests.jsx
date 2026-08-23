import { useState, useEffect, useContext } from 'react';
import { CartContext } from '../context/CartContext';

export default function LabTests() {
  const [labTests, setLabTests] = useState([]);
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetch('http://localhost:5000/api/lab-tests')
      .then(res => res.json())
      .then(data => setLabTests(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-stack-lg">
      <section className="flex flex-col md:flex-row bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
          <h1 className="font-display-lg text-display-lg text-navy-deep mb-4">Accurate Lab Tests at Home</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-8">NABL certified labs. Free home sample collection. Reports within 24 hours.</p>
          <div className="flex flex-wrap gap-4">
            <button className="bg-primary hover:bg-emerald-vibrant text-white font-label-bold py-3 px-6 rounded-lg shadow-md transition-colors">Book a Test Now</button>
            <button className="border-2 border-navy-deep text-navy-deep hover:bg-background-warm font-label-bold py-3 px-6 rounded-lg transition-colors">Upload Prescription</button>
          </div>
        </div>
        <div className="flex-1">
          <img src="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&q=80" alt="Lab Testing" className="w-full h-full object-cover" />
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-headline-lg text-headline-lg text-navy-deep">Comprehensive Health Packages</h2>
          <a href="#" className="font-label-bold text-primary hover:underline">View All Packages</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {labTests.map(test => (
            <div key={test.id} className="bg-white rounded-xl shadow-sm border border-surface-dim hover:shadow-md transition-shadow flex flex-col overflow-hidden">
              <div className="bg-surface-container p-4 border-b border-surface-dim">
                {test.bestseller && (
                  <span className="inline-block bg-teal-accent text-white font-label-bold text-[10px] uppercase px-2 py-1 rounded-full mb-2">Bestseller</span>
                )}
                <h3 className="font-headline-md text-navy-deep">{test.name}</h3>
                <p className="font-body-sm text-on-surface-variant mt-1">Includes {test.testCount} tests ({test.includes.join(', ')})</p>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <ul className="space-y-2 mb-6">
                  {test.homeCollection && (
                    <li className="flex items-center gap-2 text-body-sm text-on-surface">
                      <span className="material-symbols-outlined text-success-green text-[18px]">check_circle</span> Home sample collection
                    </li>
                  )}
                  <li className="flex items-center gap-2 text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-success-green text-[18px]">check_circle</span> Reports in {test.turnaroundTime}
                  </li>
                  <li className="flex items-center gap-2 text-body-sm text-on-surface">
                    <span className="material-symbols-outlined text-success-green text-[18px]">check_circle</span> Free Doctor Consultation
                  </li>
                </ul>
                <div className="mt-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-price-display text-navy-deep font-bold text-[20px]">₹{test.price}</span>
                    <span className="text-body-sm text-outline line-through">₹{test.originalPrice}</span>
                  </div>
                  <button 
                    onClick={() => addToCart(test, 'labTest')}
                    className="w-full bg-primary hover:bg-emerald-vibrant text-white font-label-bold py-3 rounded-lg transition-colors"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
