// Marketing content, homepage modules, coupons and flash-sale configuration.

// Hero carousel slides
const banners = [
  {
    id: "b1",
    eyebrow: "First order offer",
    title: "Your medicines, 20% off & at your door",
    subtitle: "Genuine medicines delivered in as fast as 90 minutes. Use code FIRST20.",
    highlight: "20% OFF",
    coupon: "FIRST20",
    cta: "Order medicines",
    ctaLink: "/medicines",
    accent: "primary",
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=900&q=80",
  },
  {
    id: "b2",
    eyebrow: "Health checkup",
    title: "Full Body Checkup with 85 tests at ₹1499",
    subtitle: "Free home sample collection. Reports in 24 hours, reviewed by experts.",
    highlight: "50% OFF",
    coupon: "LAB15",
    cta: "Book a test",
    ctaLink: "/lab-tests",
    accent: "teal",
    image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?w=900&q=80",
  },
  {
    id: "b3",
    eyebrow: "Talk to a doctor",
    title: "Consult top doctors online from ₹349",
    subtitle: "General physicians, dermatologists, pediatricians and more — in minutes.",
    highlight: "24×7",
    coupon: null,
    cta: "Consult now",
    ctaLink: "/consult",
    accent: "amber",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=900&q=80",
  },
];

// Quick-action bento cards (icon = lucide-react icon name)
const categories = [
  { id: "c1", label: "Medicines", caption: "Upload Rx & save", icon: "Pill", to: "/medicines", accent: "primary" },
  { id: "c2", label: "Lab Tests", caption: "Home sample pickup", icon: "FlaskConical", to: "/lab-tests", accent: "teal" },
  { id: "c3", label: "Supplements", caption: "Vitamins & protein", icon: "Leaf", to: "/supplements", accent: "emerald" },
  { id: "c4", label: "Baby Food", caption: "Organic nutrition", icon: "Baby", to: "/baby-food", accent: "amber" },
  { id: "c5", label: "Consult Doctor", caption: "24×7 online", icon: "Stethoscope", to: "/consult", accent: "navy" },
  { id: "c6", label: "Upload Rx", caption: "Pharmacist review", icon: "FileText", to: "/upload-prescription", accent: "amber" },
  { id: "c7", label: "Offers", caption: "Deals up to 60%", icon: "BadgePercent", to: "/medicines?sort=discount", accent: "primary" },
];

// Wellness guides / editorial
const wellnessGuides = [
  {
    id: "w1", title: "5 signs of vitamin D deficiency you shouldn't ignore",
    category: "Nutrition", readTime: "4 min read",
    excerpt: "From fatigue to bone pain — how to spot and fix low vitamin D.",
    image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?w=600&q=80",
  },
  {
    id: "w2", title: "Managing type-2 diabetes: a daily routine that works",
    category: "Diabetes", readTime: "6 min read",
    excerpt: "Diet, movement and monitoring habits that keep sugar steady.",
    image: "https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=600&q=80",
  },
  {
    id: "w3", title: "How to build immunity naturally this season",
    category: "Immunity", readTime: "5 min read",
    excerpt: "Simple, science-backed ways to strengthen your defences.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
  },
  {
    id: "w4", title: "When should you actually take antibiotics?",
    category: "Medicines", readTime: "3 min read",
    excerpt: "Understanding antibiotic resistance and safe use.",
    image: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&q=80",
  },
];

// Flash sale — item ids resolved by the content route; endsAt computed live in store.js
const flashSale = {
  title: "Flash Sale",
  subtitle: "Limited-time deals refreshed daily",
  itemIds: ["m11", "s4", "s5", "m9", "s7", "m1", "s2"],
};

// Coupons
const coupons = [
  { code: "FIRST20", type: "percent", value: 20, maxDiscount: 200, minOrder: 0, description: "20% off your first order (up to ₹200)" },
  { code: "HEALTH50", type: "flat", value: 50, maxDiscount: null, minOrder: 499, description: "Flat ₹50 off orders above ₹499" },
  { code: "LAB15", type: "percent", value: 15, maxDiscount: 300, minOrder: 0, description: "15% off lab tests & checkups (up to ₹300)" },
];

module.exports = { banners, categories, wellnessGuides, flashSale, coupons };
