// Thin API client for the SubhOne backend. Uses the Vite dev proxy (/api -> :5000).
const BASE = "/api";

const qs = (params) => {
  const entries = Object.entries(params || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  const s = new URLSearchParams(entries).toString();
  return s ? `?${s}` : "";
};

let refreshPromise = null;
let authLostListeners = [];

export const onAuthLost = (fn) => {
  authLostListeners.push(fn);
  return () => {
    authLostListeners = authLostListeners.filter((l) => l !== fn);
  };
};

const notifyAuthLost = () => authLostListeners.forEach((fn) => fn());

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const config = {
    ...options,
    credentials: "include", // Always send cookies
    headers: {
      ...(options.body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  };

  let res = await fetch(BASE + path, config);

  if (res.status === 401 && path !== "/auth/refresh" && path !== "/auth/login") {
    // Attempt silent refresh
    if (!refreshPromise) {
      refreshPromise = fetch(BASE + "/auth/refresh", { method: "POST", credentials: "include" })
        .then(async (r) => {
          if (!r.ok) throw new Error("Refresh failed");
          return r;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      await refreshPromise;
      // Retry original request
      res = await fetch(BASE + path, config);
    } catch (err) {
      // Refresh failed, session is dead. The UI will handle it if we return 401.
      // E.g., AuthContext will set user to null.
      notifyAuthLost();
    }
  }

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
  // Auth
  register: (body) => request(`/auth/register`, { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request(`/auth/login`, { method: "POST", body: JSON.stringify(body) }),
  logout: () => request(`/auth/logout`, { method: "POST" }),
  refresh: () => request(`/auth/refresh`, { method: "POST" }),
  me: () => request(`/auth/me`),
  
  // OTP
  sendOtp: (phone) => request(`/auth/otp/request`, { method: "POST", body: JSON.stringify({ phone }) }),
  loginWithOtp: (phone, code) => request(`/auth/otp/verify`, { method: "POST", body: JSON.stringify({ phone, code }) }),
  linkPhone: (challengeId, code) => request(`/auth/link-phone`, { method: "POST", body: JSON.stringify({ challengeId, code }) }),
  requestOtp: (phone) => request(`/auth/otp/request`, { method: "POST", body: JSON.stringify({ phone }) }),
  verifyOtp: (body) => request(`/auth/otp/verify`, { method: "POST", body: JSON.stringify(body) }),

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
  validateCoupon: (code) =>
    request(`/coupons/validate`, { method: "POST", body: JSON.stringify({ code }) }), // server-resolved pricing removes subtotal
  checkout: (body) => request(`/checkout`, { method: "POST", body: JSON.stringify(body) }),
  getOrders: () => request(`/orders`),
  getOrder: (id) => request(`/orders/${id}`),

  // Address
  getAddresses: () => request(`/addresses`),
  addAddress: (body) => request(`/addresses`, { method: "POST", body: JSON.stringify(body) }),
  updateAddress: (id, body) => request(`/addresses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAddress: (id) => request(`/addresses/${id}`, { method: "DELETE" }),

  // Consultations & prescriptions
  bookConsultation: (body) =>
    request(`/consultations/book`, { method: "POST", body: JSON.stringify(body) }),
  uploadPrescription: (formData) =>
    request(`/prescriptions/upload`, { method: "POST", body: formData }),
};

export default api;
