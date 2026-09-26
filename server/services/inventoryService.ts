import { pool, query } from '../db';

export interface ProductItem {
  id?: number;
  sku: string;
  name: string;
  category_id?: number | null;
  unit_of_measure?: string;
  cost_per_unit: number;
  reorder_point?: number;
  on_hand_qty?: number;
  free_to_use?: number;
}

export interface WarehouseItem {
  id?: number;
  name: string;
  short_code: string;
  address?: string;
}

export interface LocationItem {
  id?: number;
  warehouse_id: number;
  warehouse_name?: string;
  name: string;
  short_code: string;
  is_virtual?: boolean;
}

export interface MoveLineInput {
  product_id: number;
  quantity: number;
}

export interface StockMoveInput {
  warehouse_id?: number;
  move_type: 'receipt' | 'delivery' | 'internal' | 'adjustment';
  source_location_id: number;
  dest_location_id: number;
  contact?: string;
  scheduled_date: string;
  responsible_user_id?: number;
  lines: MoveLineInput[];
}

export class InventoryService {
  /**
   * Generates next reference sequence (e.g. WH/IN/0001 or WH/OUT/0001)
   */
  static async generateReference(warehouseId: number, moveType: string): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch warehouse short_code
      const whRes = await client.query('SELECT short_code FROM warehouses WHERE id = $1', [warehouseId]);
      if (whRes.rowCount === 0) {
        throw new Error(`Warehouse with ID ${warehouseId} not found.`);
      }
      const shortCode = whRes.rows[0].short_code.toUpperCase();

      let typeCode = 'IN';
      if (moveType === 'delivery') typeCode = 'OUT';
      else if (moveType === 'internal') typeCode = 'INT';
      else if (moveType === 'adjustment') typeCode = 'ADJ';

      // Ensure sequence record exists
      await client.query(`
        INSERT INTO move_sequences (warehouse_id, move_type, last_number)
        VALUES ($1, $2, 0)
        ON CONFLICT (warehouse_id, move_type) DO NOTHING
      `, [warehouseId, moveType]);

      // Increment sequence atomically
      const seqRes = await client.query(`
        UPDATE move_sequences
        SET last_number = last_number + 1
        WHERE warehouse_id = $1 AND move_type = $2
        RETURNING last_number
      `, [warehouseId, moveType]);

      const nextNum = seqRes.rows[0].last_number;
      await client.query('COMMIT');

      const padded = String(nextNum).padStart(4, '0');
      return `${shortCode}/${typeCode}/${padded}`;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Check stock availability at source location for lines
   */
  static async checkStockAvailability(sourceLocationId: number, lines: MoveLineInput[]) {
    let allAvailable = true;
    const shortages: { productId: number; productName: string; required: number; available: number }[] = [];

    for (const line of lines) {
      const qRes = await query(`
        SELECT p.name, COALESCE(sq.on_hand_qty, 0) as on_hand, COALESCE(sq.reserved_qty, 0) as reserved
        FROM products p
        LEFT JOIN stock_quants sq ON p.id = sq.product_id AND sq.location_id = $1
        WHERE p.id = $2
      `, [sourceLocationId, line.product_id]);

      const row = qRes.rows[0];
      const productName = row ? row.name : `Product #${line.product_id}`;
      const onHand = parseFloat(row?.on_hand || '0');
      const reserved = parseFloat(row?.reserved || '0');
      const free = onHand - reserved;

      if (free < line.quantity) {
        allAvailable = false;
        shortages.push({
          productId: line.product_id,
          productName,
          required: line.quantity,
          available: free,
        });
      }
    }

    return { allAvailable, shortages };
  }

  /**
   * Create a move with lines (Receipt or Delivery or Transfer)
   */
  static async createMove(input: StockMoveInput) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Determine warehouse ID from location if not provided
      let warehouseId = input.warehouse_id;
      if (!warehouseId) {
        const locId = input.move_type === 'receipt' ? input.dest_location_id : input.source_location_id;
        const locRes = await client.query('SELECT warehouse_id FROM locations WHERE id = $1', [locId]);
        if (locRes.rowCount && locRes.rows[0].warehouse_id) {
          warehouseId = locRes.rows[0].warehouse_id;
        } else {
          const firstWh = await client.query('SELECT id FROM warehouses LIMIT 1');
          warehouseId = firstWh.rows[0]?.id || 1;
        }
      }

      // Generate reference
      const reference = await this.generateReference(warehouseId, input.move_type);

      // Determine initial status:
      // For deliveries or internal moves, check if stock is available
      let initialStatus = 'draft';
      if (input.move_type === 'delivery' || input.move_type === 'internal') {
        const check = await this.checkStockAvailability(input.source_location_id, input.lines);
        initialStatus = check.allAvailable ? 'ready' : 'waiting';
      } else {
        // Receipts start as ready or draft (can be validated)
        initialStatus = 'ready';
      }

      // Insert stock move
      const moveRes = await client.query(`
        INSERT INTO stock_moves (
          reference, move_type, source_location_id, dest_location_id,
          contact, scheduled_date, responsible_user_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        reference,
        input.move_type,
        input.source_location_id,
        input.dest_location_id,
        input.contact || null,
        input.scheduled_date,
        input.responsible_user_id || null,
        initialStatus
      ]);

      const move = moveRes.rows[0];

      // Insert lines
      for (const line of input.lines) {
        await client.query(`
          INSERT INTO stock_move_lines (move_id, product_id, quantity)
          VALUES ($1, $2, $3)
        `, [move.id, line.product_id, line.quantity]);
      }

      await client.query('COMMIT');
      return move;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validate a move:
   * Receipts: increases dest_location on_hand_qty
   * Deliveries: verifies stock, decreases source_location on_hand_qty
   * Internal: decreases source_location, increases dest_location
   * Adjustment: sets on_hand_qty directly
   */
  static async validateMove(moveId: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const moveRes = await client.query('SELECT * FROM stock_moves WHERE id = $1 FOR UPDATE', [moveId]);
      if (moveRes.rowCount === 0) {
        throw new Error(`Move #${moveId} not found.`);
      }
      const move = moveRes.rows[0];

      if (move.status === 'done') {
        throw new Error(`Move "${move.reference}" is already validated.`);
      }
      if (move.status === 'cancelled') {
        throw new Error(`Move "${move.reference}" is cancelled and cannot be validated.`);
      }

      // Fetch move lines
      const linesRes = await client.query(`
        SELECT sml.product_id, sml.quantity, p.name as product_name
        FROM stock_move_lines sml
        JOIN products p ON sml.product_id = p.id
        WHERE sml.move_id = $1
      `, [moveId]);

      if (linesRes.rowCount === 0) {
        throw new Error(`Move "${move.reference}" has no product lines to validate.`);
      }

      // Specific validation per type
      if (move.move_type === 'receipt') {
        // Increase stock at destination location
        for (const line of linesRes.rows) {
          await client.query(`
            INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (product_id, location_id)
            DO UPDATE SET on_hand_qty = stock_quants.on_hand_qty + $3
          `, [line.product_id, move.dest_location_id, line.quantity]);
        }
      } else if (move.move_type === 'delivery') {
        // Check stock availability first
        for (const line of linesRes.rows) {
          const qRes = await client.query(`
            SELECT on_hand_qty, reserved_qty
            FROM stock_quants
            WHERE product_id = $1 AND location_id = $2
            FOR UPDATE
          `, [line.product_id, move.source_location_id]);

          const onHand = parseFloat(qRes.rows[0]?.on_hand_qty || '0');
          const reserved = parseFloat(qRes.rows[0]?.reserved_qty || '0');
          const free = onHand - reserved;

          if (free < parseFloat(line.quantity)) {
            // Mark status as waiting
            await client.query(`UPDATE stock_moves SET status = 'waiting' WHERE id = $1`, [moveId]);
            await client.query('COMMIT');
            throw new Error(`Insufficient stock for "${line.product_name}". Required: ${line.quantity}, Available: ${free}. Marked as Waiting.`);
          }
        }

        // If sufficient, decrease stock
        for (const line of linesRes.rows) {
          await client.query(`
            UPDATE stock_quants
            SET on_hand_qty = on_hand_qty - $3
            WHERE product_id = $1 AND location_id = $2
          `, [line.product_id, move.source_location_id, line.quantity]);
        }
      } else if (move.move_type === 'internal') {
        // Internal transfer: decrease source, increase dest
        for (const line of linesRes.rows) {
          const qRes = await client.query(`
            SELECT on_hand_qty, reserved_qty
            FROM stock_quants
            WHERE product_id = $1 AND location_id = $2
            FOR UPDATE
          `, [line.product_id, move.source_location_id]);

          const onHand = parseFloat(qRes.rows[0]?.on_hand_qty || '0');
          const reserved = parseFloat(qRes.rows[0]?.reserved_qty || '0');
          const free = onHand - reserved;

          if (free < parseFloat(line.quantity)) {
            await client.query(`UPDATE stock_moves SET status = 'waiting' WHERE id = $1`, [moveId]);
            await client.query('COMMIT');
            throw new Error(`Insufficient stock for "${line.product_name}" in source location. Required: ${line.quantity}, Available: ${free}.`);
          }
        }

        for (const line of linesRes.rows) {
          // Decrease source
          await client.query(`
            UPDATE stock_quants
            SET on_hand_qty = on_hand_qty - $3
            WHERE product_id = $1 AND location_id = $2
          `, [line.product_id, move.source_location_id, line.quantity]);

          // Increase destination
          await client.query(`
            INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (product_id, location_id)
            DO UPDATE SET on_hand_qty = stock_quants.on_hand_qty + $3
          `, [line.product_id, move.dest_location_id, line.quantity]);
        }
      } else if (move.move_type === 'adjustment') {
        // Adjustment sets on_hand_qty directly
        for (const line of linesRes.rows) {
          await client.query(`
            INSERT INTO stock_quants (product_id, location_id, on_hand_qty, reserved_qty)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (product_id, location_id)
            DO UPDATE SET on_hand_qty = $3
          `, [line.product_id, move.dest_location_id, line.quantity]);
        }
      }

      // Mark move as done
      const updateRes = await client.query(`
        UPDATE stock_moves
        SET status = 'done', validated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [moveId]);

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a move
   */
  static async cancelMove(moveId: number) {
    const res = await query(`
      UPDATE stock_moves
      SET status = 'cancelled'
      WHERE id = $1 AND status != 'done'
      RETURNING *
    `, [moveId]);

    if (res.rowCount === 0) {
      throw new Error(`Move #${moveId} cannot be cancelled (might already be completed or not exist).`);
    }
    return res.rows[0];
  }

  /**
   * Dashboard KPI statistics using real COUNT(*) queries
   */
  static async getDashboardStats() {
    const statsQuery = await query(`
      SELECT
        -- Receipts to receive
        COUNT(*) FILTER (WHERE move_type = 'receipt' AND status != 'done' AND status != 'cancelled') AS "toReceive",
        COUNT(*) FILTER (WHERE move_type = 'receipt' AND status != 'done' AND status != 'cancelled' AND scheduled_date < CURRENT_DATE) AS "toReceiveLate",
        COUNT(*) FILTER (WHERE move_type = 'receipt' AND status != 'done' AND status != 'cancelled' AND scheduled_date >= CURRENT_DATE) AS "toReceiveOps",
        
        -- Deliveries to deliver
        COUNT(*) FILTER (WHERE move_type = 'delivery' AND status != 'done' AND status != 'cancelled') AS "toDeliver",
        COUNT(*) FILTER (WHERE move_type = 'delivery' AND status != 'done' AND status != 'cancelled' AND scheduled_date < CURRENT_DATE) AS "toDeliverLate",
        COUNT(*) FILTER (WHERE move_type = 'delivery' AND status = 'waiting') AS "toDeliverWaiting",
        COUNT(*) FILTER (WHERE move_type = 'delivery' AND status != 'done' AND status != 'cancelled' AND scheduled_date >= CURRENT_DATE) AS "toDeliverOps",
        
        -- Internal transfers
        COUNT(*) FILTER (WHERE move_type = 'internal' AND status != 'done' AND status != 'cancelled') AS "internalTransfers",
        
        -- Completed moves
        COUNT(*) FILTER (WHERE status = 'done') AS "completedMoves",
        
        -- Total moves
        COUNT(*) AS "totalMoves"
      FROM stock_moves
    `);

    const row = statsQuery.rows[0];
    return {
      toReceive: parseInt(row.toReceive || '0', 10),
      toReceiveLate: parseInt(row.toReceiveLate || '0', 10),
      toReceiveOps: parseInt(row.toReceiveOps || '0', 10),

      toDeliver: parseInt(row.toDeliver || '0', 10),
      toDeliverLate: parseInt(row.toDeliverLate || '0', 10),
      toDeliverWaiting: parseInt(row.toDeliverWaiting || '0', 10),
      toDeliverOps: parseInt(row.toDeliverOps || '0', 10),

      internalTransfers: parseInt(row.internalTransfers || '0', 10),
      completedMoves: parseInt(row.completedMoves || '0', 10),
      totalMoves: parseInt(row.totalMoves || '0', 10)
    };
  }

  /**
   * Low stock alerts
   */
  static async getLowStock() {
    const res = await query(`
      SELECT 
        p.id as product_id,
        p.sku,
        p.name as product_name,
        l.name as location_name,
        COALESCE(sq.on_hand_qty, 0) as on_hand_qty,
        COALESCE(sq.reserved_qty, 0) as reserved_qty,
        (COALESCE(sq.on_hand_qty, 0) - COALESCE(sq.reserved_qty, 0)) as free_to_use,
        p.reorder_point
      FROM products p
      CROSS JOIN locations l
      LEFT JOIN stock_quants sq ON p.id = sq.product_id AND l.id = sq.location_id
      WHERE l.is_virtual = false
        AND (COALESCE(sq.on_hand_qty, 0) - COALESCE(sq.reserved_qty, 0)) <= p.reorder_point
      ORDER BY free_to_use ASC
    `);

    return res.rows.map(r => ({
      productId: r.product_id,
      sku: r.sku,
      productName: r.product_name,
      locationName: r.location_name,
      onHandQty: parseFloat(r.on_hand_qty),
      reservedQty: parseFloat(r.reserved_qty),
      freeToUse: parseFloat(r.free_to_use),
      reorderPoint: parseFloat(r.reorder_point)
    }));
  }

  /**
   * Stock overview per product across locations
   */
  static async getStockOverview() {
    const res = await query(`
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.unit_of_measure,
        p.cost_per_unit,
        p.reorder_point,
        COALESCE(SUM(sq.on_hand_qty), 0) as on_hand_qty,
        COALESCE(SUM(sq.reserved_qty), 0) as reserved_qty,
        (COALESCE(SUM(sq.on_hand_qty), 0) - COALESCE(SUM(sq.reserved_qty), 0)) as free_to_use
      FROM products p
      LEFT JOIN stock_quants sq ON p.id = sq.product_id
      LEFT JOIN locations l ON sq.location_id = l.id AND l.is_virtual = false
      GROUP BY p.id, p.sku, p.name, p.unit_of_measure, p.cost_per_unit, p.reorder_point
      ORDER BY p.name ASC
    `);

    return res.rows.map(r => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      unitOfMeasure: r.unit_of_measure,
      costPerUnit: parseFloat(r.cost_per_unit),
      reorderPoint: parseFloat(r.reorder_point),
      onHandQty: parseFloat(r.on_hand_qty),
      reservedQty: parseFloat(r.reserved_qty),
      freeToUse: parseFloat(r.free_to_use)
    }));
  }
}
