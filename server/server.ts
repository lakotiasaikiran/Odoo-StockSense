import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, query, testConnection } from './db';
import { InventoryService } from './services/inventoryService';

const app = express();
const PORT = process.env.PORT || 3001;
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const JWT_SECRET = process.env.JWT_SECRET || 'stocksense-enterprise-secret-key-2026';

app.use(cors());
app.use(express.json());

// Ensure demo admin password hash is bcrypt
query(`
  UPDATE users 
  SET password_hash = '$2b$10$sUWglcn4zlZnuFQXBT3xG.bkG.iK2rI417WEFFocWb.hB2cuY4rkK' 
  WHERE email = 'admin@stocksense.com' AND (password_hash = 'hash_admin123' OR password_hash NOT LIKE '$2%')
`).catch(() => {});

// ─────────────────────────────────────────────────────────────
// 1. Database Connection & Health
// ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_, res: Response) => {
  const dbHealth = await testConnection();
  if (dbHealth.ok) {
    res.json({
      ok: true,
      service: 'StockSense Enterprise API',
      database: 'connected',
      time: dbHealth.time,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      ok: false,
      service: 'StockSense Enterprise API',
      database: 'disconnected',
      error: dbHealth.error,
      timestamp: new Date().toISOString()
    });
  }
});

// ─────────────────────────────────────────────────────────────
// AUTHENTICATION & OTP VERIFICATION
// ─────────────────────────────────────────────────────────────
// Signup: Hashes password, generates 6-digit OTP, stores in DB
app.post('/api/auth/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = $1', [emailNorm]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    // Generate 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const insertRes = await query(`
      INSERT INTO users (name, email, password_hash, role, otp_code, otp_expires_at)
      VALUES ($1, $2, $3, 'staff', $4, NOW() + INTERVAL '15 minutes')
      RETURNING id, name, email, role, otp_code
    `, [name.trim(), emailNorm, passwordHash, otpCode]);

    const newUser = insertRes.rows[0];

    res.status(201).json({
      ok: true,
      message: `Account created! Verification code: ${otpCode}`,
      email: newUser.email,
      otpCode: newUser.otp_code // Displayed in UI toast / demo mode for easy verification
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to sign up.' });
  }
});

// Verify OTP: Confirms code and returns JWT token + user profile
app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp_code } = req.body;

    if (!email?.trim() || !otp_code?.trim()) {
      return res.status(400).json({ error: 'Email and 6-digit OTP code are required.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const userRes = await query(`
      SELECT id, name, email, role, otp_code, otp_expires_at
      FROM users
      WHERE LOWER(email) = $1
    `, [emailNorm]);

    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userRes.rows[0];

    if (!user.otp_code || user.otp_code !== otp_code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    if (user.otp_expires_at && new Date(user.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    // Clear OTP upon successful verification
    await query(`
      UPDATE users
      SET otp_code = NULL, otp_expires_at = NULL
      WHERE id = $1
    `, [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      message: 'Email successfully verified! Welcome to StockSense.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTP verification failed.' });
  }
});

// Resend OTP
app.post('/api/auth/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    const updateRes = await query(`
      UPDATE users
      SET otp_code = $1, otp_expires_at = NOW() + INTERVAL '15 minutes'
      WHERE LOWER(email) = $2
      RETURNING id, name, email, otp_code
    `, [otpCode, emailNorm]);

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    res.json({
      ok: true,
      message: `New verification code generated: ${otpCode}`,
      otpCode
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resend OTP.' });
  }
});

// Login: Validates password, issues JWT, checks OTP state
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const emailNorm = email.trim().toLowerCase();
    const userRes = await query(`
      SELECT id, name, email, password_hash, role, otp_code, otp_expires_at
      FROM users
      WHERE LOWER(email) = $1
    `, [emailNorm]);

    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Check bcrypt hash or seeded fallback
    let isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch && user.password_hash === 'hash_admin123' && password === 'admin123') {
      isMatch = true;
      // Upgrade hash
      const newHash = await bcrypt.hash('admin123', 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id]);
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if account has an unverified OTP
    if (user.otp_code && user.otp_expires_at && new Date(user.otp_expires_at) > new Date()) {
      return res.json({
        ok: false,
        requireOtp: true,
        email: user.email,
        message: 'Account requires email OTP verification.',
        otpCode: user.otp_code
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      ok: true,
      message: 'Signed in successfully.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// Me: Validates JWT token
app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization token.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);

    const userRes = await query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    res.json({ ok: true, user: userRes.rows[0] });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ─────────────────────────────────────────────────────────────
// 2. Products & Categories CRUD
// ─────────────────────────────────────────────────────────────
app.get('/api/categories', async (_, res: Response) => {
  try {
    const result = await query('SELECT * FROM product_categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = await query(
      'INSERT INTO product_categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (_, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.category_id,
        c.name AS category_name,
        p.unit_of_measure,
        p.cost_per_unit,
        p.reorder_point,
        p.created_at,
        COALESCE(SUM(sq.on_hand_qty), 0) AS on_hand_qty,
        COALESCE(SUM(sq.reserved_qty), 0) AS reserved_qty,
        (COALESCE(SUM(sq.on_hand_qty), 0) - COALESCE(SUM(sq.reserved_qty), 0)) AS free_to_use
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      LEFT JOIN stock_quants sq ON p.id = sq.product_id
      LEFT JOIN locations l ON sq.location_id = l.id AND l.is_virtual = false
      GROUP BY p.id, p.sku, p.name, p.category_id, c.name, p.unit_of_measure, p.cost_per_unit, p.reorder_point, p.created_at
      ORDER BY p.id DESC
    `);
    res.json(result.rows.map(r => ({
      ...r,
      cost_per_unit: parseFloat(r.cost_per_unit),
      reorder_point: parseFloat(r.reorder_point || '0'),
      on_hand_qty: parseFloat(r.on_hand_qty),
      reserved_qty: parseFloat(r.reserved_qty),
      free_to_use: parseFloat(r.free_to_use)
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point, initial_stock, location_id } = req.body;

    if (!sku?.trim() || !name?.trim()) {
      return res.status(400).json({ error: 'SKU and product name are required.' });
    }

    const check = await query('SELECT id FROM products WHERE sku = $1', [sku.trim()]);
    if (check.rowCount && check.rowCount > 0) {
      return res.status(400).json({ error: `Product with SKU "${sku}" already exists.` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertRes = await client.query(`
        INSERT INTO products (sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        sku.trim().toUpperCase(),
        name.trim(),
        category_id ? parseInt(category_id, 10) : null,
        unit_of_measure?.trim() || 'unit',
        parseFloat(cost_per_unit) || 0,
        parseFloat(reorder_point) || 0
      ]);

      const newProduct = insertRes.rows[0];

      // If initial stock provided, seed quant
      const stockQty = parseFloat(initial_stock || '0');
      if (stockQty > 0) {
        let locId = location_id ? parseInt(location_id, 10) : null;
        if (!locId) {
          const defaultLoc = await client.query('SELECT id FROM locations WHERE is_virtual = false LIMIT 1');
          locId = defaultLoc.rows[0]?.id;
        }
        if (locId) {
          await client.query(`
            INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
            VALUES ($1, $2, $3, 0)
          `, [newProduct.id, locId, stockQty]);
        }
      }

      await client.query('COMMIT');
      res.status(201).json(newProduct);
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { sku, name, category_id, unit_of_measure, cost_per_unit, reorder_point } = req.body;

    if (!name?.trim() || !sku?.trim()) {
      return res.status(400).json({ error: 'Product name and SKU are required.' });
    }

    const result = await query(`
      UPDATE products
      SET sku = $1, name = $2, category_id = $3, unit_of_measure = $4, cost_per_unit = $5, reorder_point = $6
      WHERE id = $7
      RETURNING *
    `, [
      sku.trim().toUpperCase(),
      name.trim(),
      category_id ? parseInt(category_id, 10) : null,
      unit_of_measure?.trim() || 'unit',
      parseFloat(cost_per_unit) || 0,
      parseFloat(reorder_point) || 0,
      id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Product #${id} not found.` });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true, message: `Product #${id} deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 3. Warehouses & Locations CRUD
// ─────────────────────────────────────────────────────────────
app.get('/api/warehouses', async (_, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        w.*,
        COUNT(l.id) FILTER (WHERE l.is_virtual = false) as internal_location_count,
        COUNT(l.id) as total_location_count
      FROM warehouses w
      LEFT JOIN locations l ON w.id = l.warehouse_id
      GROUP BY w.id
      ORDER BY w.id ASC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/warehouses', async (req: Request, res: Response) => {
  try {
    const { name, short_code, address } = req.body;
    if (!name?.trim() || !short_code?.trim()) {
      return res.status(400).json({ error: 'Warehouse name and short code are required.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const whRes = await client.query(`
        INSERT INTO warehouses (name, short_code, address)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name.trim(), short_code.trim().toUpperCase(), address?.trim() || '']);

      const wh = whRes.rows[0];

      // Auto-create default locations for this warehouse
      await client.query(`
        INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
        VALUES 
          ($1, 'Vendor', 'VND', true),
          ($1, 'Customer', 'CUS', true),
          ($1, '${wh.short_code}/Stock1', 'STOCK1', false)
      `, [wh.id]);

      // Initialize sequence counters
      await client.query(`
        INSERT INTO move_sequences (warehouse_id, move_type, last_number)
        VALUES 
          ($1, 'receipt', 0),
          ($1, 'delivery', 0),
          ($1, 'internal', 0),
          ($1, 'adjustment', 0)
      `, [wh.id]);

      await client.query('COMMIT');
      res.status(201).json(wh);
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/warehouses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, short_code, address } = req.body;
    if (!name?.trim() || !short_code?.trim()) {
      return res.status(400).json({ error: 'Warehouse name and short code are required.' });
    }

    const result = await query(`
      UPDATE warehouses
      SET name = $1, short_code = $2, address = $3
      WHERE id = $4
      RETURNING *
    `, [name.trim(), short_code.trim().toUpperCase(), address?.trim() || '', id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Warehouse #${id} not found.` });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/warehouses/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM warehouses WHERE id = $1', [id]);
    res.json({ ok: true, message: `Warehouse #${id} deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/locations', async (req: Request, res: Response) => {
  try {
    const { warehouse_id, is_virtual } = req.query;
    let sql = `
      SELECT l.*, w.name as warehouse_name, w.short_code as warehouse_code
      FROM locations l
      JOIN warehouses w ON l.warehouse_id = w.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id) {
      params.push(warehouse_id);
      sql += ` AND l.warehouse_id = $${params.length}`;
    }
    if (is_virtual !== undefined) {
      params.push(is_virtual === 'true');
      sql += ` AND l.is_virtual = $${params.length}`;
    }
    sql += ` ORDER BY l.is_virtual ASC, l.name ASC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/locations', async (req: Request, res: Response) => {
  try {
    const { warehouse_id, name, short_code, is_virtual } = req.body;
    if (!warehouse_id || !name?.trim() || !short_code?.trim()) {
      return res.status(400).json({ error: 'Warehouse, location name, and short code are required.' });
    }

    const result = await query(`
      INSERT INTO locations (warehouse_id, name, short_code, is_virtual)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [parseInt(warehouse_id, 10), name.trim(), short_code.trim().toUpperCase(), !!is_virtual]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/locations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, short_code, is_virtual } = req.body;
    if (!name?.trim() || !short_code?.trim()) {
      return res.status(400).json({ error: 'Location name and short code are required.' });
    }

    const result = await query(`
      UPDATE locations
      SET name = $1, short_code = $2, is_virtual = $3
      WHERE id = $4
      RETURNING *
    `, [name.trim(), short_code.trim().toUpperCase(), !!is_virtual, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Location #${id} not found.` });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/locations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    await query('DELETE FROM locations WHERE id = $1', [id]);
    res.json({ ok: true, message: `Location #${id} deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 4. Receipts & Deliveries & Move Management
// ─────────────────────────────────────────────────────────────
// Helper function to fetch moves with line details
async function getMovesByType(moveType: string) {
  const result = await query(`
    SELECT 
      sm.id,
      sm.reference,
      sm.move_type,
      sm.source_location_id,
      sl.name AS source_location_name,
      sm.dest_location_id,
      dl.name AS dest_location_name,
      sm.contact,
      TO_CHAR(sm.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
      sm.responsible_user_id,
      u.name AS responsible_name,
      sm.status,
      sm.validated_at,
      sm.created_at,
      COALESCE(
        json_agg(
          json_build_object(
            'id', sml.id,
            'product_id', p.id,
            'product_sku', p.sku,
            'product_name', p.name,
            'unit_of_measure', p.unit_of_measure,
            'quantity', sml.quantity
          )
        ) FILTER (WHERE sml.id IS NOT NULL), '[]'
      ) AS lines
    FROM stock_moves sm
    LEFT JOIN locations sl ON sm.source_location_id = sl.id
    LEFT JOIN locations dl ON sm.dest_location_id = dl.id
    LEFT JOIN users u ON sm.responsible_user_id = u.id
    LEFT JOIN stock_move_lines sml ON sm.id = sml.move_id
    LEFT JOIN products p ON sml.product_id = p.id
    WHERE sm.move_type = $1
    GROUP BY sm.id, sl.name, dl.name, u.name
    ORDER BY sm.id DESC
  `, [moveType]);

  return result.rows;
}

// Receipts List
app.get('/api/receipts', async (_, res: Response) => {
  try {
    const rows = await getMovesByType('receipt');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Receipt (in 'draft' or 'ready' status, auto-generating reference e.g. WH/IN/0001)
app.post('/api/receipts', async (req: Request, res: Response) => {
  try {
    const { warehouse_id, source_location_id, dest_location_id, contact, scheduled_date, responsible_user_id, lines } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one product line is required.' });
    }

    // Default source is Vendor virtual location if not specified
    let srcId = source_location_id ? parseInt(source_location_id, 10) : null;
    let dstId = dest_location_id ? parseInt(dest_location_id, 10) : null;

    if (!srcId) {
      const vendorLoc = await query("SELECT id FROM locations WHERE short_code = 'VND' OR is_virtual = true LIMIT 1");
      srcId = vendorLoc.rows[0]?.id;
    }
    if (!dstId) {
      const stockLoc = await query("SELECT id FROM locations WHERE is_virtual = false LIMIT 1");
      dstId = stockLoc.rows[0]?.id;
    }

    if (!dstId) {
      return res.status(400).json({ error: 'Destination warehouse stock location is required.' });
    }

    const move = await InventoryService.createMove({
      warehouse_id: warehouse_id ? parseInt(warehouse_id, 10) : undefined,
      move_type: 'receipt',
      source_location_id: srcId,
      dest_location_id: dstId,
      contact: contact?.trim() || 'Vendor',
      scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
      responsible_user_id: responsible_user_id ? parseInt(responsible_user_id, 10) : undefined,
      lines: lines.map((l: any) => ({
        product_id: parseInt(l.product_id, 10),
        quantity: parseFloat(l.quantity) || 1
      }))
    });

    res.status(201).json(move);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate Receipt (increases stock, marks done)
app.patch('/api/receipts/:id/validate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedMove = await InventoryService.validateMove(id);
    res.json({
      ok: true,
      message: `Receipt ${updatedMove.reference} validated successfully. Stock on hand updated!`,
      move: updatedMove
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel Receipt
app.patch('/api/receipts/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const move = await InventoryService.cancelMove(id);
    res.json({ ok: true, message: `Receipt ${move.reference} cancelled.`, move });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Deliveries List
app.get('/api/deliveries', async (_, res: Response) => {
  try {
    const rows = await getMovesByType('delivery');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Delivery (in 'draft' or 'waiting' or 'ready', auto-generating reference e.g. WH/OUT/0001)
app.post('/api/deliveries', async (req: Request, res: Response) => {
  try {
    const { warehouse_id, source_location_id, dest_location_id, contact, scheduled_date, responsible_user_id, lines } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one product line is required.' });
    }

    let srcId = source_location_id ? parseInt(source_location_id, 10) : null;
    let dstId = dest_location_id ? parseInt(dest_location_id, 10) : null;

    if (!srcId) {
      const stockLoc = await query("SELECT id FROM locations WHERE is_virtual = false LIMIT 1");
      srcId = stockLoc.rows[0]?.id;
    }
    if (!dstId) {
      const customerLoc = await query("SELECT id FROM locations WHERE short_code = 'CUS' OR is_virtual = true LIMIT 1");
      dstId = customerLoc.rows[0]?.id;
    }

    if (!srcId) {
      return res.status(400).json({ error: 'Source warehouse stock location is required.' });
    }

    const move = await InventoryService.createMove({
      warehouse_id: warehouse_id ? parseInt(warehouse_id, 10) : undefined,
      move_type: 'delivery',
      source_location_id: srcId,
      dest_location_id: dstId,
      contact: contact?.trim() || 'Customer',
      scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
      responsible_user_id: responsible_user_id ? parseInt(responsible_user_id, 10) : undefined,
      lines: lines.map((l: any) => ({
        product_id: parseInt(l.product_id, 10),
        quantity: parseFloat(l.quantity) || 1
      }))
    });

    res.status(201).json(move);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate Delivery (checks stock, decreases on_hand_qty, marks done)
app.patch('/api/deliveries/:id/validate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedMove = await InventoryService.validateMove(id);
    res.json({
      ok: true,
      message: `Delivery ${updatedMove.reference} validated successfully. Stock on hand deducted!`,
      move: updatedMove
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Cancel Delivery
app.patch('/api/deliveries/:id/cancel', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const move = await InventoryService.cancelMove(id);
    res.json({ ok: true, message: `Delivery ${move.reference} cancelled.`, move });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Generic move validator for internal transfers or adjustments
app.patch('/api/moves/:id/validate', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updatedMove = await InventoryService.validateMove(id);
    res.json({
      ok: true,
      message: `Move ${updatedMove.reference} validated successfully!`,
      move: updatedMove
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 5. Dashboard KPIs (Real COUNT queries against stock_moves)
// ─────────────────────────────────────────────────────────────
app.get('/api/dashboard', async (_, res: Response) => {
  try {
    const stats = await InventoryService.getDashboardStats();
    const lowStock = await InventoryService.getLowStock();

    // Fetch recent moves
    const recentMoves = await query(`
      SELECT 
        sm.id,
        sm.reference,
        sm.move_type,
        sm.contact,
        sm.status,
        TO_CHAR(sm.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        sm.created_at,
        sl.name AS source_location,
        dl.name AS dest_location
      FROM stock_moves sm
      LEFT JOIN locations sl ON sm.source_location_id = sl.id
      LEFT JOIN locations dl ON sm.dest_location_id = dl.id
      ORDER BY sm.id DESC
      LIMIT 8
    `);

    res.json({
      dashboard: stats,
      lowStock,
      moves: recentMoves.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 6. Move History (Real data from stock_moves)
// ─────────────────────────────────────────────────────────────
app.get('/api/moves', async (req: Request, res: Response) => {
  try {
    const { status, type, search } = req.query;

    let sql = `
      SELECT 
        sm.id,
        sm.reference,
        sm.move_type,
        sm.source_location_id,
        sl.name AS source_location_name,
        sm.dest_location_id,
        dl.name AS dest_location_name,
        sm.contact,
        TO_CHAR(sm.scheduled_date, 'YYYY-MM-DD') AS scheduled_date,
        sm.status,
        sm.validated_at,
        sm.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'product_id', p.id,
              'product_sku', p.sku,
              'product_name', p.name,
              'quantity', sml.quantity
            )
          ) FILTER (WHERE sml.id IS NOT NULL), '[]'
        ) AS lines
      FROM stock_moves sm
      LEFT JOIN locations sl ON sm.source_location_id = sl.id
      LEFT JOIN locations dl ON sm.dest_location_id = dl.id
      LEFT JOIN stock_move_lines sml ON sm.id = sml.move_id
      LEFT JOIN products p ON sml.product_id = p.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND sm.status = $${params.length}`;
    }

    if (type && type !== 'all') {
      params.push(type);
      sql += ` AND sm.move_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (sm.reference ILIKE $${params.length} OR sm.contact ILIKE $${params.length})`;
    }

    sql += `
      GROUP BY sm.id, sl.name, dl.name
      ORDER BY sm.id DESC
    `;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 7. Stock Overview (per wireframe Stock page)
// ─────────────────────────────────────────────────────────────
app.get('/api/stock', async (_, res: Response) => {
  try {
    const items = await InventoryService.getStockOverview();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stock Adjustment (Directly set quantity)
app.post('/api/adjustments', async (req: Request, res: Response) => {
  try {
    const { product_id, location_id, new_quantity, reason } = req.body;
    if (!product_id || !location_id || new_quantity === undefined) {
      return res.status(400).json({ error: 'Product, location, and new quantity are required.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const locRes = await client.query('SELECT warehouse_id FROM locations WHERE id = $1', [location_id]);
      const whId = locRes.rows[0]?.warehouse_id || 1;
      const ref = await InventoryService.generateReference(whId, 'adjustment');

      // Create move
      const moveRes = await client.query(`
        INSERT INTO stock_moves (reference, move_type, dest_location_id, contact, scheduled_date, status, validated_at)
        VALUES ($1, 'adjustment', $2, $3, CURRENT_DATE, 'done', NOW())
        RETURNING *
      `, [ref, location_id, reason || 'Physical Inventory Count']);

      const move = moveRes.rows[0];

      await client.query(`
        INSERT INTO stock_move_lines (move_id, product_id, quantity)
        VALUES ($1, $2, $3)
      `, [move.id, product_id, parseFloat(new_quantity)]);

      // Update quant
      await client.query(`
        INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET on_hand_qty = $3
      `, [product_id, location_id, parseFloat(new_quantity)]);

      await client.query('COMMIT');
      res.status(201).json({ ok: true, move, message: `Stock adjusted to ${new_quantity}.` });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Users
app.get('/api/users', async (_, res: Response) => {
  try {
    const result = await query('SELECT id, name, email, role FROM users ORDER BY name ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST));
  app.get('*', (_, res: Response) => {
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`StockSense PostgreSQL Enterprise API listening on http://localhost:${PORT}`);
});
