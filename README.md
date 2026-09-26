# StockSense — Enterprise Inventory Management System
> Built for the **Odoo x LPU Hackathon**

StockSense is an enterprise-grade inventory platform inspired by Odoo's double-entry stock movement logic. It provides real-time stock tracking, warehouse topology management, inbound receipts, outbound deliveries with stock availability validation, physical inventory adjustments, and a comprehensive audit trail.

---

## 🚀 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Vanilla CSS
- **Backend API**: Node.js, Express, TypeScript (via `tsx`)
- **Database**: PostgreSQL with atomic transactions and sequences
- **Data Persistence**: 100% real PostgreSQL database CRUD operations (no mock data)

---

## ✨ Features & Workflows

1. **Dashboard & KPI Command Center**:
   - Real-time `COUNT(*)` SQL aggregation for To Receive, To Deliver, Late Operations, Waiting Operations, and Completed Moves.
   - Live At-Risk Stock alerts for products below their reorder threshold.
   - Quick operations shortcuts and Warehouse Pulse chart.

2. **Product Master Data**:
   - Complete CRUD for inventory items (SKU, Name, Category, Unit of Measure, Cost per Unit, Reorder Point).
   - Real-time tracking of On-Hand stock and Free-to-Use stock.

3. **Warehouse & Location Hierarchy**:
   - Multi-warehouse configuration with customizable short codes.
   - Internal physical locations (racks, shelves, zones).
   - Virtual partner locations (`Vendor` for receipts, `Customer` for deliveries).

4. **Inbound Receipts (Goods In)**:
   - Auto-generated references (`WH/IN/0001`, `WH/IN/0002`) using atomic sequence counters.
   - Multi-item line builder.
   - Interactive workflow pipeline: `Draft > Ready > Done`.
   - **Validate** button atomically increases `on_hand_qty` in PostgreSQL within a transaction.
   - Print-ready Goods Receipt Voucher.

5. **Outbound Deliveries (Goods Out)**:
   - Auto-generated references (`WH/OUT/0001`, `WH/OUT/0002`).
   - Automated stock availability checks: if insufficient free stock, marks order as `WAITING`.
   - **Validate** button checks stock and deducts inventory upon dispatch.
   - Print-ready Delivery & Packing Slip.

6. **Stock Overview & Adjustments**:
   - Overview of On Hand, Reserved, and Free to Use stock.
   - Physical count adjustment modal to reconcile physical inventory into the database with audit moves.

7. **Move History & Audit Trail**:
   - Complete history of all completed and pending moves.
   - Color-coded Inbound (Green) and Outbound (Red) operations.
   - Filterable by operation type, status, and searchable by reference or contact.

---

## 🛠️ Setup & Running Locally

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) running on `localhost:5432`

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```env
PORT=3001
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=stocksense
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Initialize Database
Initialize the `stocksense` PostgreSQL database, create tables, and seed initial demo data:
```bash
npm run db:init
```

### 5. Start Development Servers
Runs both Express API on port `3001` and React Vite on port `5173`:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Architecture

```
├── server/
│   ├── db.ts                       # PostgreSQL pool connection
│   ├── initDb.ts                   # Schema creation & seeding script
│   ├── server.ts                   # Express REST API endpoints
│   └── services/
│       └── inventoryService.ts     # Core stock logic & sequence generator
├── src/
│   ├── api.ts                      # Centralized frontend API client
│   ├── types.ts                    # TypeScript data definitions
│   ├── main.tsx                    # Main App router and sidebar layout
│   ├── styles.css                  # Odoo purple enterprise styling
│   ├── components/                 # Toast, StatusBadge, MoveStatusTracker, PrintSlip
│   └── pages/                      # Dashboard, Products, Warehouses, Receipts, Deliveries, Stock, Moves
├── schema/
│   └── postgresql_schema.sql       # PostgreSQL DDL schema
└── package.json
```
