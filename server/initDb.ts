import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const host = process.env.POSTGRES_HOST || 'localhost';
const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const dbName = process.env.POSTGRES_DB || 'stocksense';
const user = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || '';

async function initDatabase() {
  console.log(`Connecting to Postgres at ${host}:${port} as ${user}...`);

  // Step 1: Ensure database exists
  const rootClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres'
  });

  await rootClient.connect();
  const dbCheck = await rootClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName]
  );

  if (dbCheck.rowCount === 0) {
    console.log(`Database "${dbName}" does not exist. Creating it now...`);
    await rootClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Database "${dbName}" created successfully.`);
  } else {
    console.log(`Database "${dbName}" already exists.`);
  }
  await rootClient.end();

  // Step 2: Connect to stocksense database and run schema
  const appClient = new Client({
    host,
    port,
    user,
    password,
    database: dbName
  });

  await appClient.connect();
  console.log(`Connected to database "${dbName}". Creating schema tables...`);

  await appClient.query(`
    -- USERS
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

    -- WAREHOUSES
    CREATE TABLE IF NOT EXISTS warehouses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      short_code VARCHAR(10) UNIQUE NOT NULL,
      address TEXT
    );

    -- LOCATIONS
    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      short_code VARCHAR(10) NOT NULL,
      is_virtual BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (warehouse_id, short_code)
    );

    -- PRODUCT CATEGORIES
    CREATE TABLE IF NOT EXISTS product_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    );

    -- PRODUCTS
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      sku VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
      unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'unit',
      cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
      reorder_point NUMERIC(12,2) DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- STOCK QUANTS (Current quantities per product per location)
    CREATE TABLE IF NOT EXISTS stock_quants (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      on_hand_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
      reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
      UNIQUE (product_id, location_id)
    );

    -- STOCK MOVES
    CREATE TABLE IF NOT EXISTS stock_moves (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(30) UNIQUE NOT NULL,
      move_type VARCHAR(20) NOT NULL, -- 'receipt' | 'delivery' | 'internal' | 'adjustment'
      source_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      dest_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
      contact VARCHAR(120),
      scheduled_date DATE NOT NULL,
      responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft' | 'waiting' | 'ready' | 'done' | 'cancelled'
      validated_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- STOCK MOVE LINES
    CREATE TABLE IF NOT EXISTS stock_move_lines (
      id SERIAL PRIMARY KEY,
      move_id INTEGER NOT NULL REFERENCES stock_moves(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity NUMERIC(14,3) NOT NULL
    );

    -- MOVE SEQUENCES
    CREATE TABLE IF NOT EXISTS move_sequences (
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      move_type VARCHAR(20) NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (warehouse_id, move_type)
    );

    CREATE INDEX IF NOT EXISTS idx_moves_status ON stock_moves(status);
    CREATE INDEX IF NOT EXISTS idx_moves_scheduled_date ON stock_moves(scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_moves_type ON stock_moves(move_type);
  `);

  console.log('Tables created or verified.');

  // Step 3: Seed default data if empty
  const whRes = await appClient.query('SELECT count(*) FROM warehouses');
  if (parseInt(whRes.rows[0].count, 10) === 0) {
    console.log('Seeding initial warehouse, locations, and sequences...');
    const whInsert = await appClient.query(`
      INSERT INTO warehouses (name, short_code, address)
      VALUES ('Main Warehouse', 'WH', '123 Central Avenue, Logistics City')
      RETURNING id
    `);
    const whId = whInsert.rows[0].id;

    // Insert locations for warehouse
    const locVnd = await appClient.query(`
      INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
      VALUES ($1, 'Vendor', 'VND', true)
      RETURNING id
    `, [whId]);

    const locCus = await appClient.query(`
      INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
      VALUES ($1, 'Customer', 'CUS', true)
      RETURNING id
    `, [whId]);

    const locStock = await appClient.query(`
      INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
      VALUES ($1, 'WH/Stock1', 'STOCK1', false)
      RETURNING id
    `, [whId]);

    await appClient.query(`
      INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
      VALUES ($1, 'Rack A', 'RA', false), ($1, 'Rack B', 'RB', false)
    `, [whId]);

    // Initialize sequences
    await appClient.query(`
      INSERT INTO move_sequences (warehouse_id, move_type, last_number)
      VALUES 
        ($1, 'receipt', 0),
        ($1, 'delivery', 0),
        ($1, 'internal', 0),
        ($1, 'adjustment', 0)
    `, [whId]);

    // Categories
    const catInsert = await appClient.query(`
      INSERT INTO product_categories (name)
      VALUES ('Office Furniture'), ('Electronics')
      RETURNING id
    `);
    const catId = catInsert.rows[0].id;

    // Products (matches the wireframe: Desk, Table)
    const pDesk = await appClient.query(`
      INSERT INTO products (sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point)
      VALUES ('DESK-01', 'Desk', $1, 'unit', 3000.00, 10.0)
      RETURNING id
    `, [catId]);

    const pTable = await appClient.query(`
      INSERT INTO products (sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point)
      VALUES ('TABL-01', 'Table', $1, 'unit', 3000.00, 5.0)
      RETURNING id
    `, [catId]);

    const pChair = await appClient.query(`
      INSERT INTO products (sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point)
      VALUES ('CHAIR-01', 'Office Chair', $1, 'unit', 1500.00, 15.0)
      RETURNING id
    `, [catId]);

    // Initial stock quants: Desk (50 on hand, 5 reserved), Table (50 on hand, 0 reserved)
    await appClient.query(`
      INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
      VALUES 
        ($1, $2, 50, 5),
        ($3, $2, 50, 0),
        ($4, $2, 20, 0)
    `, [pDesk.rows[0].id, locStock.rows[0].id, pTable.rows[0].id, pChair.rows[0].id]);

    // Demo admin user
    await appClient.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Mitchell Admin', 'admin@stocksense.com', 'hash_admin123', 'manager')
    `);

    // Demo seed receipts / deliveries for immediate visualization
    // 1 completed receipt: WH/IN/0001
    const m1 = await appClient.query(`
      INSERT INTO stock_moves (reference, move_type, source_location_id, dest_location_id, contact, scheduled_date, status, validated_at)
      VALUES ('WH/IN/0001', 'receipt', $1, $2, 'Azure Interior', CURRENT_DATE - 2, 'done', NOW() - INTERVAL '2 days')
      RETURNING id
    `, [locVnd.rows[0].id, locStock.rows[0].id]);

    await appClient.query(`
      INSERT INTO stock_move_lines (move_id, product_id, quantity)
      VALUES ($1, $2, 50)
    `, [m1.rows[0].id, pDesk.rows[0].id]);

    // Update sequence to 1
    await appClient.query(`
      UPDATE move_sequences SET last_number = 1 WHERE warehouse_id = $1 AND move_type = 'receipt'
    `, [whId]);

    // 1 draft/ready receipt: WH/IN/0002
    const m2 = await appClient.query(`
      INSERT INTO stock_moves (reference, move_type, source_location_id, dest_location_id, contact, scheduled_date, status)
      VALUES ('WH/IN/0002', 'receipt', $1, $2, 'Deco Addict', CURRENT_DATE + 1, 'ready')
      RETURNING id
    `, [locVnd.rows[0].id, locStock.rows[0].id]);

    await appClient.query(`
      INSERT INTO stock_move_lines (move_id, product_id, quantity)
      VALUES ($1, $2, 25)
    `, [m2.rows[0].id, pTable.rows[0].id]);

    await appClient.query(`
      UPDATE move_sequences SET last_number = 2 WHERE warehouse_id = $1 AND move_type = 'receipt'
    `, [whId]);

    // 1 ready delivery: WH/OUT/0001
    const m3 = await appClient.query(`
      INSERT INTO stock_moves (reference, move_type, source_location_id, dest_location_id, contact, scheduled_date, status)
      VALUES ('WH/OUT/0001', 'delivery', $1, $2, 'Azure Interior', CURRENT_DATE + 2, 'ready')
      RETURNING id
    `, [locStock.rows[0].id, locCus.rows[0].id]);

    await appClient.query(`
      INSERT INTO stock_move_lines (move_id, product_id, quantity)
      VALUES ($1, $2, 6)
    `, [m3.rows[0].id, pDesk.rows[0].id]);

    await appClient.query(`
      UPDATE move_sequences SET last_number = 1 WHERE warehouse_id = $1 AND move_type = 'delivery'
    `, [whId]);

    console.log('Default data seeded successfully!');
  } else {
    console.log('Database already has warehouses. Skipping initial seeding.');
  }

  await appClient.end();
  console.log('Database initialization complete.');
}

initDatabase().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
