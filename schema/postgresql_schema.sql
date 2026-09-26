-- PostgreSQL-compatible schema for StockSense
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'staff',
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    address TEXT
);

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(10) NOT NULL,
    is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (warehouse_id, short_code)
);

CREATE TABLE IF NOT EXISTS product_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category_id INTEGER REFERENCES product_categories(id),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'unit',
    cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_quants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    location_id INTEGER NOT NULL REFERENCES locations(id),
    on_hand_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    UNIQUE (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS stock_moves (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(30) UNIQUE NOT NULL,
    move_type VARCHAR(20) NOT NULL,
    source_location_id INTEGER REFERENCES locations(id),
    dest_location_id INTEGER REFERENCES locations(id),
    contact VARCHAR(120),
    scheduled_date DATE NOT NULL,
    responsible_user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    validated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_move_lines (
    id SERIAL PRIMARY KEY,
    move_id INTEGER NOT NULL REFERENCES stock_moves(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity NUMERIC(14,3) NOT NULL
);

CREATE TABLE IF NOT EXISTS move_sequences (
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
    move_type VARCHAR(20) NOT NULL,
    last_number INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (warehouse_id, move_type)
);
