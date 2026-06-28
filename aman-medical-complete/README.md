# 🏥 AMAN MEDICAL — Full-Stack Setup Guide

Node.js + Express + MongoDB backend for the AMAN MEDICAL pharmacy website.

---

## 📁 Project Structure

```
aman-medical/
├── backend/                   ← Express API server
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js  ← Register, Login, Admin login, Wishlist
│   │   ├── productController.js ← Product CRUD + stock management
│   │   └── orderController.js ← Place order, My orders, Admin orders
│   ├── middleware/
│   │   ├── auth.js            ← JWT protect / adminOnly / optionalAuth
│   │   └── errorHandler.js    ← Centralised error responses
│   ├── models/
│   │   ├── User.js            ← Customer accounts (bcrypt passwords)
│   │   ├── Product.js         ← Product catalog
│   │   └── Order.js           ← Orders with embedded items
│   ├── routes/
│   │   ├── auth.js            ← /api/auth/*
│   │   ├── products.js        ← /api/products/*
│   │   └── orders.js          ← /api/orders/*
│   ├── utils/
│   │   └── seed.js            ← Seeds 20 products into MongoDB
│   ├── .env.example           ← Copy to .env and fill in values
│   ├── .gitignore
│   ├── package.json
│   └── server.js              ← Entry point
│
├── frontend/                  ← Static HTML/CSS/JS frontend
│   ├── index.html             ← Main page (loads api.js before app.js)
│   ├── styles.css             ← All styles (unchanged)
│   ├── logo.js                ← Base64 logo data
│   ├── api.js                 ← API client (AuthAPI, ProductsAPI, OrdersAPI)
│   └── app.js                 ← Store logic (backend-connected version)
│
├── render.yaml                ← Render.com deployment config
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+
- A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account  
  OR MongoDB installed locally

### 2. Backend setup

```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/aman_medical
JWT_SECRET=your_super_long_secret_at_least_32_chars
ADMIN_EMAIL=admin@amanmedical.in
ADMIN_PASSWORD=yourSecureAdminPassword
FRONTEND_ORIGIN=http://localhost:5500
NODE_ENV=development
PORT=5000
```

```bash
npm install          # install dependencies
npm run seed         # seed the 20 products into MongoDB
npm run dev          # start server with hot reload (nodemon)
```

Server runs at: **http://localhost:5000**  
Health check: **http://localhost:5000/health**

### 3. Frontend setup

Open `frontend/index.html` in a browser using **Live Server** (VS Code extension)  
or any static file server:

```bash
# Option A: VS Code Live Server (port 5500 by default)
# Option B: npx serve frontend
npx serve frontend -p 3000
```

> The frontend talks to the backend at `http://localhost:5000` by default.  
> To change this, set `window.API_BASE_URL` before loading `api.js`:
> ```html
> <script>window.API_BASE_URL = 'https://your-api.onrender.com/api';</script>
> ```

---

## 🚀 Deploy to Render.com (Free)

### Backend (API)

1. Push your code to a GitHub repository
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set **Root Directory** to `backend`
5. Set **Build Command**: `npm install`
6. Set **Start Command**: `npm start`
7. Add these **Environment Variables** in Render Dashboard:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Your Atlas connection string |
| `JWT_SECRET` | Long random secret |
| `JWT_EXPIRES_IN` | `7d` |
| `ADMIN_EMAIL` | `admin@amanmedical.in` |
| `ADMIN_PASSWORD` | Your admin password |
| `FRONTEND_ORIGIN` | Your frontend URL |

8. After deploy, copy the URL (e.g. `https://aman-medical-api.onrender.com`)
9. Seed your production database:
   ```bash
   # Set MONGO_URI to Atlas URI, then:
   cd backend && node utils/seed.js
   ```

### Frontend (Static Site)

Deploy the `frontend/` folder to **Netlify**, **Vercel**, or **GitHub Pages**.

Before deploying, set the API URL in `index.html`:
```html
<script>window.API_BASE_URL = 'https://aman-medical-api.onrender.com/api';</script>
```
Add this line **above** the `<script src="api.js">` tag.

---

## 📡 API Reference

### Base URL
- Local: `http://localhost:5000/api`
- Production: `https://your-app.onrender.com/api`

### Authentication

All protected routes require: `Authorization: Bearer <token>`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | Public | Create customer account |
| `POST` | `/auth/login` | Public | Customer login → returns JWT |
| `POST` | `/auth/admin-login` | Public | Admin login → returns JWT |
| `GET` | `/auth/me` | Customer | Get current user profile |
| `PUT` | `/auth/wishlist` | Customer | Toggle product in wishlist |

**Register body:**
```json
{ "name": "Ritu Sharma", "email": "ritu@example.com", "password": "mypassword" }
```

**Admin login body:**
```json
{ "email": "admin@amanmedical.in", "password": "yourAdminPassword" }
```

### Products

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/products` | Public | Get all active products |
| `GET` | `/products?category=Medicines` | Public | Filter by category |
| `GET` | `/products?search=paracetamol` | Public | Search products |
| `GET` | `/products/:id` | Public | Get single product |
| `GET` | `/products/admin/all` | Admin | All products incl. inactive |
| `POST` | `/products` | Admin | Create product |
| `PUT` | `/products/:id` | Admin | Update product fields |
| `PATCH` | `/products/:id/stock` | Admin | Update stock only |
| `DELETE` | `/products/:id` | Admin | Soft-delete product |

**Create product body:**
```json
{
  "name": "Ibuprofen 400mg",
  "category": "Medicines",
  "price": 55,
  "stock": 100,
  "unit": "10 tablets",
  "mfg": "GenPharma",
  "emoji": "💊",
  "rx": false
}
```

### Orders

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/orders` | Optional | Place order (guest or logged in) |
| `GET` | `/orders/my` | Customer | My order history |
| `GET` | `/orders` | Admin | All orders + stats |
| `GET` | `/orders/:id` | Admin | Single order detail |
| `PATCH` | `/orders/:id/status` | Admin | Update order status |

**Place order body:**
```json
{
  "customerName": "Ritu Sharma",
  "customerPhone": "9876543210",
  "address": "123 Main St, Firozabad, UP 283203",
  "payment": "Cash on Delivery",
  "items": [
    { "productId": "64abc123...", "qty": 2 },
    { "productId": "64def456...", "qty": 1 }
  ]
}
```

**Update order status body:**
```json
{ "status": "dispatched" }
```

Valid statuses: `placed` → `confirmed` → `packed` → `dispatched` → `delivered` | `cancelled`

---

## 🔒 Security Features

- Passwords hashed with **bcrypt** (12 salt rounds)
- **JWT tokens** expire in 7 days
- **Rate limiting**: 100 req/15min globally, 10 req/15min on auth routes
- **Helmet.js** security headers
- **CORS** restricted to your frontend origin
- Admin credentials stored in `.env`, never in database
- Soft-delete for products (data preserved)
- Stock validated before order is confirmed

---

## 🗄️ MongoDB Atlas (Free Tier Setup)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0 cluster** (512MB — plenty for this project)
3. Create a database user with password
4. Add your IP to Network Access (or use `0.0.0.0/0` for all IPs)
5. Click **Connect → Connect your application**
6. Copy the connection string and paste into `.env` as `MONGO_URI`
7. Replace `<password>` with your database user password

---

## 🌱 Re-seeding

```bash
# Clears all products and re-inserts all 20 from the original catalog
cd backend
node utils/seed.js
```

> ⚠️ This deletes ALL products. Don't run on production unless you want a fresh start.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| `CORS error` in browser | Set `FRONTEND_ORIGIN` in `.env` to match your frontend URL exactly |
| `MongoServerError: bad auth` | Check `MONGO_URI` — password may have special chars that need URL encoding |
| `401 Unauthorized` on admin routes | Make sure you're sending the admin JWT, not a customer JWT |
| Products not loading | Check the backend is running and `API_BASE_URL` in frontend is correct |
| Render app sleeping | Free tier sleeps after 15 min; first request takes ~30s to wake up |
