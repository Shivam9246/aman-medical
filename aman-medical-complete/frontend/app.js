// app.js — AMAN MEDICAL Store Logic (Backend-connected version)
// Requires api.js to be loaded first in index.html

// ============================================================
// STATIC DATA (categories, testimonials, marquee — no DB needed)
// ============================================================

const CATEGORY_META = {
  'Medicines':     { icon:'💊', color1:'#16316F', color2:'#2B4A8C' },
  'Devices':       { icon:'🩺', color1:'#0FA98E', color2:'#3FD6B8' },
  'Wellness':      { icon:'🌿', color1:'#2FC4DD', color2:'#5FDCF0' },
  'Safety':        { icon:'😷', color1:'#FF6452', color2:'#FF8E80' },
  'Personal Care': { icon:'🧷', color1:'#FFB23E', color2:'#FFCB75' },
};

const TESTIMONIALS = [
  { name:'Ritu Sharma',   loc:'Najafgarh, Delhi',   text:'Ordered my mother\'s BP monitor and medicines together — delivered same evening. The stock status helped me know it was actually available before ordering.', initials:'RS', color:'#16316F' },
  { name:'Mohit Verma',   loc:'Dwarka, Delhi',      text:'Finally a medical store online that shows real stock instead of letting me order something that\'s out of stock. Very transparent and quick.',             initials:'MV', color:'#0FA98E' },
  { name:'Anjali Kapoor', loc:'Uttam Nagar, Delhi', text:'Their pharmacist called to confirm my prescription order before dispatch. Felt safe and properly looked after.',                                           initials:'AK', color:'#FF6452' },
];

const MARQUEE_ITEMS = [
  '🚚 Free delivery above ₹499', '✅ 100% genuine medicines', '👨‍⚕️ Pharmacist verified orders',
  '⚡ Same-day dispatch', '💳 Cash on delivery available', '🔒 Secure checkout',
];

// ============================================================
// APPLICATION STATE
// ============================================================
let state = {
  // Products fetched from backend
  products: [],

  // Cart: { productId: qty } — kept in sessionStorage so it survives refresh
  cart: JSON.parse(sessionStorage.getItem('aman_cart') || '{}'),

  // Wishlist: array of product IDs (synced with backend when logged in)
  wishlist: [],

  // Current user object from backend: { id, name, email, role, wishlist }
  currentUser: null,

  // Is admin session active
  isAdmin: false,

  // UI filters
  activeCategory: 'All',
  searchQuery: '',

  // Loading state
  productsLoading: false,
};

// ── Persist cart to sessionStorage ───────────────────────────
function saveCart() {
  sessionStorage.setItem('aman_cart', JSON.stringify(state.cart));
}

// ── Format currency ──────────────────────────────────────────
function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

// ── Stock status helper ───────────────────────────────────────
function stockStatus(product) {
  if (product.stock <= 0) return 'out';
  if (product.stock <= product.lowStockThreshold) return 'low';
  return 'in';
}

function stockLabel(product) {
  const s = stockStatus(product);
  if (s === 'out') return 'Out of Stock';
  if (s === 'low') return `Only ${product.stock} left`;
  return `In Stock (${product.stock})`;
}

function getProduct(id) {
  return state.products.find(p => p._id === id || p.id === id);
}

// ============================================================
// SESSION RESTORE (runs on page load)
// ============================================================
async function initSession() {
  try {
    const user = await window.restoreSession();
    if (user) {
      state.currentUser = user;
      state.wishlist    = user.wishlist || [];
      if (user.role === 'admin') state.isAdmin = true;
    }
  } catch {
    // Not logged in — that's fine
  }
  renderAccountDropdown();
}

// ============================================================
// PRODUCTS — fetch from backend
// ============================================================
async function loadProducts(params = {}) {
  state.productsLoading = true;
  showProductsSkeleton();

  try {
    const data = await window.ProductsAPI.getAll(params);
    state.products = data.products || [];
    renderProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
    showToast('Could not load products. Please refresh.', 'error');
    document.getElementById('product-grid').innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--ink-soft);">
        <div style="font-size:48px; margin-bottom:14px;">⚠️</div>
        <p style="font-weight:700; font-size:15px;">Could not connect to server.</p>
        <p style="font-size:13px; margin-top:6px;">Check your internet connection or try again.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:18px;" onclick="loadProducts()">Retry</button>
      </div>`;
  } finally {
    state.productsLoading = false;
  }
}

function showProductsSkeleton() {
  const grid = document.getElementById('product-grid');
  grid.style.display = 'grid';
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="pcard" style="animation: pulse 1.5s ease infinite;">
      <div style="height:180px; background:var(--line); border-radius:var(--radius) var(--radius) 0 0;"></div>
      <div style="padding:16px;">
        <div style="height:12px; background:var(--line); border-radius:4px; margin-bottom:10px; width:60%;"></div>
        <div style="height:16px; background:var(--line); border-radius:4px; margin-bottom:10px;"></div>
        <div style="height:12px; background:var(--line); border-radius:4px; width:80%;"></div>
      </div>
    </div>`).join('');
}

// ============================================================
// AUTHENTICATION
// ============================================================

// ── Account dropdown ──────────────────────────────────────────
function renderAccountDropdown() {
  const dd = document.getElementById('account-dropdown');
  if (state.currentUser) {
    dd.innerHTML = `
      <div class="ad-header">
        <div class="ad-name">${state.currentUser.name}</div>
        <div class="ad-email">${state.currentUser.email}</div>
      </div>
      <a href="#" id="dd-my-orders">📦 My Orders</a>
      <a href="#" id="dd-wishlist">❤️ Wishlist</a>
      <button class="ad-logout" id="dd-logout">🚪 Log Out</button>
      <div style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;">
        <button class="ad-admin" id="dd-admin">🔐 Staff Login</button>
      </div>`;
  } else {
    dd.innerHTML = `
      <button id="dd-login" style="font-weight:700;">👤 Login / Sign Up</button>
      <div style="border-top:1px solid var(--line); margin-top:6px; padding-top:6px;">
        <button class="ad-admin" id="dd-admin">🔐 Staff Login</button>
      </div>`;
  }

  document.getElementById('dd-login')?.addEventListener('click', (e) => { e.preventDefault(); closeAccountDropdown(); openAuthModal('login'); });
  document.getElementById('dd-my-orders')?.addEventListener('click', (e) => { e.preventDefault(); closeAccountDropdown(); openMyOrders(); });
  document.getElementById('dd-wishlist')?.addEventListener('click', (e) => { e.preventDefault(); closeAccountDropdown(); showWishlist(); });
  document.getElementById('dd-logout')?.addEventListener('click', () => { logoutCustomer(); closeAccountDropdown(); });
  document.getElementById('dd-admin')?.addEventListener('click', () => { closeAccountDropdown(); openAdminLogin(); });
}

function toggleAccountDropdown() { document.getElementById('account-dropdown').classList.toggle('open'); }
function closeAccountDropdown()  { document.getElementById('account-dropdown').classList.remove('open'); }

async function logoutCustomer() {
  window.AuthAPI.logout();
  state.currentUser = null;
  state.isAdmin     = false;
  state.wishlist    = [];
  renderAccountDropdown();
  renderProducts();
  updateWishCount();
  showToast('Logged out successfully.', 'info');
}

// ── Auth modal ────────────────────────────────────────────────
let authMode = 'login'; // 'login' | 'signup'

function openAuthModal(mode = 'login') {
  authMode = mode;
  renderAuthModal();
  document.getElementById('auth-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('show');
  document.getElementById('auth-box').classList.remove('orders-box');
  document.body.style.overflow = '';
}

function renderAuthModal() {
  const isLogin = authMode === 'login';
  document.getElementById('auth-box').innerHTML = `
    <button class="modal-close" id="auth-close">✕</button>
    <h3>${isLogin ? 'Welcome back' : 'Create your account'}</h3>
    <div class="sub">${isLogin ? 'Log in to track orders and check out faster.' : 'Sign up to save your details and view order history.'}</div>
    <div class="auth-tabs">
      <div class="auth-tab ${isLogin ? 'active' : ''}" data-mode="login">Log In</div>
      <div class="auth-tab ${!isLogin ? 'active' : ''}" data-mode="signup">Sign Up</div>
    </div>
    <div class="auth-error" id="auth-error"></div>
    <form id="auth-form">
      ${!isLogin ? `<div class="form-group"><label>Full Name</label><input type="text" id="auth-name" required placeholder="Your name"></div>` : ''}
      <div class="form-group"><label>Email</label><input type="email" id="auth-email" required placeholder="you@example.com"></div>
      <div class="form-group"><label>Password</label><input type="password" id="auth-password" required placeholder="••••••••" minlength="4"></div>
      <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;" id="auth-submit-btn">
        ${isLogin ? 'Log In' : 'Create Account'}
      </button>
    </form>
    <div class="admin-link-row">
      <button id="auth-admin-switch">Staff member? Admin login →</button>
    </div>`;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => { authMode = tab.dataset.mode; renderAuthModal(); });
  });
  document.getElementById('auth-admin-switch').addEventListener('click', () => { closeAuthModal(); openAdminLogin(); });
  document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    isLogin ? handleLogin() : handleSignup();
  });
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function setAuthBtnLoading(loading) {
  const btn = document.getElementById('auth-submit-btn');
  if (btn) {
    btn.disabled     = loading;
    btn.textContent  = loading ? 'Please wait…' : (authMode === 'login' ? 'Log In' : 'Create Account');
  }
}

async function handleSignup() {
  const name     = document.getElementById('auth-name')?.value.trim();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  setAuthBtnLoading(true);
  try {
    const data = await window.AuthAPI.register(name, email, password);
    state.currentUser = data.user;
    state.wishlist    = data.user.wishlist || [];
    renderAccountDropdown();
    closeAuthModal();
    showToast(`Welcome, ${data.user.name}! Your account is ready.`, 'success');
  } catch (err) {
    showAuthError(err.message || 'Signup failed. Please try again.');
  } finally {
    setAuthBtnLoading(false);
  }
}

async function handleLogin() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  setAuthBtnLoading(true);
  try {
    const data = await window.AuthAPI.login(email, password);
    state.currentUser = data.user;
    state.wishlist    = data.user.wishlist || [];
    renderAccountDropdown();
    closeAuthModal();
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    renderProducts(); // Re-render so wishlists show correctly
    updateWishCount();
  } catch (err) {
    showAuthError(err.message || 'Login failed. Please check your credentials.');
  } finally {
    setAuthBtnLoading(false);
  }
}

// ── Admin login ───────────────────────────────────────────────
function openAdminLogin() {
  document.getElementById('auth-box').innerHTML = `
    <button class="modal-close" id="auth-close">✕</button>
    <h3>🔐 Staff Login</h3>
    <div class="sub">Enter your admin credentials to access the dashboard.</div>
    <div class="auth-error" id="auth-error"></div>
    <form id="admin-login-form">
      <div class="form-group"><label>Admin Email</label><input type="email" id="admin-email" required placeholder="admin@amanmedical.in" autofocus></div>
      <div class="form-group"><label>Admin Password</label><input type="password" id="admin-password" required placeholder="••••••••"></div>
      <button type="submit" class="btn btn-dark" style="width:100%; justify-content:center;" id="admin-submit-btn">Enter Dashboard</button>
    </form>`;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const btn      = document.getElementById('admin-submit-btn');
    btn.disabled   = true;
    btn.textContent = 'Signing in…';
    try {
      await window.AuthAPI.adminLogin(email, password);
      state.isAdmin = true;
      closeAuthModal();
      openAdminDashboard();
      showToast('Welcome to the admin dashboard.', 'success');
    } catch (err) {
      const errEl = document.getElementById('auth-error');
      errEl.textContent = err.message || 'Invalid credentials.';
      errEl.classList.add('show');
      btn.disabled    = false;
      btn.textContent = 'Enter Dashboard';
    }
  });

  document.getElementById('auth-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

// ── My Orders ─────────────────────────────────────────────────
const ORDER_STEPS = ['placed', 'confirmed', 'packed', 'dispatched', 'delivered'];
const ORDER_STEP_LABELS = { placed: 'Placed', confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Dispatched', delivered: 'Delivered' };

let myOrdersCache = [];
let myOrdersLoading = true;

async function openMyOrders() {
  if (!state.currentUser) { openAuthModal('login'); return; }

  document.getElementById('auth-box').classList.add('orders-box');
  myOrdersLoading = true;
  renderMyOrdersList();

  document.getElementById('auth-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';

  try {
    const data = await window.OrdersAPI.getMine();
    myOrdersCache = data.orders || [];
    myOrdersLoading = false;
    renderMyOrdersList();
  } catch (err) {
    myOrdersLoading = false;
    document.getElementById('my-orders-list').innerHTML =
      `<p style="color:var(--coral); padding:20px; text-align:center;">${err.message || 'Could not load orders.'}</p>`;
  }
}

function renderMyOrdersList() {
  document.getElementById('auth-box').innerHTML = `
    <button class="modal-close" id="auth-close">✕</button>
    <h3>My Orders</h3>
    <div class="sub">Signed in as ${state.currentUser.email}</div>
    <div id="my-orders-list" style="margin-top:18px; max-height:60vh; overflow-y:auto;">
      <div style="text-align:center; padding:30px; color:var(--ink-soft);">Loading…</div>
    </div>`;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);

  const list = document.getElementById('my-orders-list');

  if (myOrdersLoading) {
    list.innerHTML = `<div style="text-align:center; padding:30px; color:var(--ink-soft);">Loading…</div>`;
    return;
  }

  if (myOrdersCache.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">📦</div><p style="font-weight:700; color:var(--ink);">No orders yet</p></div>`;
    return;
  }

  list.innerHTML = myOrdersCache.map(o => `
    <div class="order-row-card" data-order-id="${o._id}">
      <div>
        <div class="oid">${o.orderId}</div>
        <div class="ometa">${new Date(o.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})} · ${o.items.length} item${o.items.length > 1 ? 's' : ''}</div>
        <div class="oitems">${o.items.map(it => `${it.name} ×${it.qty}`).join(', ')}</div>
        <div style="margin-top:4px;"><span class="mini-badge ${o.status === 'cancelled' ? 'out' : 'ok'}">${o.status}</span></div>
      </div>
      <div class="ototal">${fmt(o.total)}</div>
    </div>`).join('');

  list.querySelectorAll('.order-row-card').forEach(card => {
    card.addEventListener('click', () => openOrderDetail(card.dataset.orderId));
  });
}

function openOrderDetail(orderId) {
  const o = myOrdersCache.find(x => x._id === orderId);
  if (!o) return;

  const isCancelled  = o.status === 'cancelled';
  const currentIndex = ORDER_STEPS.indexOf(o.status);

  const stepperHtml = isCancelled
    ? `<div class="order-cancelled-banner">✕ This order was cancelled</div>`
    : `<div class="order-stepper">
        ${ORDER_STEPS.map((step, i) => {
          const cls = i < currentIndex ? 'done' : i === currentIndex ? 'current' : '';
          return `<div class="step ${cls}">
                    <div class="dot">${i < currentIndex ? '✓' : i + 1}</div>
                    <div class="label">${ORDER_STEP_LABELS[step]}</div>
                  </div>`;
        }).join('')}
      </div>`;

  document.getElementById('auth-box').innerHTML = `
    <button class="modal-close" id="auth-close">✕</button>
    <div class="orders-back" id="orders-back-btn">← Back to orders</div>

    <div class="order-detail-head">
      <div>
        <div class="order-detail-id">${o.orderId}</div>
        <div class="order-detail-date">${new Date(o.createdAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric', hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      <span class="mini-badge ${isCancelled ? 'out' : 'ok'}">${o.status}</span>
    </div>

    ${stepperHtml}

    <div class="order-detail-section">
      <h4>Items</h4>
      ${o.items.map(it => `
        <div class="order-line-item">
          <div><span class="oli-name">${it.emoji || '💊'} ${it.name}</span><span class="oli-qty">×${it.qty}</span></div>
          <div class="oli-price">${fmt(it.subtotal)}</div>
        </div>`).join('')}
    </div>

    <div class="order-detail-section">
      <div class="order-totals-row"><span>Subtotal</span><span>${fmt(o.subtotal)}</span></div>
      <div class="order-totals-row"><span>Delivery</span><span>${o.delivery === 0 ? 'FREE' : fmt(o.delivery)}</span></div>
      <div class="order-totals-row grand"><span>Total</span><span>${fmt(o.total)}</span></div>
    </div>

    <div class="order-detail-section">
      <h4>Delivery Address</h4>
      <p style="font-size:13px; color:var(--ink-soft);">${o.customerName} · ${o.customerPhone}<br>${o.address}</p>
    </div>

    <button class="invoice-btn" id="download-invoice-btn">⬇ Download Invoice (PDF)</button>
  `;

  document.getElementById('auth-close').addEventListener('click', closeAuthModal);
  document.getElementById('orders-back-btn').addEventListener('click', renderMyOrdersList);

  const invoiceBtn = document.getElementById('download-invoice-btn');
  invoiceBtn.addEventListener('click', async () => {
    invoiceBtn.disabled = true;
    invoiceBtn.textContent = 'Downloading…';
    try {
      await window.OrdersAPI.downloadInvoice(o._id);
    } catch (err) {
      showToast(err.message || 'Could not download invoice.', 'error');
    } finally {
      invoiceBtn.disabled = false;
      invoiceBtn.textContent = '⬇ Download Invoice (PDF)';
    }
  });
}

// ============================================================
// WISHLIST
// ============================================================
async function toggleWishlist(id) {
  if (!state.currentUser) {
    showToast('Please log in to save items to your wishlist.', 'info');
    openAuthModal('login');
    return;
  }

  // Optimistic UI update
  const idx = state.wishlist.indexOf(id);
  if (idx >= 0) {
    state.wishlist.splice(idx, 1);
  } else {
    state.wishlist.push(id);
    showToast('Added to wishlist.', 'success');
  }
  updateWishCount();
  renderProducts();

  try {
    const data    = await window.AuthAPI.toggleWishlist(id);
    state.wishlist = data.wishlist;
    updateWishCount();
    renderProducts();
  } catch (err) {
    showToast('Could not update wishlist. Try again.', 'error');
    // Revert optimistic update
    if (idx >= 0) state.wishlist.splice(state.wishlist.indexOf(id), 0, id);
    else state.wishlist.splice(state.wishlist.indexOf(id), 1);
    updateWishCount();
    renderProducts();
  }
}

function showWishlist() {
  const wished = state.products.filter(p => state.wishlist.includes(p._id));
  const grid   = document.getElementById('product-grid');
  const noRes  = document.getElementById('no-results');

  if (wished.length === 0) {
    showToast('Your wishlist is empty.', 'info');
    return;
  }

  state.activeCategory = 'All';
  state.searchQuery    = '';
  document.getElementById('search-input').value = '';
  renderCatStrip();

  grid.style.display = 'grid';
  noRes.style.display = 'none';
  grid.innerHTML = wished.map(p => productCardHTML(p)).join('');
  attachProductCardEvents();
  document.getElementById('result-count').textContent = `${wished.length} wishlisted item${wished.length !== 1 ? 's' : ''}`;
  document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
}

function updateWishCount() {
  const count = state.wishlist.length;
  const el    = document.getElementById('wish-count');
  el.textContent  = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

// ============================================================
// MARQUEE
// ============================================================
function renderMarquee() {
  const track = document.getElementById('marquee-track');
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  track.innerHTML = items.map(t => `<span>${t}</span>`).join('');
}

// ============================================================
// CATEGORY SHOWCASE
// ============================================================
function renderCategoryShowcase() {
  const wrap = document.getElementById('cat-showcase');
  const cats = Object.keys(CATEGORY_META);
  wrap.innerHTML = cats.map(cat => {
    const meta  = CATEGORY_META[cat];
    const count = state.products.filter(p => p.category === cat && p.isActive !== false).length;
    return `
      <a href="#shop" class="cat-card" data-cat="${cat}" style="background:linear-gradient(135deg, ${meta.color1}, ${meta.color2});">
        <div class="icon">${meta.icon}</div>
        <div>
          <h3>${cat}</h3>
          <div class="count">${count} products</div>
        </div>
      </a>`;
  }).join('');

  wrap.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      state.activeCategory = card.dataset.cat;
      renderCatStrip();
      renderProducts();
      document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ============================================================
// CATEGORY FILTER STRIP
// ============================================================
function renderCatStrip() {
  const strip = document.getElementById('cat-strip');
  const cats  = ['All', ...Object.keys(CATEGORY_META)];
  strip.innerHTML = cats.map(cat => {
    const icon   = cat === 'All' ? '🗂️' : CATEGORY_META[cat].icon;
    const active = state.activeCategory === cat ? 'active' : '';
    return `<button class="cat-chip ${active}" data-cat="${cat}"><span class="emoji">${icon}</span>${cat}</button>`;
  }).join('');

  strip.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.activeCategory = chip.dataset.cat;
      renderCatStrip();
      renderProducts();
    });
  });
}

// ============================================================
// PRODUCT GRID
// ============================================================
function getFilteredProducts() {
  return state.products.filter(p => {
    const matchCat    = state.activeCategory === 'All' || p.category === state.activeCategory;
    const matchSearch = !state.searchQuery ||
      p.name.toLowerCase().includes(state.searchQuery) ||
      (p.desc || '').toLowerCase().includes(state.searchQuery) ||
      p.category.toLowerCase().includes(state.searchQuery);
    return matchCat && matchSearch && p.isActive !== false;
  });
}

function renderProducts() {
  const grid    = document.getElementById('product-grid');
  const noRes   = document.getElementById('no-results');
  const list    = getFilteredProducts();

  document.getElementById('result-count').textContent = `${list.length} product${list.length !== 1 ? 's' : ''}`;

  if (list.length === 0) {
    grid.style.display = 'none';
    noRes.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  noRes.style.display = 'none';
  grid.innerHTML = list.map(p => productCardHTML(p)).join('');
  attachProductCardEvents();
  renderCategoryShowcase();
}

function productCardHTML(p) {
  const id          = p._id || p.id;
  const status      = stockStatus(p);
  const statusClass = status === 'in' ? 'stock-in' : status === 'low' ? 'stock-low' : 'stock-out';
  const barColor    = status === 'in' ? 'var(--teal)' : status === 'low' ? 'var(--amber)' : '#D8534A';
  const barPct      = Math.min(100, Math.round((p.stock / (p.lowStockThreshold * 4)) * 100));
  const inCart      = state.cart[id] || 0;
  const isWished    = state.wishlist.includes(id);

  let badgeHTML = '';
  if (p.tag === 'sale')     badgeHTML = `<span class="badge badge-sale">SALE</span>`;
  else if (p.tag === 'new') badgeHTML = `<span class="badge badge-new">NEW</span>`;
  else                       badgeHTML = `<span></span>`;

  const rxBadge = p.rx ? `<span class="badge badge-rx" style="margin-left:4px;">RX</span>` : '';

  return `
  <div class="pcard reveal in" data-id="${id}">
    <div class="pcard-media" style="background:${p.bg || '#E9F0FB'};">
      <div class="pcard-badges">
        <div>${badgeHTML}${rxBadge}</div>
        <button class="wish-btn ${isWished ? 'active' : ''}" data-wish="${id}" aria-label="Wishlist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? '#FF6452' : 'none'}" stroke="${isWished ? '#FF6452' : '#16316F'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <span style="cursor:pointer;" data-open="${id}">${p.emoji || '💊'}</span>
    </div>
    <div class="pcard-body">
      <div class="pcard-cat">${p.category}</div>
      <div class="pcard-name" data-open="${id}" style="cursor:pointer;">${p.name}</div>
      <div class="pcard-meta">${p.unit} · ⭐ ${p.rating}</div>
      <div>
        <div class="stock-row ${statusClass}"><span class="stock-dot"></span>${stockLabel(p)}</div>
        <div class="stock-bar-track"><div class="stock-bar-fill" style="width:${barPct}%; background:${barColor};"></div></div>
      </div>
      <div class="pcard-footer">
        <div class="price-block">
          <span class="price">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
        ${inCart > 0
          ? `<div class="qty-stepper" data-id="${id}">
               <button data-action="dec">−</button>
               <span>${inCart}</span>
               <button data-action="inc" ${inCart >= p.stock ? 'disabled style="opacity:.3"' : ''}>+</button>
             </div>`
          : `<button class="add-btn" data-add="${id}" ${status === 'out' ? 'disabled' : ''} aria-label="Add to cart">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
             </button>`}
      </div>
    </div>
  </div>`;
}

function attachProductCardEvents() {
  document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
  document.querySelectorAll('.qty-stepper').forEach(s => {
    const id = s.dataset.id;
    s.querySelector('[data-action="inc"]').addEventListener('click', () => addToCart(id));
    s.querySelector('[data-action="dec"]').addEventListener('click', () => removeOneFromCart(id));
  });
  document.querySelectorAll('[data-wish]').forEach(btn => btn.addEventListener('click', () => toggleWishlist(btn.dataset.wish)));
  document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openProductDetail(el.dataset.open)));
}

// ============================================================
// CART
// ============================================================
function addToCart(id) {
  const p       = getProduct(id);
  if (!p) return;
  const current = state.cart[id] || 0;
  if (current >= p.stock) {
    showToast(`Only ${p.stock} units available.`, 'error');
    return;
  }
  state.cart[id] = current + 1;
  saveCart();
  renderProducts();
  renderCartDrawer();
  updateCartCount();
  if (current === 0) showToast(`${p.name} added to cart.`, 'success');
}

function removeOneFromCart(id) {
  const current = state.cart[id] || 0;
  if (current <= 1) delete state.cart[id];
  else state.cart[id] = current - 1;
  saveCart();
  renderProducts();
  renderCartDrawer();
  updateCartCount();
}

function removeFromCart(id) {
  delete state.cart[id];
  saveCart();
  renderProducts();
  renderCartDrawer();
  updateCartCount();
}

function cartTotalQty()  { return Object.values(state.cart).reduce((a, b) => a + b, 0); }
function cartSubtotal()  {
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const p = getProduct(id);
    return p ? sum + p.price * qty : sum;
  }, 0);
}

function updateCartCount() {
  const count = cartTotalQty();
  const el    = document.getElementById('cart-count');
  el.textContent  = count;
  el.style.display = count > 0 ? 'flex' : 'none';
}

function renderCartDrawer() {
  const body    = document.getElementById('drawer-body');
  const foot    = document.getElementById('drawer-foot');
  const entries = Object.entries(state.cart);

  if (entries.length === 0) {
    body.innerHTML = `
      <div class="empty-cart">
        <div class="emoji">🛒</div>
        <p style="font-weight:700; color:var(--ink);">Your cart is empty</p>
        <p style="font-size:13px;">Add products to get started.</p>
        <button class="btn btn-primary btn-sm" id="empty-cart-shop">Browse Products</button>
      </div>`;
    foot.style.display = 'none';
    document.getElementById('empty-cart-shop')?.addEventListener('click', () => {
      closeDrawer();
      document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
    return;
  }

  body.innerHTML = entries.map(([id, qty]) => {
    const p = getProduct(id);
    if (!p) return '';
    return `
      <div class="cart-item">
        <div class="cart-item-media" style="background:${p.bg || '#E9F0FB'};">${p.emoji || '💊'}</div>
        <div class="cart-item-info">
          <div class="nm">${p.name}</div>
          <div class="pr">${fmt(p.price)}</div>
          <div class="cart-item-row">
            <div class="qty-stepper" data-id="${id}">
              <button data-action="dec">−</button>
              <span>${qty}</span>
              <button data-action="inc" ${qty >= p.stock ? 'disabled style="opacity:.3"' : ''}>+</button>
            </div>
            <button class="remove-btn" data-remove="${id}">Remove</button>
          </div>
        </div>
      </div>`;
  }).join('');

  body.querySelectorAll('.qty-stepper').forEach(s => {
    const id = s.dataset.id;
    s.querySelector('[data-action="inc"]').addEventListener('click', () => addToCart(id));
    s.querySelector('[data-action="dec"]').addEventListener('click', () => removeOneFromCart(id));
  });
  body.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => removeFromCart(btn.dataset.remove)));

  const subtotal = cartSubtotal();
  const delivery = subtotal >= 499 || subtotal === 0 ? 0 : 49;
  foot.style.display = 'block';
  document.getElementById('sum-subtotal').textContent = fmt(subtotal);
  document.getElementById('sum-delivery').textContent = delivery === 0 ? 'FREE' : fmt(delivery);
  document.getElementById('sum-total').textContent    = fmt(subtotal + delivery);
}

function openDrawer()  {
  document.getElementById('cart-drawer').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================
function openProductDetail(id) {
  const p = getProduct(id);
  if (!p) return;

  const status      = stockStatus(p);
  const statusClass = status === 'in' ? 'stock-in' : status === 'low' ? 'stock-low' : 'stock-out';
  const inCart      = state.cart[id] || 0;

  document.getElementById('pdp-box').innerHTML = `
    <button class="modal-close" id="pdp-close">✕</button>
    <div class="pdp-grid">
      <div class="pdp-media" style="background:${p.bg || '#E9F0FB'};">${p.emoji || '💊'}</div>
      <div class="pdp-info">
        <div class="pcard-cat">${p.category}${p.rx ? ' · Prescription Required' : ''}</div>
        <h2>${p.name}</h2>
        <div class="stock-row ${statusClass}"><span class="stock-dot"></span>${stockLabel(p)}</div>
        <div class="pdp-price-row">
          <span class="price">${fmt(p.price)}</span>
          ${p.oldPrice ? `<span class="price-old">${fmt(p.oldPrice)}</span>` : ''}
        </div>
        <p class="desc">${p.desc || ''}</p>
        <div class="pdp-actions">
          ${inCart > 0
            ? `<div class="qty-stepper" data-id="${id}" style="transform:scale(1.1);">
                 <button data-action="dec">−</button><span>${inCart}</span>
                 <button data-action="inc" ${inCart >= p.stock ? 'disabled style="opacity:.3"' : ''}>+</button>
               </div>`
            : `<button class="btn btn-primary" data-add="${id}" ${status === 'out' ? 'disabled' : ''}>Add to Cart</button>`}
          <button class="icon-btn" data-wish="${id}" style="background:var(--bg);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${state.wishlist.includes(id) ? '#FF6452' : 'none'}" stroke="${state.wishlist.includes(id) ? '#FF6452' : '#16316F'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        <div class="spec-list">
          <div><span>Manufacturer</span><span>${p.mfg || '—'}</span></div>
          <div><span>Pack Size</span><span>${p.unit || '—'}</span></div>
          <div><span>Rating</span><span>⭐ ${p.rating} / 5</span></div>
        </div>
      </div>
    </div>
    <div class="reviews-section pdp-reviews-pad" id="pdp-reviews">
      <div style="text-align:center; padding:16px; color:var(--ink-soft); font-size:13px;">Loading reviews…</div>
    </div>`;

  document.getElementById('pdp-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';

  document.getElementById('pdp-close').addEventListener('click', closePdp);
  document.querySelector('#pdp-box [data-add]')?.addEventListener('click', () => { addToCart(id); closePdp(); openDrawer(); });
  document.querySelector('#pdp-box [data-wish]')?.addEventListener('click', () => { toggleWishlist(id); closePdp(); });
  document.querySelector('#pdp-box .qty-stepper [data-action="inc"]')?.addEventListener('click', () => { addToCart(id); openProductDetail(id); });
  document.querySelector('#pdp-box .qty-stepper [data-action="dec"]')?.addEventListener('click', () => { removeOneFromCart(id); openProductDetail(id); });

  loadProductReviews(id);
}
function closePdp() {
  document.getElementById('pdp-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

// ── Reviews (inside product detail modal) ──────────────────────
async function loadProductReviews(productId) {
  const container = document.getElementById('pdp-reviews');
  if (!container) return; // modal may have been closed already

  try {
    const data = await window.ReviewsAPI.getForProduct(productId);
    renderReviewsSection(productId, data);
  } catch (err) {
    container.innerHTML = `<p style="color:var(--ink-soft); font-size:12.5px; text-align:center;">Could not load reviews.</p>`;
  }
}

function renderReviewsSection(productId, data) {
  const container = document.getElementById('pdp-reviews');
  if (!container) return;

  const { reviews = [], average, count = 0 } = data;

  const summaryHtml = average
    ? `<div class="reviews-summary">
         <span class="avg">${average}</span>
         <span class="stars">${'★'.repeat(Math.round(average))}${'☆'.repeat(5 - Math.round(average))}</span>
         <span class="count">${count} review${count !== 1 ? 's' : ''}</span>
       </div>`
    : `<div class="reviews-summary"><span class="count">No reviews yet — be the first!</span></div>`;

  const listHtml = reviews.length > 0
    ? reviews.map(r => `
        <div class="review-card">
          <div class="rc-top">
            <span class="rc-name">${r.userName}</span>
            <span class="rc-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
          </div>
          ${r.comment ? `<div class="rc-comment">${r.comment}</div>` : ''}
          <div class="rc-date">${new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>`).join('')
    : '';

  container.innerHTML = `
    <h4 style="font-size:14px; font-weight:800; color:var(--navy); margin-bottom:12px;">Reviews</h4>
    ${summaryHtml}
    <div id="review-list-items">${listHtml}</div>
    <div id="review-form-slot"></div>
  `;

  // Logged-in users: check if they're eligible to leave a review
  if (state.currentUser) {
    checkReviewEligibility(productId);
  }
}

async function checkReviewEligibility(productId) {
  const slot = document.getElementById('review-form-slot');
  if (!slot) return;

  try {
    const data = await window.ReviewsAPI.canReview(productId);
    if (!data.canReview) return; // not eligible — silently show nothing extra

    slot.innerHTML = `
      <div class="review-form">
        <div style="font-weight:700; font-size:13px; color:var(--navy); margin-bottom:8px;">Leave a review</div>
        <div class="star-picker" id="review-star-picker">
          ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}">★</button>`).join('')}
        </div>
        <textarea id="review-comment-input" placeholder="Share your experience with this product (optional)"></textarea>
        <button class="btn btn-primary" id="submit-review-btn" style="margin-top:10px; width:100%; justify-content:center;" disabled>Submit Review</button>
      </div>`;

    let selectedRating = 0;
    const stars = slot.querySelectorAll('.star-picker button');
    const submitBtn = document.getElementById('submit-review-btn');

    stars.forEach(star => {
      star.addEventListener('click', () => {
        selectedRating = Number(star.dataset.star);
        stars.forEach(s => s.classList.toggle('active', Number(s.dataset.star) <= selectedRating));
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      try {
        const comment = document.getElementById('review-comment-input').value.trim();
        await window.ReviewsAPI.submit({ productId, orderId: data.orderId, rating: selectedRating, comment });
        showToast('Thanks for your review!', 'success');
        loadProductReviews(productId); // reload to show the new review + remove the form
      } catch (err) {
        showToast(err.message || 'Could not submit review.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
      }
    });
  } catch {
    // not logged in eligibly, or request failed — fail silently, review form just won't show
  }
}

// ============================================================
// CHECKOUT
// ============================================================
function openCheckout() {
  if (cartTotalQty() === 0) return;
  const subtotal   = cartSubtotal();
  const delivery   = subtotal >= 499 ? 0 : 49;
  const total      = subtotal + delivery;
  const prefill    = state.currentUser?.name || '';
  const prefillEmail = state.currentUser?.email || '';

  document.getElementById('checkout-box').innerHTML = `
    <button class="modal-close" id="checkout-close">✕</button>
    <h3>Checkout</h3>
    <div class="sub">Total payable: <strong style="color:var(--navy);">${fmt(total)}</strong> · ${cartTotalQty()} item${cartTotalQty() > 1 ? 's' : ''}</div>
    ${!state.currentUser ? `<div style="background:var(--bg); border-radius:10px; padding:11px 14px; font-size:12.5px; color:var(--ink-soft); margin-bottom:18px;">Tip: <button id="checkout-login-prompt" style="color:var(--teal); font-weight:700; text-decoration:underline;">Log in</button> to save this order to your account.</div>` : ''}
    <form id="checkout-form">
      <div class="form-row">
        <div class="form-group"><label>Full Name</label><input type="text" id="checkout-name" required placeholder="Your name" value="${prefill}"></div>
        <div class="form-group"><label>Phone Number</label><input type="tel" id="checkout-phone" required placeholder="98765 43210" pattern="[0-9]{10}"></div>
      </div>
      <div class="form-group"><label>Delivery Address</label><textarea id="checkout-address" required rows="3" placeholder="House no, street, locality, city, PIN code"></textarea></div>
      <div class="form-group"><label>Payment Method</label>
        <select id="checkout-payment">
          <option>Cash on Delivery</option>
          <option>UPI</option>
          <option>Credit / Debit Card</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary" id="place-order-btn" style="width:100%; justify-content:center;">Place Order · ${fmt(total)}</button>
    </form>`;

  document.getElementById('checkout-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('checkout-close').addEventListener('click', closeCheckout);
  document.getElementById('checkout-login-prompt')?.addEventListener('click', () => { closeCheckout(); openAuthModal('login'); });
  document.getElementById('checkout-form').addEventListener('submit', (e) => { e.preventDefault(); placeOrder(); });
}

function closeCheckout() {
  document.getElementById('checkout-overlay').classList.remove('show');
  document.body.style.overflow = '';
}

async function placeOrder() {
  const name    = document.getElementById('checkout-name').value.trim();
  const phone   = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  const payment = document.getElementById('checkout-payment').value;
  const btn     = document.getElementById('place-order-btn');

  // Build items array for backend
  const items = Object.entries(state.cart).map(([productId, qty]) => ({ productId, qty }));

  const customerDetails = {
    customerName:  name,
    customerPhone: phone,
    customerEmail: state.currentUser?.email || null,
    address,
  };

  if (payment === 'Cash on Delivery') {
    await placeCodOrder(customerDetails, payment, items, btn);
  } else {
    await placeRazorpayOrder(customerDetails, payment, items, btn);
  }
}

// ── Cash on Delivery — unchanged flow, order saved directly ───
async function placeCodOrder(customerDetails, payment, items, btn) {
  btn.disabled    = true;
  btn.textContent = 'Placing order…';

  try {
    const data = await window.OrdersAPI.place({
      ...customerDetails,
      payment,
      items,
    });

    showOrderSuccess(data);
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = `Place Order · ${fmt(cartSubtotal() + (cartSubtotal() >= 499 ? 0 : 49))}`;
    showToast(err.message || 'Could not place order. Please try again.', 'error');
  }
}

// ── UPI / Card — real payment via Razorpay ─────────────────────
async function placeRazorpayOrder(customerDetails, payment, items, btn) {
  btn.disabled    = true;
  btn.textContent = 'Opening secure payment…';

  try {
    // 1. Ask backend to create a Razorpay order (amount verified server-side)
    const orderData = await window.PaymentAPI.createOrder(items);

    // 2. Open Razorpay's checkout popup
    const rzp = new Razorpay({
      key:      orderData.keyId,
      amount:   orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      name:     'AMAN MEDICAL',
      description: `Order for ${items.length} item${items.length > 1 ? 's' : ''}`,
      prefill: {
        name:    customerDetails.customerName,
        contact: customerDetails.customerPhone,
        email:   customerDetails.customerEmail || '',
      },
      theme: { color: '#0d6efd' },

      handler: async (response) => {
        // 3. Payment succeeded in the popup — verify signature & save order
        btn.textContent = 'Verifying payment…';
        try {
          const data = await window.PaymentAPI.verify({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            ...customerDetails,
            paymentMethod: payment,
            items,
          });

          showOrderSuccess(data);
        } catch (err) {
          btn.disabled    = false;
          btn.textContent = `Place Order · ${fmt(cartSubtotal() + (cartSubtotal() >= 499 ? 0 : 49))}`;
          showToast(err.message || 'Payment verification failed. Please contact support.', 'error');
        }
      },

      modal: {
        // User closed the popup without paying
        ondismiss: () => {
          btn.disabled    = false;
          btn.textContent = `Place Order · ${fmt(cartSubtotal() + (cartSubtotal() >= 499 ? 0 : 49))}`;
          showToast('Payment cancelled.', 'error');
        },
      },
    });

    rzp.open();

    // Reset button once popup is open (in case user cancels)
    btn.disabled    = false;
    btn.textContent = `Place Order · ${fmt(cartSubtotal() + (cartSubtotal() >= 499 ? 0 : 49))}`;
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = `Place Order · ${fmt(cartSubtotal() + (cartSubtotal() >= 499 ? 0 : 49))}`;
    showToast(err.message || 'Could not start payment. Please try again.', 'error');
  }
}

// ── Shared success UI + cart cleanup, used by both payment paths
function showOrderSuccess(data) {
  // Deduct stock locally so UI updates immediately
  for (const [productId, qty] of Object.entries(state.cart)) {
    const p = getProduct(productId);
    if (p) p.stock = Math.max(0, p.stock - qty);
  }

  document.getElementById('checkout-box').innerHTML = `
    <div class="success-box">
      <div class="success-icon">✓</div>
      <h3>Order placed successfully!</h3>
      <p class="sub">We've received your order and will confirm shortly.</p>
      <div class="order-id">Order ID: ${data.orderId}</div>
      <p style="font-size:13px; color:var(--ink-soft); margin:14px 0;">
        Pay ${fmt(data.total)} on delivery or via your chosen method.
        ${data.delivery === 0 ? ' · 🎉 Free delivery applied!' : ''}
      </p>
      <button class="btn btn-dark" id="order-done-btn" style="width:100%; justify-content:center;">Continue Shopping</button>
    </div>`;

  document.getElementById('order-done-btn').addEventListener('click', closeCheckout);

  state.cart = {};
  saveCart();
  updateCartCount();
  renderCartDrawer();
  renderProducts();
  closeDrawer();
}

// ============================================================
// ADMIN DASHBOARD
// ============================================================
let adminTab = 'stock';

async function openAdminDashboard() {
  adminTab = 'stock';
  await renderAdminDashboard();
  document.getElementById('admin-overlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeAdminDashboard() {
  document.getElementById('admin-overlay').classList.remove('show');
  document.body.style.overflow = '';
}
function logoutAdmin() {
  window.AuthAPI.logout();
  state.isAdmin = false;
  closeAdminDashboard();
  showToast('Logged out of admin dashboard.', 'info');
}

async function renderAdminDashboard() {
  document.getElementById('admin-box').innerHTML = `
    <div class="admin-head">
      <h3>🛡️ Admin Dashboard</h3>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn btn-ghost btn-sm" style="background:var(--bg); color:var(--ink); border-color:var(--line);" id="admin-logout-btn">Log Out</button>
        <button class="modal-close" id="admin-close" style="position:static;">✕</button>
      </div>
    </div>
    <div class="admin-tabs">
      <div class="admin-tab ${adminTab === 'stock' ? 'active' : ''}" data-tab="stock">Stock Management</div>
      <div class="admin-tab ${adminTab === 'orders' ? 'active' : ''}" data-tab="orders">Orders</div>
    </div>
    <div class="admin-body" id="admin-body"><div style="text-align:center; padding:40px; color:var(--ink-soft);">Loading…</div></div>`;

  document.getElementById('admin-close').addEventListener('click', closeAdminDashboard);
  document.getElementById('admin-logout-btn').addEventListener('click', logoutAdmin);
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', async () => { adminTab = tab.dataset.tab; await renderAdminDashboard(); });
  });

  const body = document.getElementById('admin-body');

  if (adminTab === 'stock') {
    try {
      const data     = await window.ProductsAPI.getAllAdmin();
      const products = data.products || [];
      const stats    = data.stats || {};

      body.innerHTML = `
        <div class="admin-stats">
          <div class="stat-box"><div class="stat-num">${stats.active || 0}</div><div class="stat-lbl">ACTIVE PRODUCTS</div></div>
          <div class="stat-box alert"><div class="stat-num">${stats.lowStock || 0}</div><div class="stat-lbl">LOW STOCK</div></div>
          <div class="stat-box alert"><div class="stat-num">${stats.outStock || 0}</div><div class="stat-lbl">OUT OF STOCK</div></div>
          <div class="stat-box"><div class="stat-num">${stats.total || 0}</div><div class="stat-lbl">TOTAL PRODUCTS</div></div>
        </div>
        <div style="display:flex; justify-content:flex-end; margin-bottom:14px;">
          <button class="btn btn-primary btn-sm" id="admin-add-btn">+ Add New Product</button>
        </div>
        <table class="admin-table">
          <thead><tr><th>Product</th><th>Category</th><th>Price (₹)</th><th>Stock</th><th>Status</th><th></th><th></th></tr></thead>
          <tbody>
            ${products.map(p => {
              const s = p.stock <= 0 ? 'out' : p.stock <= p.lowStockThreshold ? 'low' : 'in';
              const badgeClass = s === 'in' ? 'ok' : s;
              const badgeLabel = s === 'in' ? 'In Stock' : s === 'low' ? 'Low Stock' : 'Out of Stock';
              const inactive   = !p.isActive ? 'style="opacity:.5"' : '';
              return `
                <tr data-id="${p._id}" ${inactive}>
                  <td><div class="admin-prod-name"><span class="admin-prod-emoji" style="background:${p.bg || '#E9F0FB'};">${p.emoji || '💊'}</span>${p.name}${!p.isActive ? ' <em>(hidden)</em>' : ''}</div></td>
                  <td>${p.category}</td>
                  <td><input type="number" class="stock-input" value="${p.price}" data-price-input="${p._id}" min="0" style="width:80px;"></td>
                  <td><input type="number" class="stock-input" value="${p.stock}" data-stock-input="${p._id}" min="0"></td>
                  <td><span class="mini-badge ${badgeClass}">${badgeLabel}</span></td>
                  <td><button class="admin-save-btn" data-save="${p._id}">Save</button></td>
                  <td><button class="admin-delete-btn" data-delete="${p._id}" title="Remove">🗑️</button></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      // Add product button
      document.getElementById('admin-add-btn').addEventListener('click', openAddProductForm);

      // Save stock+price
      document.querySelectorAll('[data-stock-input], [data-price-input]').forEach(input => {
        input.addEventListener('input', () => {
          input.closest('tr').querySelector('[data-save]').classList.add('show');
        });
      });
      document.querySelectorAll('[data-save]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id  = btn.dataset.save;
          const row = btn.closest('tr');
          const stock = parseInt(row.querySelector('[data-stock-input]').value, 10);
          const price = parseFloat(row.querySelector('[data-price-input]').value);
          if (isNaN(stock) || isNaN(price)) { showToast('Enter valid values.', 'error'); return; }
          try {
            await window.ProductsAPI.update(id, { stock, price });
            // Update local state too
            const localP = getProduct(id);
            if (localP) { localP.stock = stock; localP.price = price; }
            await renderAdminDashboard();
            renderProducts();
            showToast('Product updated.', 'success');
          } catch (err) { showToast(err.message || 'Update failed.', 'error'); }
        });
      });

      // Delete (soft)
      document.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.delete;
          const p  = products.find(pr => pr._id === id);
          if (!p) return;
          if (!confirm(`Remove "${p.name}" from the catalog?`)) return;
          try {
            await window.ProductsAPI.delete(id);
            await loadProducts();
            await renderAdminDashboard();
            showToast(`"${p.name}" removed.`, 'info');
          } catch (err) { showToast(err.message || 'Delete failed.', 'error'); }
        });
      });

    } catch (err) {
      body.innerHTML = `<p style="color:var(--coral); padding:20px; text-align:center;">${err.message || 'Could not load products.'}</p>`;
    }

  } else {
    // Orders tab
    try {
      const data   = await window.OrdersAPI.getAll({ limit: 50 });
      const orders = data.orders || [];
      const stats  = data.stats  || {};

      if (orders.length === 0) {
        body.innerHTML = `<div class="empty-state"><div class="emoji">🧾</div><p style="font-weight:700; color:var(--ink);">No orders yet</p></div>`;
        return;
      }

      body.innerHTML = `
        <div class="admin-stats" style="margin-bottom:20px;">
          <div class="stat-box"><div class="stat-num">${stats.total || 0}</div><div class="stat-lbl">TOTAL ORDERS</div></div>
          <div class="stat-box alert"><div class="stat-num">${stats.placed || 0}</div><div class="stat-lbl">NEW / PLACED</div></div>
          <div class="stat-box"><div class="stat-num">${stats.dispatched || 0}</div><div class="stat-lbl">DISPATCHED</div></div>
          <div class="stat-box"><div class="stat-num">${stats.delivered || 0}</div><div class="stat-lbl">DELIVERED</div></div>
        </div>
        ${orders.map(o => `
          <div class="order-row-card admin-order-card">
            <div>
              <div class="oid">${o.orderId}</div>
              <div class="ometa">${o.customerName} · ${o.customerPhone} · ${new Date(o.createdAt).toLocaleString('en-IN', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
              <div class="oitems">${o.items.map(it => `${it.name} ×${it.qty}`).join(', ')}</div>
              <div class="oitems" style="margin-top:4px; color:var(--ink-soft);">📍 ${o.address}</div>
              <div style="margin-top:8px;">
                <select class="stock-input" data-status-order="${o._id}" style="width:auto; padding:5px 10px;">
                  ${['placed','confirmed','packed','dispatched','delivered','cancelled'].map(s =>
                    `<option ${o.status === s ? 'selected' : ''} value="${s}">${s}</option>`
                  ).join('')}
                </select>
              </div>
            </div>
            <div class="ototal">${fmt(o.total)}</div>
          </div>`).join('')}`;

      // Status update dropdowns
      document.querySelectorAll('[data-status-order]').forEach(select => {
        select.addEventListener('change', async () => {
          const orderId = select.dataset.statusOrder;
          try {
            await window.OrdersAPI.updateStatus(orderId, select.value);
            showToast(`Order status updated to "${select.value}".`, 'success');
          } catch (err) { showToast(err.message || 'Update failed.', 'error'); }
        });
      });

    } catch (err) {
      body.innerHTML = `<p style="color:var(--coral); padding:20px; text-align:center;">${err.message || 'Could not load orders.'}</p>`;
    }
  }
}

// ── Add product form ──────────────────────────────────────────
const EMOJI_CHOICES = ['💊','🧂','🩺','🌡️','🫁','🌬️','🩸','🍊','🌿','🐟','🦠','😷','🧴','🧤','🩹','🧷','🦵','👶','💉','🧬','🩻','🦷','👁️','🧪'];

function openAddProductForm() {
  document.getElementById('admin-box').insertAdjacentHTML('beforeend', `
    <div class="modal-overlay show" id="add-product-overlay" style="z-index:260;">
      <div class="modal-box" id="add-product-box" style="max-width:480px;">
        <button class="modal-close" id="add-product-close">✕</button>
        <h3>Add New Product</h3>
        <div class="sub">Fill in the details to list a new item in the catalog.</div>
        <form id="add-product-form">
          <div class="form-group"><label>Product Name</label><input type="text" id="np-name" required placeholder="e.g. Ibuprofen 400mg Tablets"></div>
          <div class="form-row">
            <div class="form-group"><label>Category</label>
              <select id="np-category" required>
                ${Object.keys(CATEGORY_META).map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>Unit / Pack Size</label><input type="text" id="np-unit" required placeholder="e.g. 10 tablets"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Price (₹)</label><input type="number" id="np-price" required min="0" placeholder="99"></div>
            <div class="form-group"><label>Opening Stock</label><input type="number" id="np-stock" required min="0" placeholder="50"></div>
          </div>
          <div class="form-group"><label>Manufacturer</label><input type="text" id="np-mfg" required placeholder="e.g. GenPharma Labs"></div>
          <div class="form-group"><label>Description</label><textarea id="np-desc" rows="2" placeholder="Short product description"></textarea></div>
          <div class="form-group">
            <label>Choose an Icon</label>
            <div id="emoji-picker" style="display:flex; flex-wrap:wrap; gap:8px; padding:10px; background:var(--bg); border-radius:10px; max-height:120px; overflow-y:auto;">
              ${EMOJI_CHOICES.map((e, i) => `<button type="button" class="emoji-choice ${i===0?'selected':''}" data-emoji="${e}" style="font-size:20px; width:38px; height:38px; border-radius:8px; background:${i===0?'#fff':'transparent'}; border:2px solid ${i===0?'var(--teal)':'transparent'};">${e}</button>`).join('')}
            </div>
            <input type="hidden" id="np-emoji" value="${EMOJI_CHOICES[0]}">
          </div>
          <div class="form-group" style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" id="np-rx" style="width:auto;">
            <label style="margin:0;">Requires prescription (RX)</label>
          </div>
          <button type="submit" id="add-product-submit" class="btn btn-primary" style="width:100%; justify-content:center;">Add Product to Catalog</button>
        </form>
      </div>
    </div>`);

  document.getElementById('add-product-close').addEventListener('click', closeAddProductForm);
  document.getElementById('add-product-overlay').addEventListener('click', (e) => { if (e.target.id === 'add-product-overlay') closeAddProductForm(); });
  document.querySelectorAll('.emoji-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-choice').forEach(b => { b.style.background = 'transparent'; b.style.borderColor = 'transparent'; });
      btn.style.background   = '#fff';
      btn.style.borderColor  = 'var(--teal)';
      document.getElementById('np-emoji').value = btn.dataset.emoji;
    });
  });

  document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('add-product-submit');
    submitBtn.disabled   = true;
    submitBtn.textContent = 'Adding…';

    const stock = parseInt(document.getElementById('np-stock').value, 10);
    const productData = {
      name:     document.getElementById('np-name').value.trim(),
      category: document.getElementById('np-category').value,
      unit:     document.getElementById('np-unit').value.trim(),
      price:    parseFloat(document.getElementById('np-price').value),
      stock,
      mfg:      document.getElementById('np-mfg').value.trim(),
      desc:     document.getElementById('np-desc').value.trim(),
      emoji:    document.getElementById('np-emoji').value,
      rx:       document.getElementById('np-rx').checked,
      tag:      'new',
      lowStockThreshold: Math.max(5, Math.round(stock * 0.2)),
    };

    try {
      await window.ProductsAPI.create(productData);
      closeAddProductForm();
      await loadProducts();
      await renderAdminDashboard();
      showToast(`"${productData.name}" added to catalog.`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not add product.', 'error');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Add Product to Catalog';
    }
  });
}
function closeAddProductForm() {
  document.getElementById('add-product-overlay')?.remove();
}

// ============================================================
// TESTIMONIALS
// ============================================================
function renderTestimonials() {
  document.getElementById('test-grid').innerHTML = TESTIMONIALS.map(t => `
    <div class="test-card">
      <div class="stars">★★★★★</div>
      <p>"${t.text}"</p>
      <div class="test-author">
        <div class="avatar" style="background:${t.color};">${t.initials}</div>
        <div><div class="name">${t.name}</div><div class="loc">${t.loc}</div></div>
      </div>
    </div>`).join('');
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============================================================
// SEARCH
// ============================================================
function initSearch() {
  const inputs = [document.getElementById('search-input'), document.getElementById('search-input-mobile')];
  inputs.forEach(input => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      inputs.forEach(i => { if (i !== e.target) i.value = e.target.value; });
      renderProducts();
      if (state.searchQuery) document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = 'info') {
  const wrap  = document.getElementById('toast-wrap');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '!' : 'ℹ';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// LOGO INJECTION
// ============================================================
function injectLogos() {
  if (!window.LOGO_TRANSPARENT) return;

  // Navbar & footer logos sit next to the "AMAN MEDICAL" text,
  // so use the icon-only mark there.
  ['navbar-logo', 'footer-logo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = window.LOGO_ICON || window.LOGO_TRANSPARENT;
  });

  // Hero visual is the standalone centerpiece — use the full lockup.
  const hero = document.getElementById('hero-logo');
  if (hero) hero.src = window.LOGO_TRANSPARENT;
}

// ============================================================
// EVENT WIRING
// ============================================================
function initEvents() {
  document.getElementById('cart-btn').addEventListener('click', openDrawer);
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('overlay').addEventListener('click', closeDrawer);
  document.getElementById('checkout-btn').addEventListener('click', openCheckout);
  document.getElementById('checkout-overlay').addEventListener('click', (e) => { if (e.target.id === 'checkout-overlay') closeCheckout(); });
  document.getElementById('pdp-overlay').addEventListener('click', (e) => { if (e.target.id === 'pdp-overlay') closePdp(); });
  document.getElementById('auth-overlay').addEventListener('click', (e) => { if (e.target.id === 'auth-overlay') closeAuthModal(); });
  document.getElementById('admin-overlay').addEventListener('click', (e) => { if (e.target.id === 'admin-overlay') closeAdminDashboard(); });

  document.getElementById('account-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleAccountDropdown(); });
  document.addEventListener('click', (e) => { if (!document.getElementById('account-wrap').contains(e.target)) closeAccountDropdown(); });

  document.getElementById('footer-admin-link').addEventListener('click', (e) => { e.preventDefault(); openAdminLogin(); });
  document.getElementById('mobile-account-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('mobile-menu').classList.remove('open');
    state.currentUser ? openMyOrders() : openAuthModal('login');
  });

  const hamburger  = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger.addEventListener('click', () => mobileMenu.classList.toggle('open'));
  mobileMenu.querySelectorAll('a').forEach(a => {
    if (a.id !== 'mobile-account-link') a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  document.getElementById('wishlist-btn').addEventListener('click', showWishlist);

  document.getElementById('newsletter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form  = e.target;
    const input = form.querySelector('input[type="email"]');
    const btn   = form.querySelector('button[type="submit"]');
    const email = input.value.trim();

    btn.disabled    = true;
    btn.textContent = 'Subscribing…';

    try {
      const data = await window.NewsletterAPI.subscribe(email);
      showToast(data.message || 'Subscribed! Watch your inbox for restock alerts.', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message || 'Could not subscribe. Please try again.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Subscribe';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer(); closeCheckout(); closePdp(); closeAuthModal(); closeAdminDashboard(); closeAccountDropdown();
    }
  });
}

// ============================================================
// INIT — entry point
// ============================================================
async function init() {
  injectLogos();
  renderMarquee();
  renderCatStrip();
  renderTestimonials();
  initSearch();
  initEvents();
  initScrollReveal();
  renderCartDrawer();
  updateCartCount();
  updateWishCount();

  // Restore session then load products in parallel
  await initSession();
  await loadProducts();
  renderCategoryShowcase();
}

document.addEventListener('DOMContentLoaded', init);
