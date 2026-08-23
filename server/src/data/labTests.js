// Lab test packages & diagnostic checkups.
const labTests = [
  {
    id: "lt1", type: "labTest", name: "Advanced Full Body Checkup", testCount: 85,
    price: 1499, originalPrice: 2999, turnaroundTime: "24 hours", reportsIn: "Within 24 hrs",
    homeCollection: true, fastingRequired: true, bestseller: true, category: "Full Body",
    includes: ["Complete Blood Count", "Lipid Profile", "Thyroid (T3 T4 TSH)", "Liver Function", "Kidney Function", "HbA1c", "Vitamin D", "Vitamin B12"],
    description: "Our most comprehensive screen across 12 organ systems.",
  },
  {
    id: "lt2", type: "labTest", name: "Essential Diabetic Care", testCount: 32,
    price: 899, originalPrice: 1500, turnaroundTime: "12 hours", reportsIn: "Within 12 hrs",
    homeCollection: true, fastingRequired: true, bestseller: false, category: "Diabetes",
    includes: ["HbA1c", "Fasting Blood Sugar", "Post Prandial Sugar", "Lipid Profile", "Kidney Function"],
    description: "Track and manage blood sugar with a focused diabetic panel.",
  },
  {
    id: "lt3", type: "labTest", name: "Vitamin D & B12 Profile", testCount: 2,
    price: 750, originalPrice: 1200, turnaroundTime: "24 hours", reportsIn: "Within 24 hrs",
    homeCollection: true, fastingRequired: false, bestseller: true, category: "Vitamins",
    includes: ["Vitamin D (25-OH)", "Vitamin B12"],
    description: "Check for the two most common vitamin deficiencies.",
  },
  {
    id: "lt4", type: "labTest", name: "Cardiac Risk Assessment", testCount: 26,
    price: 1299, originalPrice: 2200, turnaroundTime: "24 hours", reportsIn: "Within 24 hrs",
    homeCollection: true, fastingRequired: true, bestseller: false, category: "Cardiac",
    includes: ["Lipid Profile", "hs-CRP", "Homocysteine", "Apolipoprotein", "ECG at home"],
    description: "Assess heart health and cardiovascular risk markers.",
  },
  {
    id: "lt5", type: "labTest", name: "Thyroid Complete Panel", testCount: 3,
    price: 499, originalPrice: 899, turnaroundTime: "12 hours", reportsIn: "Within 12 hrs",
    homeCollection: true, fastingRequired: false, bestseller: false, category: "Thyroid",
    includes: ["T3 (Triiodothyronine)", "T4 (Thyroxine)", "TSH (Ultrasensitive)"],
    description: "Complete thyroid function screening in one panel.",
  },
  {
    id: "lt6", type: "labTest", name: "Women's Wellness Full Body", testCount: 68,
    price: 1999, originalPrice: 3499, turnaroundTime: "24 hours", reportsIn: "Within 24 hrs",
    homeCollection: true, fastingRequired: true, bestseller: true, category: "Women",
    includes: ["CBC", "Thyroid Profile", "Iron Studies", "Vitamin D & B12", "PCOS Panel", "Calcium"],
    description: "Designed for women — hormones, iron, thyroid and bone health.",
  },
  {
    id: "lt7", type: "labTest", name: "Fever Panel (Advanced)", testCount: 40,
    price: 1099, originalPrice: 1800, turnaroundTime: "Same day", reportsIn: "Same day",
    homeCollection: true, fastingRequired: false, bestseller: false, category: "Full Body",
    includes: ["CBC", "Malaria Antigen", "Dengue NS1", "Typhoid", "Urine Routine", "CRP"],
    description: "Pinpoint the cause of fever quickly with a broad panel.",
  },
  {
    id: "lt8", type: "labTest", name: "Senior Citizen Health Package", testCount: 90,
    price: 2499, originalPrice: 4499, turnaroundTime: "24 hours", reportsIn: "Within 24 hrs",
    homeCollection: true, fastingRequired: true, bestseller: false, category: "Full Body",
    includes: ["Full Body 85", "Vitamin Profile", "Cardiac Markers", "Bone Health", "PSA / Pap as advised"],
    description: "Thorough annual screening tailored for ages 60+.",
  },
];

module.exports = { labTests };
