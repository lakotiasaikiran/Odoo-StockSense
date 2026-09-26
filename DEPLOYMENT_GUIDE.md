# 🚀 StockSense — Complete Deployment Guide (100% Free, Zero 404 Errors)

---

## ❓ Why Did Vercel Give "Request Failed Error 404"?

StockSense is an **Enterprise Full-Stack Application** with three distinct layers:
1. **Frontend**: React + Vite + Framer Motion (Static Assets)
2. **Backend**: Express.js REST API (Node server on port 3001)
3. **Database**: PostgreSQL (Relational schema with 8 tables)

### What happened on Vercel:
When you connected your repository to Vercel, Vercel **only built the static frontend (`dist`)**. 
- It did **NOT** start your Express backend (`server/server.ts`).
- It did **NOT** connect to any PostgreSQL database (your local PostgreSQL on `localhost:5432` only exists on your computer).
- When the frontend tried to call `/api/health`, `/api/products`, or `/api/receipts`, Vercel looked for a static file named `/api/...` and returned **HTTP 404 Not Found**.

---

## 🏆 The Recommended Solution: Render.com (All-in-One, Free & Easiest)

On **Render.com**, you can host the **PostgreSQL Database** and the **Fullstack Web Service** together for free.
Your Express server will serve **both** the API (`/api/*`) and the built React frontend (`dist/`) on the same domain, meaning:
- ✅ **Zero 404 errors** on API calls
- ✅ **Zero CORS issues** (same domain)
- ✅ **One live URL** to submit (e.g., `https://stocksense-xyz.onrender.com`)
- ✅ **Live cloud PostgreSQL persistence**

---

## 📋 Step-by-Step Deployment on Render (5 Minutes)

### Step 1: Create a Free PostgreSQL Database on Render
1. Go to [render.com](https://render.com) and sign in with your GitHub account.
2. In the top navigation, click **New +** → **PostgreSQL**.
3. Fill in:
   - **Name**: `stocksense-db`
   - **Database**: `stocksense`
   - **User**: `stocksense_user`
   - **Region**: Choose closest (e.g., Singapore, Frankfurt, or Ohio)
   - **Plan**: Select **Free**
4. Click **Create Database**.
5. Once created (takes ~30 seconds), scroll down to **Connections** and copy the **Internal Database URL** (or **External Database URL**). It looks like:
   ```
   postgresql://stocksense_user:password@dpg-xxxxxx.render.com/stocksense
   ```

---

### Step 2: Initialize Database Tables & Seed Data

You have two easy ways to set up the tables on your new cloud database:

#### Method A: From your computer terminal (Fastest)
In your local project folder, open terminal and run:
```bash
# In Windows PowerShell:
$env:DATABASE_URL="your-render-external-database-url"
npm run db:init
```
*(This automatically runs `schema.sql` and inserts all demo products, locations, and users into your cloud database!)*

#### Method B: In pgAdmin
1. Open pgAdmin 4.
2. Right-click **Servers** → **Register** → **Server**.
3. Name: `Render Cloud DB`.
4. In **Connection** tab:
   - **Host name**: paste the host from Render (e.g., `dpg-xxxxxx.render.com`)
   - **Port**: `5432`
   - **Maintenance database**: `stocksense`
   - **Username**: `stocksense_user`
   - **Password**: your Render DB password
   - In **SSL** tab: select **Require**.
5. Connect, open the Query Tool, paste the contents of `schema.sql`, and click **Execute (F5)**.

---

### Step 3: Deploy the Web Service on Render
1. On Render Dashboard, click **New +** → **Web Service**.
2. Select **Build and deploy from a Git repository**.
3. Choose your repository: `lakotiasaikiran/Odoo-StockSense`.
4. Configure the service:
   - **Name**: `stocksense` (or `stocksense-enterprise`)
   - **Language / Runtime**: `Node`
   - **Branch**: `main`
   - **Region**: Same region as your database
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Plan**: Select **Free**

---

### Step 4: Add Environment Variables on Render
Scroll down to the **Environment Variables** section on the same page and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | *(Paste your Render Database URL from Step 1)* |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `stocksense-enterprise-secret-key-2026` |

Click **Create Web Service**.

---

### Step 5: Verification & Launch!
Render will:
1. Clone your repo
2. Run `npm install && npm run build` (builds React frontend into `dist/`)
3. Run `npm start` (`tsx server/server.ts`)
4. Connect to PostgreSQL and print:
   ```
   StockSense PostgreSQL Enterprise API listening on http://localhost:3001
   ```
5. Render assigns you a free public HTTPS URL:
   👉 **`https://your-app-name.onrender.com`**

Open that URL in your browser:
- The public landing page loads instantly.
- Click **Sign In** → **Fill Demo Admin** (`admin@stocksense.com` / `admin123`).
- Enter the dashboard. The **PostgreSQL Live** green pill indicates the cloud database is working perfectly!

---

## 🌐 Alternative: Deploying Frontend on Vercel + Backend on Render

If you strictly want the frontend on **Vercel** (`.vercel.app`):

1. **Deploy Backend on Render** using Steps 1–4 above. Note down your backend URL, e.g.:
   `https://stocksense-backend.onrender.com`
2. **Deploy Frontend on Vercel**:
   - Go to [vercel.com](https://vercel.com) → **New Project** → Select your repo.
   - Framework Preset: **Vite**
   - Root Directory: `./`
   - Under **Environment Variables**, add:
     - **Name**: `VITE_API_URL`
     - **Value**: `https://stocksense-backend.onrender.com` *(no trailing slash)*
   - Click **Deploy**.
3. Vercel will build the frontend, and our code in `src/api.ts` will route all API calls to your live Render backend!

---

## ✅ Checklist Before Submitting Demo Video or Link

- [ ] Database is initialized with tables (`schema.sql` or `npm run db:init`)
- [ ] Environment variable `DATABASE_URL` is set in the hosting dashboard
- [ ] `/api/health` returns `{"ok": true, "database": "connected"}`
- [ ] Receipts and Deliveries can be created and validated without error
