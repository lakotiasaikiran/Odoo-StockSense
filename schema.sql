-- StockSense — Inventory Management System
-- Schema follows the wireframe's flow: Warehouses > Locations > Stock,
-- with Receipts/Deliveries/Internal Transfers modeled as one "stock_moves"
-- entity (source location -> destination location), same as real Odoo.
-- This keeps Move History, the Dashboard counts, and stock updates all
-- driven by ONE table instead of three duplicated ones.

-- ── USERS ────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(30)  NOT NULL DEFAULT 'staff', -- 'manager' | 'staff'
    otp_code      VARCHAR(6),        -- for password-reset OTP flow
    otp_expires_at TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ── WAREHOUSES & LOCATIONS ──────────────────────────────────────────
CREATE TABLE warehouses (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    short_code VARCHAR(10)  UNIQUE NOT NULL,   -- e.g. "WH"
    address    TEXT
);

-- Locations include real racks/floors AND two virtual ones per warehouse:
-- "Vendor" (source for receipts) and "Customer" (destination for deliveries).
-- This is what lets receipts/deliveries/transfers share one moves table.
CREATE TABLE locations (
    id            SERIAL PRIMARY KEY,
    warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id),
    name          VARCHAR(100) NOT NULL,        -- e.g. "Rack A", "Vendor", "Customer"
    short_code    VARCHAR(10)  NOT NULL,
    is_virtual    BOOLEAN NOT NULL DEFAULT false, -- true for Vendor/Customer
    UNIQUE (warehouse_id, short_code)
);

-- ── PRODUCTS ─────────────────────────────────────────────────────────
CREATE TABLE product_categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE products (
    id             SERIAL PRIMARY KEY,
    sku            VARCHAR(50) UNIQUE NOT NULL,
    name           VARCHAR(150) NOT NULL,
    category_id    INTEGER REFERENCES product_categories(id),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'unit',
    cost_per_unit  NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_point  NUMERIC(12,2) DEFAULT 0,      -- triggers "low stock" alert
    created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- ── STOCK (current quantities per product per location) ─────────────
-- "Free to Use" from the wireframe = on_hand_qty - reserved_qty
CREATE TABLE stock_quants (
    id           SERIAL PRIMARY KEY,
    product_id   INTEGER NOT NULL REFERENCES products(id),
    location_id  INTEGER NOT NULL REFERENCES locations(id),
    on_hand_qty  NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    UNIQUE (product_id, location_id)
);

-- ── STOCK MOVES (Receipts, Deliveries, Internal Transfers, Adjustments) ──
CREATE TYPE move_type_enum AS ENUM ('receipt', 'delivery', 'internal', 'adjustment');
CREATE TYPE move_status_enum AS ENUM ('draft', 'waiting', 'ready', 'done', 'cancelled');

CREATE TABLE stock_moves (
    id                 SERIAL PRIMARY KEY,
    reference          VARCHAR(30) UNIQUE NOT NULL,  -- e.g. "WH/IN/0001"
    move_type          move_type_enum NOT NULL,
    source_location_id INTEGER REFERENCES locations(id),  -- Vendor for receipts
    dest_location_id   INTEGER REFERENCES locations(id),  -- Customer for deliveries
    contact            VARCHAR(120),                 -- vendor/customer name
    scheduled_date     DATE NOT NULL,
    responsible_user_id INTEGER REFERENCES users(id) DEFAULT NULL,
    status             move_status_enum NOT NULL DEFAULT 'draft',
    validated_at       TIMESTAMP,
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_moves_status ON stock_moves(status);
CREATE INDEX idx_moves_scheduled_date ON stock_moves(scheduled_date);

-- Line items per move (a receipt/delivery can carry multiple products)
CREATE TABLE stock_move_lines (
    id         SERIAL PRIMARY KEY,
    move_id    INTEGER NOT NULL REFERENCES stock_moves(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   NUMERIC(14,3) NOT NULL
);

-- ── REFERENCE NUMBER COUNTERS (per warehouse + move type) ────────────
-- Generates "WH/IN/0001", "WH/OUT/0001" as in the wireframe.
CREATE TABLE move_sequences (
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    move_type    move_type_enum NOT NULL,
    last_number  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (warehouse_id, move_type)
);

-- ── BUSINESS RULES TO IMPLEMENT IN THE APPLICATION LAYER ─────────────
-- 1. On move validation ("Validate" button):
--      receipt   -> increase stock_quants.on_hand_qty at dest_location
--      delivery  -> decrease stock_quants.on_hand_qty at source_location
--      internal  -> decrease at source_location, increase at dest_location
--      adjustment-> set on_hand_qty directly to the counted value, log delta
--    Then set stock_moves.status = 'done' and validated_at = now().
--
-- 2. Status logic (matches the wireframe's notes):
--      'waiting'  -> a delivery/internal move whose product lacks enough
--                    free_to_use stock at the source location
--      'ready'    -> stock is available, move can be validated
--      'late'     -> NOT a stored status; compute in the UI as
--                    (scheduled_date < CURRENT_DATE AND status != 'done')
--
-- 3. Dashboard KPIs (Receipts "to receive", Deliveries "to deliver", etc.)
--    are simple COUNT(*) queries on stock_moves filtered by move_type + status.
--
-- 4. Low stock alert: on_hand_qty - reserved_qty <= products.reorder_point
