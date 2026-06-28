// api.js — AMAN MEDICAL Frontend API Client
// Connects the frontend to the Node.js + Express + MongoDB backend.
// Place this file next to your index.html and load it BEFORE app.js.

// ── Base URL — change this to your deployed backend URL ───────
// Development:  http://localhost:5000
// Render:       https://aman-medical-api.onrender.com
// Railway:      https://aman-medical-api.railway.app
const API_BASE = window.API_BASE_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────────────
// TOKEN HELPERS (localStorage so it survives page refreshes)
// ─────────────────────────────────────────────────────────────
const TokenStore = {
  get:    ()      => localStorage.getItem('aman_token'),
  set:    (token) => localStorage.setItem('aman_token', token),
  remove: ()      => localStorage.removeItem('aman_token'),
};

// ─────────────────────────────────────────────────────────────
// FETCH WRAPPER
// ─────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = TokenStore.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || 'Request failed');
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// AUTH API
// ─────────────────────────────────────────────────────────────
window.AuthAPI = {
  // Register new customer account
  register: async (name, email, password) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    TokenStore.set(data.token);
    return data;
  },

  // Customer login
  login: async (email, password) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    TokenStore.set(data.token);
    return data;
  },

  // Admin login (separate endpoint)
  adminLogin: async (email, password) => {
    const data = await apiFetch('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    TokenStore.set(data.token);
    return data;
  },

  // Get current logged-in user
  getMe: () => apiFetch('/auth/me'),

  // Toggle wishlist product (returns updated wishlist array)
  toggleWishlist: (productId) =>
    apiFetch('/auth/wishlist', {
      method: 'PUT',
      body: JSON.stringify({ productId }),
    }),

  // Logout — just remove the token
  logout: () => TokenStore.remove(),

  // Check if a token exists
  isLoggedIn: () => !!TokenStore.get(),
};

// ─────────────────────────────────────────────────────────────
// PRODUCTS API
// ─────────────────────────────────────────────────────────────
window.ProductsAPI = {
  // Get all products (with optional filters)
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/products${qs ? '?' + qs : ''}`);
  },

  // Get single product by ID
  getOne: (id) => apiFetch(`/products/${id}`),

  // ── Admin only ──────────────────────────────────────────────

  // Get all products including inactive (admin dashboard)
  getAllAdmin: () => apiFetch('/products/admin/all'),

  // Create new product
  create: (productData) =>
    apiFetch('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    }),

  // Update product fields
  update: (id, productData) =>
    apiFetch(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    }),

  // Fast stock-only update
  updateStock: (id, stock) =>
    apiFetch(`/products/${id}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock }),
    }),

  // Soft-delete product
  delete: (id) =>
    apiFetch(`/products/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────
// ORDERS API
// ─────────────────────────────────────────────────────────────
window.OrdersAPI = {
  // Place a new order (guest or authenticated)
  place: (orderData) =>
    apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    }),

  // Get logged-in customer's orders
  getMine: () => apiFetch('/orders/my'),

  // Download a PDF invoice for an order — triggers a browser file download.
  // Separate from apiFetch since the response is a binary PDF, not JSON.
  downloadInvoice: async (orderId) => {
    const token = TokenStore.get();
    const response = await fetch(`${API_BASE}/orders/${orderId}/invoice`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      let message = 'Could not download invoice.';
      try {
        const data = await response.json();
        message = data.message || message;
      } catch { /* response wasn't JSON, keep default message */ }
      throw new Error(message);
    }

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `invoice-${orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // ── Admin only ──────────────────────────────────────────────

  // Get all orders
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/orders${qs ? '?' + qs : ''}`);
  },

  // Get single order by ID or orderId
  getOne: (id) => apiFetch(`/orders/${id}`),

  // Update order status
  updateStatus: (id, status) =>
    apiFetch(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ─────────────────────────────────────────────────────────────
// PAYMENT API (Razorpay)
// ─────────────────────────────────────────────────────────────
window.PaymentAPI = {
  // Ask backend to create a Razorpay order for the current cart
  createOrder: (items) =>
    apiFetch('/payment/create-order', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Send Razorpay's response + order details back for verification
  verify: (payload) =>
    apiFetch('/payment/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ─────────────────────────────────────────────────────────────
// REVIEWS API
// ─────────────────────────────────────────────────────────────
window.ReviewsAPI = {
  // Public — list reviews + average rating for a product
  getForProduct: (productId) => apiFetch(`/reviews/${productId}`),

  // Logged-in — check if the user has a delivered order they can review
  canReview: (productId) => apiFetch(`/reviews/${productId}/can-review`),

  // Logged-in — submit a review
  submit: ({ productId, orderId, rating, comment }) =>
    apiFetch('/reviews', {
      method: 'POST',
      body: JSON.stringify({ productId, orderId, rating, comment }),
    }),
};

// ─────────────────────────────────────────────────────────────
// NEWSLETTER API
// ─────────────────────────────────────────────────────────────
window.NewsletterAPI = {
  subscribe: (email) =>
    apiFetch('/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

// ─────────────────────────────────────────────────────────────
// CONVENIENCE — restore session on page load
// ─────────────────────────────────────────────────────────────
window.restoreSession = async () => {
  if (!AuthAPI.isLoggedIn()) return null;
  try {
    const data = await AuthAPI.getMe();
    return data.user;
  } catch {
    // Token expired or invalid — clear it
    TokenStore.remove();
    return null;
  }
};

console.log('✅ AMAN MEDICAL API client loaded. Base URL:', API_BASE);
