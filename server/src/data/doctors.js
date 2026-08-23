// Doctors available for online consultation.
const doctors = [
  {
    id: "d1", name: "Dr. Ananya Sharma", specialty: "General Physician",
    qualifications: "MBBS, MD (Internal Medicine)", experienceYears: 12,
    rating: 4.9, reviews: 2340, languages: ["English", "Hindi"],
    consultationFee: 399, nextSlot: "Available today",
    image: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&q=80",
    about: "Treats fever, infections, lifestyle disorders and general health concerns.",
  },
  {
    id: "d2", name: "Dr. Rohan Mehta", specialty: "Pediatrician",
    qualifications: "MBBS, DCH, MD (Pediatrics)", experienceYears: 15,
    rating: 4.8, reviews: 1890, languages: ["English", "Hindi", "Marathi"],
    consultationFee: 499, nextSlot: "Available today",
    image: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&q=80",
    about: "Child health, vaccinations, growth and nutrition for ages 0–16.",
  },
  {
    id: "d3", name: "Dr. Priya Nair", specialty: "Dermatologist",
    qualifications: "MBBS, MD (Dermatology)", experienceYears: 10,
    rating: 4.9, reviews: 3110, languages: ["English", "Hindi", "Malayalam"],
    consultationFee: 599, nextSlot: "Tomorrow, 10:00 AM",
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
    about: "Acne, hair fall, pigmentation, skin allergies and cosmetic care.",
  },
  {
    id: "d4", name: "Dr. Vikram Rao", specialty: "Cardiologist",
    qualifications: "MBBS, MD, DM (Cardiology)", experienceYears: 18,
    rating: 4.9, reviews: 1420, languages: ["English", "Telugu", "Hindi"],
    consultationFee: 899, nextSlot: "Tomorrow, 4:30 PM",
    image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&q=80",
    about: "Heart health, blood pressure, cholesterol and post-cardiac care.",
  },
  {
    id: "d5", name: "Dr. Meera Iyer", specialty: "Gynecologist",
    qualifications: "MBBS, MS (Obstetrics & Gynecology)", experienceYears: 14,
    rating: 4.8, reviews: 2680, languages: ["English", "Hindi", "Tamil"],
    consultationFee: 699, nextSlot: "Available today",
    image: "https://images.unsplash.com/photo-1591604021695-0c69b7c05981?w=400&q=80",
    about: "Women's health, PCOS, pregnancy care and menstrual concerns.",
  },
  {
    id: "d6", name: "Dr. Arjun Kapoor", specialty: "Psychiatrist",
    qualifications: "MBBS, MD (Psychiatry)", experienceYears: 11,
    rating: 4.7, reviews: 940, languages: ["English", "Hindi"],
    consultationFee: 799, nextSlot: "Tomorrow, 6:00 PM",
    image: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&q=80",
    about: "Anxiety, depression, sleep issues and stress management.",
  },
  {
    id: "d7", name: "Dr. Kavya Reddy", specialty: "Dentist",
    qualifications: "BDS, MDS (Prosthodontics)", experienceYears: 9,
    rating: 4.8, reviews: 1220, languages: ["English", "Kannada", "Hindi"],
    consultationFee: 349, nextSlot: "Available today",
    image: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=400&q=80",
    about: "Toothache, gum care, braces guidance and oral hygiene.",
  },
  {
    id: "d8", name: "Dr. Sameer Khan", specialty: "ENT Specialist",
    qualifications: "MBBS, MS (ENT)", experienceYears: 13,
    rating: 4.7, reviews: 860, languages: ["English", "Hindi", "Urdu"],
    consultationFee: 549, nextSlot: "Tomorrow, 11:30 AM",
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&q=80",
    about: "Ear, nose and throat conditions, sinusitis and hearing concerns.",
  },
];

module.exports = { doctors };
