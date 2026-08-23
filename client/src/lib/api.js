// Thin API client for the SubhOne backend. Uses the Vite dev proxy (/api -> :5000).
const BASE = "/api";

const qs = (params) => {
  const entries = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  const s = new URLSearchParams(entries).toString();
  return s ? `?${s}` : "";
};

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {
      /* non-json error */
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Catalog
  getMedicines: (params) => request(`/medicines${qs(params)}`),
  getSupplements: (params) => request(`/supplements${qs(params)}`),
  getBabyFood: (params) => request(`/baby-food${qs(params)}`),
  getProduct: (id) => request(`/products/${id}`),
  getBrands: () => request(`/brands`),

  // Lab tests
  getLabTests: (params) => request(`/lab-tests${qs(params)}`),
  getLabTest: (id) => request(`/lab-tests/${id}`),

  // Homepage content
  getFlashSale: () => request(`/flash-sale`),
  getBanners: () => request(`/banners`),
  getCategories: () => request(`/categories`),
  getWellness: () => request(`/wellness`),

  // Doctors
  getDoctors: (specialty) => request(`/doctors${qs({ specialty })}`),

  // Search
  search: (q) => request(`/search${qs({ q })}`),

  // Cart
  getCart: () => request(`/cart`),
  addToCart: (body) => request(`/cart/add`, { method: "POST", body: JSON.stringify(body) }),
  updateCart: (body) => request(`/cart/update`, { method: "PUT", body: JSON.stringify(body) }),
  removeFromCart: (type, id) => request(`/cart/${type}/${id}`, { method: "DELETE" }),
  clearCart: () => request(`/cart`, { method: "DELETE" }),

  // Coupons / checkout / orders
  validateCoupon: (code, subtotal) =>
    request(`/coupons/validate`, { method: "POST", body: JSON.stringify({ code, subtotal }) }),
  checkout: (body) => request(`/checkout`, { method: "POST", body: JSON.stringify(body) }),
  getOrders: () => request(`/orders`),
  getOrder: (id) => request(`/orders/${id}`),

  // Consultations & prescriptions
  bookConsultation: (body) =>
    request(`/consultations/book`, { method: "POST", body: JSON.stringify(body) }),
  uploadPrescription: (formData) =>
    request(`/prescriptions/upload`, { method: "POST", body: formData }),
};

export default api;
