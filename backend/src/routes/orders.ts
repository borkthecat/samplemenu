import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { validateVenueToken } from '../utils/tokenValidator';

const router = Router();
const VALID_VENUE_IDS = ['001', '002', '003'];

const WP_API_URL = process.env.WP_API_URL || '';

async function getMenuItemsForOrders(ids: number[]): Promise<Record<number, { title: string; imageUrl: string | null }>> {
  if (ids.length === 0) return {};
  if (WP_API_URL) {
    const axios = require('axios');
    const https = require('https');
    const headers: any = { 'Accept': 'application/json' };
    if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
    }
    const agent = WP_API_URL.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;
    const cache: Record<number, { title: string; imageUrl: string | null }> = {};
    await Promise.all(ids.map(async (menuItemId) => {
      try {
        const r = await axios.get(`${WP_API_URL}/wp/v2/menu_item/${menuItemId}`, {
          headers,
          timeout: 5000,
          ...(agent ? { httpsAgent: agent } : {})
        });
        const t = r.data?.title?.rendered || r.data?.title || `Item #${menuItemId}`;
        let img: string | null = null;
        if (r.data?._embedded?.['wp:featuredmedia']?.[0]) {
          const m = r.data._embedded['wp:featuredmedia'][0];
          img = m.source_url || m.media_details?.sizes?.large?.source_url || null;
        }
        cache[menuItemId] = { title: t, imageUrl: img };
      } catch {
        cache[menuItemId] = { title: `Item #${menuItemId}`, imageUrl: null };
      }
    }));
    return cache;
  }
  const result = await pool.query(
    'SELECT id, wp_id, name, image_url FROM menu_items WHERE id = ANY($1::int[]) OR wp_id = ANY($1::int[])',
    [ids]
  );
  const cache: Record<number, { title: string; imageUrl: string | null }> = {};
  for (const row of result.rows) {
    const t = row.name || `Item #${row.id}`;
    if (row.wp_id) cache[row.wp_id] = { title: t, imageUrl: row.image_url };
    cache[row.id] = { title: t, imageUrl: row.image_url };
  }
  for (const id of ids) {
    if (!cache[id]) cache[id] = { title: `Item #${id}`, imageUrl: null };
  }
  return cache;
}

// POST /api/orders
router.post('/', async (req: Request, res: Response) => {
  try {
    const { venue_id, table_number, phone_number, customer_name, items, token } = req.body;

    // Validation
    if (!table_number || !items || items.length === 0) {
      return res.status(400).json({ 
        error: 'table_number and items are required' 
      });
    }

    let validatedVenueId: string | null = null;

    // Security: Validate token if provided (secure method)
    if (token) {
      validatedVenueId = validateVenueToken(token);
      if (!validatedVenueId) {
        return res.status(403).json({ error: 'Invalid or tampered token' });
      }
    }
    // Fallback: Validate venue_id (for development/testing)
    else if (venue_id) {
      if (!VALID_VENUE_IDS.includes(venue_id)) {
        return res.status(403).json({ error: 'Invalid venue ID. Use token for secure access.' });
      }
      validatedVenueId = venue_id;
    }
    else {
      return res.status(400).json({ error: 'token or venue_id is required' });
    }

    // Use validated venue ID (from token or validated venue_id)
    const finalVenueId = validatedVenueId;

    if (WP_API_URL) {
      try {
        const axios = require('axios');
        const r = await axios.get(`${WP_API_URL}/curo/v1/venue/${finalVenueId}/settings`, { timeout: 5000 });
        const s = r.data;
        if (s?.require_customer_name && !customer_name) return res.status(400).json({ error: 'Customer name is required for this venue' });
        if (s?.require_phone_number && !phone_number) return res.status(400).json({ error: 'Phone number is required for this venue' });
      } catch {
        const venueResult = await pool.query('SELECT require_customer_name, require_phone_number FROM venues WHERE id = $1', [finalVenueId]);
        if (venueResult.rows.length > 0) {
          const v = venueResult.rows[0];
          if (v.require_customer_name && !customer_name) return res.status(400).json({ error: 'Customer name is required for this venue' });
          if (v.require_phone_number && !phone_number) return res.status(400).json({ error: 'Phone number is required for this venue' });
        }
      }
    } else {
      const venueResult = await pool.query('SELECT require_customer_name, require_phone_number FROM venues WHERE id = $1', [finalVenueId]);
      if (venueResult.rows.length > 0) {
        const v = venueResult.rows[0];
        if (v.require_customer_name && !customer_name) return res.status(400).json({ error: 'Customer name is required for this venue' });
        if (v.require_phone_number && !phone_number) return res.status(400).json({ error: 'Phone number is required for this venue' });
      }
    }

    // Get database connection with timeout protection
    let client;
    try {
      client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 5000)
        )
      ]) as any;
    } catch (error: any) {
      return res.status(503).json({ 
        error: 'Database unavailable',
        message: 'Cannot connect to database. Please try again later.'
      });
    }

    try {
      await client.query('BEGIN');

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Calculate subtotal - batch price lookups if needed to prevent N+1 queries
      const itemsNeedingPrice = items.filter((item: any) => !item.price);
      
      // Batch fetch prices if any items are missing prices
      let priceMap: { [key: number]: number } = {};
      if (itemsNeedingPrice.length > 0) {
        const menuItemIds = itemsNeedingPrice.map((item: any) => item.menu_item_id);
        const priceResult = await client.query(
          'SELECT id, wp_id, price FROM menu_items WHERE id = ANY($1::int[]) OR wp_id = ANY($1::int[])',
          [menuItemIds]
        );
        priceMap = priceResult.rows.reduce((acc: any, row: any) => {
          const p = parseFloat(row.price);
          acc[row.id] = p;
          if (row.wp_id) acc[row.wp_id] = p;
          return acc;
        }, {});
      }

      // Calculate subtotal using prices (before GST)
      let subtotal = 0;
      for (const item of items) {
        let itemPrice = item.price || priceMap[item.menu_item_id];
        if (!itemPrice) {
          throw new Error(`Menu item ${item.menu_item_id} not found and no price provided`);
        }
        subtotal += itemPrice * item.quantity;
      }

      // Calculate GST (9% of subtotal)
      const GST_RATE = 0.09;
      const gstAmount = subtotal * GST_RATE;
      
      // Total amount includes GST
      const totalAmount = subtotal + gstAmount;

      // Create order using validated venue ID (from token)
      // Orders start as PREPARING (goes to KDS immediately) with payment_status UNPAID
      // Waiters will mark payment_status as PAID in WordPress (doesn't affect KDS)
      // total_amount includes GST (9%)
      const orderResult = await client.query(
        `INSERT INTO orders (order_number, venue_id, table_number, phone_number, customer_name, status, payment_status, total_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [orderNumber, finalVenueId, table_number, phone_number || null, customer_name || null, 'PREPARING', 'UNPAID', totalAmount]
      );

      const order = orderResult.rows[0];

      // Batch insert order items (more efficient than individual inserts)
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price: item.price || priceMap[item.menu_item_id] || 0,
        subtotal: (item.price || priceMap[item.menu_item_id] || 0) * item.quantity,
        doneness: item.doneness || null
      }));

      // Use batch insert with VALUES clause for better performance
      if (orderItems.length > 0) {
        const values = orderItems.map((_: any, index: number) => {
          const base = index * 6;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
        }).join(', ');
        
        const params = orderItems.flatMap((item: any) => [
          item.order_id,
          item.menu_item_id,
          item.quantity,
          item.price,
          item.subtotal,
          item.doneness
        ]);

        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, price, subtotal, doneness)
           VALUES ${values}`,
          params
        );
      }

      await client.query('COMMIT');

      // Get full order with items
      const fullOrderResult = await client.query(
        `SELECT o.*, 
                json_agg(
                  json_build_object(
                    'id', oi.id,
                    'menu_item_id', oi.menu_item_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'subtotal', oi.subtotal,
                    'doneness', oi.doneness
                  )
                ) as items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [order.id]
      );

      let fullOrder = fullOrderResult.rows[0];

      if (fullOrder.items && Array.isArray(fullOrder.items)) {
        const ids = fullOrder.items.map((i: any) => i.menu_item_id);
        const menuCache = await getMenuItemsForOrders(ids);
        fullOrder = {
          ...fullOrder,
          items: fullOrder.items.map((item: any) => ({
            ...item,
            menu_item_title: menuCache[item.menu_item_id]?.title || `Item #${item.menu_item_id}`,
            menu_item_image_url: menuCache[item.menu_item_id]?.imageUrl || null
          }))
        };
      }

      // Emit socket event for KDS (orders are created as PREPARING, go to kitchen immediately)
      const io = req.app.get('io');
      if (io) {
        console.log(`Emitting new-order event for venue ${finalVenueId}`);
        io.to(`venue-${finalVenueId}`).emit('new-order', fullOrder);
        console.log(`Socket event emitted successfully`);
      } else {
        console.warn('Socket.io not available');
      }

      res.status(201).json(fullOrder);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/orders/venue/:venue_id?status=PAID
router.get('/venue/:venue_id', async (req: Request, res: Response) => {
  try {
    const { venue_id } = req.params;
    const { status } = req.query;

    // Security: Validate venue ID
    if (!VALID_VENUE_IDS.includes(venue_id)) {
      return res.status(403).json({ error: 'Invalid venue ID' });
    }

    // First, get orders with items
    let query = `
      SELECT o.*, 
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'menu_item_id', oi.menu_item_id,
                  'quantity', oi.quantity,
                  'price', oi.price,
                  'subtotal', oi.subtotal,
                  'doneness', oi.doneness
                )
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.venue_id = $1
    `;
    const params: any[] = [venue_id];

    if (status) {
      query += ` AND o.status = $2`;
      params.push(status);
    } else {
      // Default: get PREPARING and PROCESSING orders (active orders for kitchen)
      query += ` AND o.status IN ('PREPARING', 'PROCESSING')`;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    const allMenuItemIds = new Set<number>();
    result.rows.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (item.menu_item_id) allMenuItemIds.add(item.menu_item_id);
        });
      }
    });
    const menuItemCache = await getMenuItemsForOrders(Array.from(allMenuItemIds));

    // Map orders and items using the cache
    const ordersWithTitles = result.rows.map((order: any) => {
      if (!order.items || !Array.isArray(order.items)) {
        return order;
      }

      const itemsWithTitles = order.items.map((item: any) => {
        const cached = menuItemCache[item.menu_item_id] || { title: `Item #${item.menu_item_id}`, imageUrl: null };
        
        // Debug log to see what we're getting
        if (!cached.title || cached.title.startsWith('Item #')) {
          console.warn(`⚠️ Menu item ${item.menu_item_id} has no title in cache. Cache size: ${Object.keys(menuItemCache).length}`);
        }
        
        return {
          ...item,
          menu_item_title: cached.title,
          menu_item_image_url: cached.imageUrl
        };
      });

      return {
        ...order,
        items: itemsWithTitles
      };
    });
    
    res.json(ordersWithTitles);
  } catch (error) {
    console.error('Error fetching venue orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders (get all orders - for admin)
// Supports pagination: ?limit=50&offset=0&status=PREPARING
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 500); // Max 500 per page
    const offsetNum = parseInt(offset as string) || 0;
    
    let query = `
      SELECT o.*, 
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'menu_item_id', oi.menu_item_id,
                  'quantity', oi.quantity,
                  'price', oi.price,
                  'subtotal', oi.subtotal,
                  'doneness', oi.doneness
                )
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limitNum, offsetNum);

    const result = await pool.query(query, params);
    
    // Get total count for pagination info
    let countQuery = `SELECT COUNT(*) as total FROM orders WHERE 1=1`;
    const countParams: any[] = [];
    let countParamCount = 1;
    
    if (status) {
      countQuery += ` AND status = $${countParamCount}`;
      countParams.push(status);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      orders: result.rows,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT o.*, 
              json_agg(
                json_build_object(
                  'id', oi.id,
                  'menu_item_id', oi.menu_item_id,
                  'quantity', oi.quantity,
                  'price', oi.price,
                  'subtotal', oi.subtotal,
                  'doneness', oi.doneness
                )
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    if (order.items && Array.isArray(order.items)) {
      const ids = order.items.map((i: any) => i.menu_item_id);
      const menuCache = await getMenuItemsForOrders(ids);
      order.items = order.items.map((item: any) => ({
        ...item,
        menu_item_title: menuCache[item.menu_item_id]?.title || `Item #${item.menu_item_id}`,
        menu_item_image_url: menuCache[item.menu_item_id]?.imageUrl || null
      }));
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/orders/:id/status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = result.rows[0];

    // Emit socket event for KDS when order status changes
    const io = req.app.get('io');
    if (io) {
      // Get full order with items for socket emission
      const fullOrderResult = await pool.query(
        `SELECT o.*, 
                json_agg(
                  json_build_object(
                    'id', oi.id,
                    'menu_item_id', oi.menu_item_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'subtotal', oi.subtotal,
                    'doneness', oi.doneness
                  )
                ) as items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.id = $1
         GROUP BY o.id`,
        [id]
      );
      const fullOrder = fullOrderResult.rows[0] || order;

      if (status === 'PREPARING') {
        io.to(`venue-${order.venue_id}`).emit('new-order', fullOrder);
      } else if (status === 'READY') {
        io.to(`venue-${order.venue_id}`).emit('order-updated', fullOrder);
      }
    }

    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/orders/:id/payment-status
router.put('/:id/payment-status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!payment_status) {
      return res.status(400).json({ error: 'payment_status is required' });
    }

    if (!['UNPAID', 'PAID'].includes(payment_status)) {
      return res.status(400).json({ error: 'payment_status must be UNPAID or PAID' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET payment_status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [payment_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/orders/kds/all
// Get all PREPARING orders from all venues (combined KDS view)
router.get('/kds/all', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT 
        o.id,
        o.order_number,
        o.venue_id,
        o.table_number,
        o.phone_number,
        o.customer_name,
        o.status,
        o.payment_status,
        o.total_amount,
        o.created_at,
        json_agg(
          json_build_object(
            'menu_item_id', oi.menu_item_id,
            'quantity', oi.quantity,
            'price', oi.price,
            'subtotal', oi.subtotal,
            'doneness', oi.doneness
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.venue_id IN ('001', '002', '003')
    `;

    if (status) {
      query += ` AND o.status = $1`;
    } else {
      // Default: get PREPARING and PROCESSING orders (active orders for kitchen)
      query += ` AND o.status IN ('PREPARING', 'PROCESSING')`;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(
      query,
      status ? [status] : []
    );

    const allMenuItemIds = new Set<number>();
    result.rows.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (item.menu_item_id) allMenuItemIds.add(item.menu_item_id);
        });
      }
    });
    const menuItemCache = await getMenuItemsForOrders(Array.from(allMenuItemIds));

    const venueNameMap: Record<string, string> = {
      '001': 'PROOST',
      '002': 'THE PUBLIC HOUSE',
      '003': 'ROCKSHOTS'
    };

    const ordersWithTitles = result.rows.map((order: any) => {
      if (!order.items || !Array.isArray(order.items)) {
        return {
          ...order,
          venue_name: venueNameMap[order.venue_id] || order.venue_id,
          items: []
        };
      }

      const itemsWithTitles = order.items.map((item: any) => {
        const cached = menuItemCache[item.menu_item_id] || { title: `Item #${item.menu_item_id}`, imageUrl: null };
        
        return {
          ...item,
          menu_item_title: cached.title,
          menu_item_image_url: cached.imageUrl
        };
      });

      return {
        ...order,
        venue_name: venueNameMap[order.venue_id] || order.venue_id,
        items: itemsWithTitles
      };
    });

    res.json(ordersWithTitles);
  } catch (error) {
    console.error('Error fetching all venue orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

