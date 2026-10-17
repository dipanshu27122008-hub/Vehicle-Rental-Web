/* Shared catalog metadata, city coordinates, Haversine distance helper, and pricing defaults for Drivora vehicles. */
window.drivoraCityCoords = {
  Jaipur: { lat: 26.9124, lng: 75.7873, label: "Jaipur, Rajasthan" },
  Delhi: { lat: 28.6139, lng: 77.2090, label: "New Delhi, NCR" },
  Mumbai: { lat: 19.0760, lng: 72.8777, label: "Mumbai, Maharashtra" },
  Bengaluru: { lat: 12.9716, lng: 77.5946, label: "Bengaluru, Karnataka" },
  Udaipur: { lat: 24.5854, lng: 73.7125, label: "Udaipur, Rajasthan" }
};

/**
 * Calculates approximate straight-line distance in kilometres using the Haversine formula.
 */
window.calculateHaversineKm = function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number" ||
    Number.isNaN(lat1) ||
    Number.isNaN(lon1) ||
    Number.isNaN(lat2) ||
    Number.isNaN(lon2)
  ) {
    return null;
  }
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

window.vehicleCatalog = {
  "bmw-x5": {
    id: "bmw-x5",
    name: "BMW X5",
    modelYear: 2024,
    category: "SUV",
    transmission: "Automatic",
    fuel: "Petrol",
    seats: 5,
    price: 4500,
    extraHourRate: 560,
    lateFeePerHour: 850,
    securityDeposit: 10000,
    city: "Jaipur",
    publicHub: "Jaipur International Airport Hub",
    lat: 26.8242,
    lng: 75.8122,
    providerName: "Rajputana Luxury Fleet",
    providerVerified: true,
    image: "./assets/vehicles/bmw x5.jpg",
    photos: [
      "./assets/vehicles/bmw x5.jpg",
      "./assets/hero/car1.png",
      "./assets/vehicles/about1.jpg",
      "./assets/vehicles/about2.jpg"
    ],
    rating: 4.8,
    reviewCount: 24,
    availability: "available"
  },
  "mercedes-c-class": {
    id: "mercedes-c-class",
    name: "Mercedes C-Class",
    modelYear: 2023,
    category: "Sedan",
    transmission: "Automatic",
    fuel: "Petrol",
    seats: 5,
    price: 3600,
    extraHourRate: 450,
    lateFeePerHour: 700,
    securityDeposit: 8000,
    city: "Delhi",
    publicHub: "Connaught Place / IGI T3 Hub",
    lat: 28.5562,
    lng: 77.1000,
    providerName: "Capital Executive Mobility",
    providerVerified: true,
    image: "./assets/vehicles/c class.jpg",
    photos: [
      "./assets/vehicles/c class.jpg",
      "./assets/hero/car2.jpg",
      "./assets/hero/car3.jpg"
    ],
    rating: 4.6,
    reviewCount: 18,
    availability: "reserved"
  },
  "tesla-model-3": {
    id: "tesla-model-3",
    name: "Tesla Model 3",
    modelYear: 2025,
    category: "Electric",
    transmission: "Automatic",
    fuel: "Electric",
    seats: 5,
    price: 3900,
    extraHourRate: 490,
    lateFeePerHour: 750,
    securityDeposit: 8000,
    city: "Mumbai",
    publicHub: "Bandra Kurla Complex EV Hub",
    lat: 19.0653,
    lng: 72.8681,
    providerName: "VoltDrive Mumbai",
    providerVerified: true,
    image: "./assets/vehicles/model 3.jpg",
    photos: [
      "./assets/vehicles/model 3.jpg",
      "./assets/vehicles/luxuryi7.jpg",
      "./assets/hero/car4.jpg"
    ],
    rating: 4.9,
    reviewCount: 31,
    availability: "unavailable"
  },
  "audi-q7": {
    id: "audi-q7",
    name: "Audi Q7",
    modelYear: 2024,
    category: "Luxury",
    transmission: "Automatic",
    fuel: "Diesel",
    seats: 7,
    price: 5200,
    extraHourRate: 650,
    lateFeePerHour: 950,
    securityDeposit: 12000,
    city: "Jaipur",
    publicHub: "MI Road Luxury Lounge",
    lat: 26.9154,
    lng: 75.8056,
    providerName: "Rajputana Luxury Fleet",
    providerVerified: true,
    image: "./assets/vehicles/audi q7.jpg",
    photos: [
      "./assets/vehicles/audi q7.jpg",
      "./assets/vehicles/bmw x5.jpg",
      "./assets/vehicles/about1.jpg"
    ],
    rating: 4.9,
    reviewCount: 20,
    availability: "available"
  },
  "honda-city": {
    id: "honda-city",
    name: "Honda City",
    modelYear: 2023,
    category: "Sedan",
    transmission: "Manual",
    fuel: "Petrol",
    seats: 5,
    price: 2400,
    extraHourRate: 300,
    lateFeePerHour: 450,
    securityDeposit: 5000,
    city: "Jaipur",
    publicHub: "Sindhi Camp / Central Station Hub",
    lat: 26.9221,
    lng: 75.7998,
    providerName: "PinkCity Auto Rentals",
    providerVerified: true,
    image: "./assets/vehicles/honda city.jpg",
    photos: [
      "./assets/vehicles/honda city.jpg",
      "./assets/vehicles/sedanhondacity.jpg"
    ],
    rating: 4.5,
    reviewCount: 16,
    availability: "available"
  },
  "royal-enfield-classic": {
    id: "royal-enfield-classic",
    name: "Royal Enfield Classic",
    modelYear: 2024,
    category: "Bike",
    transmission: "Manual",
    fuel: "Petrol",
    seats: 2,
    price: 1500,
    extraHourRate: 190,
    lateFeePerHour: 300,
    securityDeposit: 3000,
    city: "Jaipur",
    publicHub: "C-Scheme Rider Point",
    lat: 26.9112,
    lng: 75.8012,
    providerName: "Thar Moto Expeditions",
    providerVerified: true,
    image: "./assets/vehicles/bullet.jpg",
    photos: [
      "./assets/vehicles/bullet.jpg",
      "./assets/vehicles/bikegt650.jpg"
    ],
    rating: 4.6,
    reviewCount: 28,
    availability: "available"
  },
  "mini-convertible": {
    id: "mini-convertible",
    name: "Mini Convertible",
    modelYear: 2022,
    category: "Convertible",
    transmission: "Automatic",
    fuel: "Petrol",
    seats: 4,
    price: 3200,
    extraHourRate: 400,
    lateFeePerHour: 600,
    securityDeposit: 7000,
    city: "Mumbai",
    publicHub: "Marine Drive / Colaba Hub",
    lat: 18.9220,
    lng: 72.8347,
    providerName: "Coastal Cabrio Hub",
    providerVerified: true,
    image: "./assets/vehicles/convertiblemini.jpg",
    photos: [
      "./assets/vehicles/convertiblemini.jpg",
      "./assets/hero/car3.jpg"
    ],
    rating: 4.5,
    reviewCount: 12,
    availability: "available"
  },
  "continental-gt-650": {
    id: "continental-gt-650",
    name: "Continental GT 650",
    modelYear: 2025,
    category: "Bike",
    transmission: "Manual",
    fuel: "Petrol",
    seats: 2,
    price: 2000,
    extraHourRate: 250,
    lateFeePerHour: 400,
    securityDeposit: 4000,
    city: "Delhi",
    publicHub: "Hauz Khas / South Delhi Hub",
    lat: 28.5494,
    lng: 77.2001,
    providerName: "Thar Moto Expeditions",
    providerVerified: true,
    image: "./assets/vehicles/bikegt650.jpg",
    photos: [
      "./assets/vehicles/bikegt650.jpg",
      "./assets/vehicles/bullet.jpg"
    ],
    rating: 4.8,
    reviewCount: 22,
    availability: "available"
  },
  "ola-s1": {
    id: "ola-s1",
    name: "Ola S1",
    modelYear: 2024,
    category: "Electric Scooter",
    transmission: "Automatic",
    fuel: "Electric",
    seats: 2,
    price: 900,
    extraHourRate: 120,
    lateFeePerHour: 200,
    securityDeposit: 2000,
    city: "Jaipur",
    publicHub: "Malviya Nagar EV Dock",
    lat: 26.8549,
    lng: 75.8243,
    providerName: "GreenRide Jaipur",
    providerVerified: false,
    image: "./assets/vehicles/electricscooterolas1.jpg",
    photos: ["./assets/vehicles/electricscooterolas1.jpg"],
    rating: 4.4,
    reviewCount: 14,
    availability: "available"
  },
  "toyota-commuter-van": {
    id: "toyota-commuter-van",
    name: "Toyota Commuter Van",
    modelYear: 2023,
    category: "Van",
    transmission: "Manual",
    fuel: "Diesel",
    seats: 9,
    price: 4000,
    extraHourRate: 500,
    lateFeePerHour: 750,
    securityDeposit: 8000,
    city: "Delhi",
    publicHub: "New Delhi Railway / Paharganj Hub",
    lat: 28.6429,
    lng: 77.2191,
    providerName: "Capital Executive Mobility",
    providerVerified: true,
    image: "./assets/vehicles/vancommuter.jpg",
    photos: [
      "./assets/vehicles/vancommuter.jpg",
      "./assets/vehicles/minivantoyotahiace.jpg"
    ],
    rating: 4.6,
    reviewCount: 11,
    availability: "available"
  },
  "volkswagen-virtus-gt": {
    id: "volkswagen-virtus-gt",
    name: "Volkswagen Virtus GT",
    modelYear: 2025,
    category: "Sports",
    transmission: "Manual",
    fuel: "Petrol",
    seats: 5,
    price: 3400,
    extraHourRate: 425,
    lateFeePerHour: 650,
    securityDeposit: 7000,
    city: "Mumbai",
    publicHub: "Andheri West / Airport Metro Hub",
    lat: 19.1136,
    lng: 72.8697,
    providerName: "Autobahn West Fleet",
    providerVerified: true,
    image: "./assets/vehicles/sportsvirtusgt.jpg",
    photos: [
      "./assets/vehicles/sportsvirtusgt.jpg",
      "./assets/hero/car2.jpg"
    ],
    rating: 4.7,
    reviewCount: 19,
    availability: "available"
  },
  "isuzu-pickup": {
    id: "isuzu-pickup",
    name: "Isuzu Pickup",
    modelYear: 2022,
    category: "Pickup",
    transmission: "Manual",
    fuel: "Diesel",
    seats: 5,
    price: 3800,
    extraHourRate: 475,
    lateFeePerHour: 700,
    securityDeposit: 7500,
    city: "Jaipur",
    publicHub: "Sitapura / Tonk Road Hub",
    lat: 26.7782,
    lng: 75.8401,
    providerName: "PinkCity Auto Rentals",
    providerVerified: true,
    image: "./assets/vehicles/pickupisuzu.jpg",
    photos: ["./assets/vehicles/pickupisuzu.jpg"],
    rating: 4.5,
    reviewCount: 10,
    availability: "available"
  },
  "tata-altroz": {
    id: "tata-altroz",
    name: "Tata Altroz",
    modelYear: 2024,
    category: "Hatchback",
    transmission: "Manual",
    fuel: "Petrol",
    seats: 5,
    price: 1800,
    extraHourRate: 225,
    lateFeePerHour: 350,
    securityDeposit: 4000,
    city: "Jaipur",
    publicHub: "Vaishali Nagar Smart Point",
    lat: 26.9136,
    lng: 75.7438,
    providerName: "PinkCity Auto Rentals",
    providerVerified: true,
    image: "./assets/vehicles/hatchbackaltroz.jpg",
    photos: ["./assets/vehicles/hatchbackaltroz.jpg"],
    rating: 4.4,
    reviewCount: 17,
    availability: "available"
  },
  "bmw-i7": {
    id: "bmw-i7",
    name: "BMW i7",
    modelYear: 2026,
    category: "Luxury",
    transmission: "Automatic",
    fuel: "Electric",
    seats: 5,
    price: 7500,
    extraHourRate: 940,
    lateFeePerHour: 1400,
    securityDeposit: 15000,
    city: "Mumbai",
    publicHub: "Nariman Point Executive Lounge",
    lat: 18.9256,
    lng: 72.8242,
    providerName: "VoltDrive Mumbai",
    providerVerified: true,
    image: "./assets/vehicles/luxuryi7.jpg",
    photos: [
      "./assets/vehicles/luxuryi7.jpg",
      "./assets/vehicles/model 3.jpg",
      "./assets/hero/car4.jpg"
    ],
    rating: 4.9,
    reviewCount: 15,
    availability: "available"
  },
  "toyota-hiace": {
    id: "toyota-hiace",
    name: "Toyota Hiace",
    modelYear: 2023,
    category: "Minivan",
    transmission: "Manual",
    fuel: "Diesel",
    seats: 10,
    price: 4300,
    extraHourRate: 540,
    lateFeePerHour: 800,
    securityDeposit: 9000,
    city: "Delhi",
    publicHub: "Dwarka Sector 21 Transit Hub",
    lat: 28.5522,
    lng: 77.0586,
    providerName: "Capital Executive Mobility",
    providerVerified: true,
    image: "./assets/vehicles/minivantoyotahiace.jpg",
    photos: [
      "./assets/vehicles/minivantoyotahiace.jpg",
      "./assets/vehicles/vancommuter.jpg"
    ],
    rating: 4.6,
    reviewCount: 13,
    availability: "available"
  }
};

// Merge any custom provider vehicles saved locally or from Supabase API
(function syncCustomVehicles() {
  try {
    const listA = JSON.parse(localStorage.getItem("drivora-provider-vehicles") || "[]");
    const listB = JSON.parse(localStorage.getItem("drivora_custom_vehicles_v1") || "[]");
    [...listA, ...listB].forEach((v) => {
      if (v && v.id && v.isPublished !== false && v.is_published !== false) {
        window.vehicleCatalog[v.id] = {
          ...window.vehicleCatalog[v.id],
          ...v,
          name: v.name || v.title,
          category: v.category || v.type || "SUV",
          modelYear: v.modelYear || v.model_year || 2024,
          fuel: v.fuel || v.fuel_type || "Petrol",
          seats: v.seats || v.seating_capacity || 5,
          price: Number(v.price || v.daily_rate || 2500),
          securityDeposit: Number(v.securityDeposit || v.security_deposit || 5000),
          publicHub: v.publicHub || v.public_hub || v.location || "Central Hub",
          image: v.image || v.primary_image || "./assets/vehicles/bmw x5.jpg",
          photos: v.photos || v.gallery_images || [v.image || v.primary_image || "./assets/vehicles/bmw x5.jpg"]
        };
      }
    });
  } catch {}
  window.vehicles = Object.values(window.vehicleCatalog);
})();

