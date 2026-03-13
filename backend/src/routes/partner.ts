import { Router, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, ensureVenueAccess, AuthRequest } from '../middleware/auth';

const router = Router();

// All partner routes require authentication
router.use(authenticate);
router.use(ensureVenueAccess);

// GET /api/partner/orders
router.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';
    const venueId = isAdmin ? null : user.venue_id; // Admins see all venues
    const { status, limit = 50 } = req.query;

    const venueNameMap: Record<string, string> = {
      '001': 'PROOST',
      '002': 'THE PUBLIC HOUSE',
      '003': 'ROCKSHOTS'
    };

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
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && venueId) {
      query += ` AND o.venue_id = $${paramCount}`;
      params.push(venueId);
      paramCount++;
    }

    if (status) {
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Sort READY orders by updated_at DESC (when marked ready), others by created_at DESC
    query += ` GROUP BY o.id ORDER BY 
      CASE WHEN o.status = 'READY' THEN o.updated_at ELSE o.created_at END DESC,
      o.created_at DESC 
      LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    const allMenuItemIds = new Set<number>();
    result.rows.forEach((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          if (item.menu_item_id) allMenuItemIds.add(item.menu_item_id);
        });
      }
    });
    const menuItemCache: Record<number, string> = {};
    const WP_API_URL = process.env.WP_API_URL || '';
    if (WP_API_URL) {
      const axios = require('axios');
      const https = require('https');
      const headers: any = { 'Accept': 'application/json' };
      if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
      }
      const agent = WP_API_URL.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      for (const mid of allMenuItemIds) {
        try {
          const r = await axios.get(`${WP_API_URL}/wp/v2/menu_item/${mid}`, { headers, timeout: 5000, ...(agent ? { httpsAgent: agent } : {}) });
          menuItemCache[mid] = r.data?.title?.rendered || r.data?.title || `Item #${mid}`;
        } catch {
          menuItemCache[mid] = `Item #${mid}`;
        }
      }
    } else {
      const menuResult = await pool.query('SELECT id, wp_id, name FROM menu_items WHERE id = ANY($1::int[]) OR wp_id = ANY($1::int[])', [Array.from(allMenuItemIds)]);
      menuResult.rows.forEach((row: any) => {
        const n = row.name || `Item #${row.id}`;
        menuItemCache[row.id] = n;
        if (row.wp_id) menuItemCache[row.wp_id] = n;
      });
    }
    for (const id of allMenuItemIds) {
      if (!menuItemCache[id]) menuItemCache[id] = `Item #${id}`;
    }

    const ordersWithNames = result.rows.map((order: any) => {
      if (order.items && Array.isArray(order.items)) {
        order.items = order.items.map((item: any) => ({
          ...item,
          menu_item_title: menuItemCache[item.menu_item_id] || `Item #${item.menu_item_id}`
        }));
      }
      // Add venue name for display
      order.venue_name = venueNameMap[order.venue_id] || order.venue_id;
      return order;
    });

    res.json(ordersWithNames);
  } catch (error) {
    console.error('Error fetching partner orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/partner/analytics
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';
    const { startDate, endDate, groupByDay } = req.query;

    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = ` AND o.created_at BETWEEN '${startDate}' AND '${endDate}'`;
    }

    interface DailyRevenueItem {
      date: string;
      revenue: number;
      orders: number;
    }
    
    let dailyRevenue: DailyRevenueItem[] = [];
    if (groupByDay === 'true') {
      const venueFilter = isAdmin ? `o.venue_id = ANY(ARRAY['001', '002', '003']::varchar[])` : `o.venue_id = $1`;
      const queryParams = isAdmin ? [] : [user.venue_id!];
      
      const dailyRevenueResult = await pool.query(
        `SELECT 
          DATE(o.created_at) as date,
          COALESCE(SUM(o.total_amount), 0) as daily_revenue,
          COUNT(*) as daily_orders
         FROM orders o
         WHERE ${venueFilter} 
           AND o.payment_status = 'PAID'${dateFilter}
         GROUP BY DATE(o.created_at)
         ORDER BY DATE(o.created_at) DESC
         LIMIT 30`,
        queryParams
      );
      dailyRevenue = dailyRevenueResult.rows.map((row: any) => ({
        date: row.date,
        revenue: parseFloat(row.daily_revenue.toString()),
        orders: parseInt(row.daily_orders.toString())
      }));
    }

    // Get closing times for all venues
    const closingTimesVenueIds = isAdmin ? ['001', '002', '003'] : [user.venue_id!];
    const closingTimesResult = await pool.query(
      `SELECT id, closing_time FROM venues WHERE id = ANY($1::varchar[])`,
      [closingTimesVenueIds]
    );
    const closingTimes = new Map(
      closingTimesResult.rows.map((row: any) => [row.id, row.closing_time ? new Date(row.closing_time) : null])
    );

    if (isAdmin) {
      // Admin view: aggregate data for all venues
      const adminVenueIds: string[] = ['001', '002', '003'];
      const allVenuesData = await Promise.all(adminVenueIds.map(async (vid: string) => {
        const closingTime = closingTimes.get(vid);
        const now = new Date();
        
        // Determine day start time:
        // - If closing_time exists and is from today, use it as day start (venue was opened today)
        // - If closing_time exists and is from a previous day, use midnight today (venue was closed, count from today)
        // - If closing_time is NULL, use midnight today
        let dayStartTime: Date;
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        
        if (closingTime) {
          const closingDate = new Date(closingTime);
          const closingDateStart = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate(), 0, 0, 0, 0);
          
          // If closing_time is from today, use it as day start (venue was opened today)
          // If closing_time is from a previous day, use midnight today (venue was closed yesterday)
          if (closingDateStart.getTime() === todayStart.getTime()) {
            dayStartTime = closingTime; // Use the exact opening time from today
          } else {
            dayStartTime = todayStart; // Use midnight today
          }
        } else {
          dayStartTime = todayStart; // Use midnight today
        }
        
        const venueRevenue = await pool.query(
          `SELECT 
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COUNT(*) as total_orders
           FROM orders 
           WHERE venue_id = $1 AND payment_status = 'PAID'${dateFilter}`,
          [vid]
        );
        
        // Get today's orders with items to calculate GST properly
        // Count orders from dayStartTime onwards (no upper bound - count all orders from day start to now)
        const venueTodayOrders = await pool.query(
          `SELECT 
            o.id,
            o.total_amount,
            oi.price,
            oi.quantity
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.venue_id = $1 
             AND o.payment_status = 'PAID'
             AND o.created_at >= $2`,
          [vid, dayStartTime]
        );
        
        // Calculate GST breakdown from order items (base prices)
        const GST_RATE = 0.09;
        let todaySubtotal = 0;
        const orderIds = new Set<number>();
        venueTodayOrders.rows.forEach((row: any) => {
          if (row.price && row.quantity) {
            todaySubtotal += parseFloat(row.price) * parseInt(row.quantity);
          }
          if (row.id) {
            orderIds.add(row.id);
          }
        });
        const todayGST = todaySubtotal * GST_RATE;
        const todayRevenueAmount = todaySubtotal + todayGST;
        const todayOrdersCount = orderIds.size;
        
        // Calculate total revenue GST breakdown from all orders
        const totalOrders = await pool.query(
          `SELECT 
            o.id,
            oi.price,
            oi.quantity
           FROM orders o
           LEFT JOIN order_items oi ON o.id = oi.order_id
           WHERE o.venue_id = $1 AND o.payment_status = 'PAID'${dateFilter}`,
          [vid]
        );
        
        let totalSubtotal = 0;
        totalOrders.rows.forEach((row: any) => {
          if (row.price && row.quantity) {
            totalSubtotal += parseFloat(row.price) * parseInt(row.quantity);
          }
        });
        const totalGST = totalSubtotal * GST_RATE;
        const totalRevenueAmount = totalSubtotal + totalGST;
        
        const venueNameMap: Record<string, string> = {
          '001': 'PROOST',
          '002': 'THE PUBLIC HOUSE',
          '003': 'ROCKSHOTS'
        };
        
        // Check if venue is closed by looking for today's revenue log entry
        // If there's a log entry for today, venue was closed today
        const todayDate = new Date(now.toISOString().split('T')[0]);
        const todayLog = await pool.query(
          'SELECT id FROM daily_revenue_logs WHERE venue_id = $1 AND date = $2',
          [vid, todayDate]
        );
        const isClosed = todayLog.rows.length > 0;
        
        return {
          venue_id: vid,
          venue_name: venueNameMap[vid] || vid,
          total_revenue: totalRevenueAmount,
          total_subtotal: totalSubtotal,
          total_gst: totalGST,
          total_orders: parseInt(venueRevenue.rows[0].total_orders.toString()),
          today_revenue: todayRevenueAmount,
          today_subtotal: todaySubtotal,
          today_gst: todayGST,
          today_orders: todayOrdersCount,
          closing_time: closingTime,
          is_closed: isClosed, // Add explicit closed status
        };
      }));
      
      const totalRevenue = allVenuesData.reduce((sum, v) => sum + v.total_revenue, 0);
      const totalTodayRevenue = allVenuesData.reduce((sum, v) => sum + v.today_revenue, 0);
      const totalOrders = allVenuesData.reduce((sum, v) => sum + v.total_orders, 0);
      const totalTodayOrders = allVenuesData.reduce((sum, v) => sum + v.today_orders, 0);
      
      const recentOrdersResult = await pool.query(
        `SELECT 
          id,
          order_number,
          venue_id,
          table_number,
          payment_status,
          total_amount,
          created_at
         FROM orders 
         WHERE venue_id = ANY($1::varchar[]) AND payment_status = 'PAID'${dateFilter}
         ORDER BY created_at DESC
         LIMIT 10`,
        [adminVenueIds]
      );
      
      res.json({
        revenue: {
          total_revenue: totalRevenue.toString(),
          total_orders: totalOrders.toString(),
        },
        today: {
          today_revenue: totalTodayRevenue.toString(),
          today_orders: totalTodayOrders.toString(),
        },
        venues: allVenuesData,
        dailyRevenue: dailyRevenue,
        recentOrders: recentOrdersResult.rows,
      });
      return;
    }

    // Manager view: single venue
    const venueId = user.venue_id;
    if (!venueId) {
      return res.status(400).json({ error: 'Venue ID is required for manager users' });
    }
    const closingTime = closingTimes.get(venueId);
    const now = new Date();
    
    // Determine day start time:
    // - If closing_time exists and is from today, use it as day start (venue was opened today)
    // - If closing_time exists and is from a previous day, use midnight today (venue was closed, count from today)
    // - If closing_time is NULL, use midnight today
    let dayStartTime: Date;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    if (closingTime) {
      const closingDate = new Date(closingTime);
      const closingDateStart = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate(), 0, 0, 0, 0);
      
      // If closing_time is from today, use it as day start (venue was opened today)
      // If closing_time is from a previous day, use midnight today (venue was closed yesterday)
      if (closingDateStart.getTime() === todayStart.getTime()) {
        dayStartTime = closingTime; // Use the exact opening time from today
      } else {
        dayStartTime = todayStart; // Use midnight today
      }
    } else {
      dayStartTime = todayStart; // Use midnight today
    }

    const revenueResult = await pool.query(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(*) as total_orders
       FROM orders 
       WHERE venue_id = $1 AND payment_status = 'PAID'${dateFilter}`,
      [venueId]
    );

    // Get today's orders with items to calculate GST properly
    // Count orders from dayStartTime onwards (no upper bound - count all orders from day start to now)
    const todayOrders = await pool.query(
      `SELECT 
        o.id,
        oi.price,
        oi.quantity
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.venue_id = $1 
         AND o.payment_status = 'PAID'
         AND o.created_at >= $2`,
      [venueId, dayStartTime]
    );
    
    // Calculate GST breakdown from order items (base prices)
    const GST_RATE = 0.09;
    let todaySubtotal = 0;
    const orderIds = new Set<number>();
    todayOrders.rows.forEach((row: any) => {
      if (row.price && row.quantity) {
        todaySubtotal += parseFloat(row.price) * parseInt(row.quantity);
      }
      if (row.id) {
        orderIds.add(row.id);
      }
    });
    const todayGST = todaySubtotal * GST_RATE;
    const todayRevenueTotal = todaySubtotal + todayGST;
    const todayOrdersCount = orderIds.size;
    
    // Calculate total revenue GST breakdown from all orders
    const allOrders = await pool.query(
      `SELECT 
        o.id,
        oi.price,
        oi.quantity
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.venue_id = $1 AND o.payment_status = 'PAID'${dateFilter}`,
      [venueId]
    );
    
    let totalSubtotal = 0;
    allOrders.rows.forEach((row: any) => {
      if (row.price && row.quantity) {
        totalSubtotal += parseFloat(row.price) * parseInt(row.quantity);
      }
    });
    const totalGST = totalSubtotal * GST_RATE;
    const totalRevenueAmount = totalSubtotal + totalGST;
    
    // Get previous days' revenue logs
    const previousDays = await pool.query(
      `SELECT date, revenue, subtotal, gst, orders_count, closed_at
       FROM daily_revenue_logs
       WHERE venue_id = $1
       ORDER BY date DESC
       LIMIT 7`,
      [venueId]
    );
    
    // Check if venue is closed by looking for today's revenue log entry
    // Reuse 'now' variable declared earlier in this function
    const todayDate = new Date(now.toISOString().split('T')[0]);
    const todayLog = await pool.query(
      'SELECT id FROM daily_revenue_logs WHERE venue_id = $1 AND date = $2',
      [venueId, todayDate]
    );
    const isClosed = todayLog.rows.length > 0;

    const recentOrdersResult = await pool.query(
      `SELECT 
        id,
        order_number,
        table_number,
        payment_status,
        total_amount,
        created_at
       FROM orders 
       WHERE venue_id = $1 AND payment_status = 'PAID'${dateFilter}
       ORDER BY created_at DESC
       LIMIT 10`,
      [venueId]
    );

    res.json({
      revenue: {
        total_revenue: totalRevenueAmount.toString(),
        total_subtotal: totalSubtotal.toString(),
        total_gst: totalGST.toString(),
        total_orders: revenueResult.rows[0].total_orders.toString()
      },
      today: {
        today_revenue: todayRevenueTotal.toString(),
        today_subtotal: todaySubtotal.toString(),
        today_gst: todayGST.toString(),
        today_orders: todayOrdersCount.toString()
      },
      dailyRevenue: dailyRevenue,
      recentOrders: recentOrdersResult.rows,
      previous_days: previousDays.rows.map((row: any) => ({
        date: row.date,
        revenue: parseFloat(row.revenue.toString()),
        subtotal: parseFloat(row.subtotal.toString()),
        gst: parseFloat(row.gst.toString()),
        orders_count: parseInt(row.orders_count.toString()),
        closed_at: row.closed_at
      })),
      is_closed: isClosed // Include closed status so manager dashboard can show correct button
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    console.error('Error stack:', error?.stack);
    console.error('Error message:', error?.message);
    res.status(500).json({ error: 'Internal server error', details: error?.message });
  }
});

// GET /api/partner/export/csv
router.get('/export/csv', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin';
    const { startDate, endDate, venueId: requestedVenueId } = req.query;
    
    // For admins, require venueId query param; for managers, use their venue_id
    const venueId = isAdmin 
      ? (requestedVenueId as string)
      : user.venue_id!;
    
    if (!venueId) {
      return res.status(400).json({ error: 'Venue ID is required' });
    }
    
    // Validate venue ID
    if (!['001', '002', '003'].includes(venueId)) {
      return res.status(400).json({ error: 'Invalid venue ID' });
    }
    
    // For managers, ensure they can only export their own venue
    if (!isAdmin && venueId !== user.venue_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const venueNameMap: Record<string, string> = {
      '001': 'PROOST',
      '002': 'THE PUBLIC HOUSE',
      '003': 'ROCKSHOTS'
    };
    const venueName = venueNameMap[venueId] || venueId;

    let dateFilter = '';
    const params: any[] = [venueId];

    if (startDate && endDate) {
      dateFilter = ` AND o.created_at BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    // Group orders by day
    const dailyOrdersResult = await pool.query(
      `SELECT 
        DATE(o.created_at) as date,
        json_agg(
          json_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'created_at', o.created_at,
            'customer_name', o.customer_name,
            'table_number', o.table_number,
            'phone_number', o.phone_number,
            'payment_status', o.payment_status,
            'total_amount', o.total_amount,
            'items', (
              SELECT json_agg(
                json_build_object(
                  'menu_item_id', oi.menu_item_id,
                  'quantity', oi.quantity,
                  'price', oi.price
                )
              )
              FROM order_items oi
              WHERE oi.order_id = o.id
            )
          )
        ) as orders
      FROM orders o
      WHERE o.venue_id = $1 AND o.payment_status = 'PAID'${dateFilter}
      GROUP BY DATE(o.created_at)
      ORDER BY DATE(o.created_at) DESC`,
      params
    );

    const allMenuItemIds = new Set<number>();
    dailyOrdersResult.rows.forEach((dayData: any) => {
      if (dayData.orders && Array.isArray(dayData.orders)) {
        dayData.orders.forEach((order: any) => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach((item: any) => {
              if (item.menu_item_id) allMenuItemIds.add(item.menu_item_id);
            });
          }
        });
      }
    });
    const menuItemCache: Record<number, string> = {};
    const WP_API_URL = process.env.WP_API_URL || '';
    if (WP_API_URL) {
      const axios = require('axios');
      const https = require('https');
      const headers: any = { 'Accept': 'application/json' };
      if (process.env.WP_API_USERNAME && process.env.WP_API_PASSWORD) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`).toString('base64');
      }
      const agent = WP_API_URL.startsWith('https') ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      for (const mid of allMenuItemIds) {
        try {
          const r = await axios.get(`${WP_API_URL}/wp/v2/menu_item/${mid}`, { headers, timeout: 5000, ...(agent ? { httpsAgent: agent } : {}) });
          menuItemCache[mid] = r.data?.title?.rendered || r.data?.title || `Item #${mid}`;
        } catch {
          menuItemCache[mid] = `Item #${mid}`;
        }
      }
    } else {
      const menuResult = await pool.query('SELECT id, wp_id, name FROM menu_items WHERE id = ANY($1::int[]) OR wp_id = ANY($1::int[])', [Array.from(allMenuItemIds)]);
      menuResult.rows.forEach((row: any) => {
        const n = row.name || `Item #${row.id}`;
        menuItemCache[row.id] = n;
        if (row.wp_id) menuItemCache[row.wp_id] = n;
      });
    }
    for (const id of allMenuItemIds) {
      if (!menuItemCache[id]) menuItemCache[id] = `Item #${id}`;
    }

    // Generate CSV grouped by day
    const csvRows: string[] = [];
    
    // Add summary row at the top
    csvRows.push(`${venueName} SALES REPORT (GROUPED BY DAY)`);
    csvRows.push(`Venue: ${venueName} (${venueId})`);
    csvRows.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
    csvRows.push(`Note: All amounts include 9% GST`);
    csvRows.push('');

    let totalRevenue = 0;
    let totalOrders = 0;

    // Add headers with GST breakdown
    const headers_row = ['Date', 'Order Number', 'Customer Name', 'Table', 'Phone', 'Payment Status', 'Items', 'Subtotal', 'GST (9%)', 'Total'];
    csvRows.push(headers_row.join(','));

    // Add orders grouped by day
    dailyOrdersResult.rows.forEach((dayData: any) => {
      const date = dayData.date;
      const orders = dayData.orders || [];
      let dailyRevenue = 0;
      let dailySubtotal = 0;
      let dailyGST = 0;

      orders.forEach((order: any) => {
        totalOrders++;
        const orderTotal = parseFloat(order.total_amount.toString());
        
        // Calculate GST breakdown from order items
        const GST_RATE = 0.09;
        let orderSubtotal = 0;
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const itemPrice = parseFloat(item.price || '0');
            orderSubtotal += itemPrice * item.quantity;
          });
        }
        const orderGST = orderSubtotal * GST_RATE;
        const calculatedTotal = orderSubtotal + orderGST;
        
        dailyRevenue += calculatedTotal;
        dailySubtotal += orderSubtotal;
        dailyGST += orderGST;
        totalRevenue += calculatedTotal;

        const itemsStr = (order.items || [])
          .map((item: any) => {
            const itemName = menuItemCache[item.menu_item_id] || `Item #${item.menu_item_id}`;
            return `${itemName} x${item.quantity}`;
          })
          .join('; ');
        
        // Helper function to escape CSV values (handle commas, quotes, newlines)
        const escapeCSV = (value: any): string => {
          if (value === null || value === undefined) return '';
          const str = String(value);
          // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        const row = [
          new Date(date).toISOString().split('T')[0],
          escapeCSV(order.order_number),
          escapeCSV(order.customer_name || ''), // Always include, empty if not provided
          escapeCSV(order.table_number || ''),
          escapeCSV(order.phone_number || ''), // Always include, empty if not provided
          escapeCSV(order.payment_status || 'UNPAID'),
          `"${itemsStr}"`,
          orderSubtotal.toFixed(2),
          orderGST.toFixed(2),
          calculatedTotal.toFixed(2),
        ];
        csvRows.push(row.join(','));
      });

      // Add daily summary row after each day with GST breakdown
      csvRows.push(`"${new Date(date).toISOString().split('T')[0]} TOTAL",,,,,,"${orders.length} orders",${dailySubtotal.toFixed(2)},${dailyGST.toFixed(2)},${dailyRevenue.toFixed(2)}`);
      csvRows.push(''); // Empty row between days
    });

    // Add summary at the bottom
    csvRows.push('');
    csvRows.push(`TOTAL REVENUE: $${totalRevenue.toFixed(2)}`);
    csvRows.push(`TOTAL ORDERS: ${totalOrders}`);

    const csv = csvRows.join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    // Format: locationid_date_revenuereport.csv
    // Example: 001_2025-12-23_revenuereport.csv
    const filename = `${venueId}_${dateStr}_revenuereport.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/partner/orders/:id/status
router.put('/orders/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const venueId = req.user!.venue_id;
    const orderId = parseInt(req.params.id);
    const { payment_status } = req.body;

    if (!payment_status || !['PAID', 'UNPAID', 'REFUNDED'].includes(payment_status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    // Verify order belongs to venue (unless admin)
    if (req.user!.role === 'admin') {
      // Admin can update any order - just verify it exists
      const orderCheck = await pool.query(
        'SELECT id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update payment status (no venue restriction for admin)
      await pool.query(
        'UPDATE orders SET payment_status = $1 WHERE id = $2',
        [payment_status, orderId]
      );
    } else {
      // Manager can only update orders from their venue
      const orderCheck = await pool.query(
        'SELECT id FROM orders WHERE id = $1 AND venue_id = $2',
        [orderId, venueId]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update payment status
      await pool.query(
        'UPDATE orders SET payment_status = $1 WHERE id = $2 AND venue_id = $3',
        [payment_status, orderId, venueId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/partner/orders/:id/payment-status (alias for /status)
router.put('/orders/:id/payment-status', async (req: AuthRequest, res: Response) => {
  try {
    const venueId = req.user!.venue_id;
    const orderId = parseInt(req.params.id);
    const { payment_status } = req.body;

    if (!payment_status || !['PAID', 'UNPAID', 'REFUNDED'].includes(payment_status)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }

    // Verify order belongs to venue (unless admin)
    if (req.user!.role === 'admin') {
      // Admin can update any order - just verify it exists
      const orderCheck = await pool.query(
        'SELECT id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update payment status (no venue restriction for admin)
      await pool.query(
        'UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [payment_status, orderId]
      );
    } else {
      // Manager can only update orders from their venue
      const orderCheck = await pool.query(
        'SELECT id FROM orders WHERE id = $1 AND venue_id = $2',
        [orderId, venueId]
      );

      if (orderCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Update payment status
      await pool.query(
        'UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND venue_id = $3',
        [payment_status, orderId, venueId]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/partner/close-venue (Admin or Manager for their venue)
router.post('/close-venue', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { venueId } = req.body;
    
    if (!venueId || !['001', '002', '003'].includes(venueId)) {
      return res.status(400).json({ error: 'Invalid venue ID' });
    }
    
    // Managers can only close their own venue
    if (user.role !== 'admin' && user.venue_id !== venueId) {
      return res.status(403).json({ error: 'Access denied. You can only close your own venue.' });
    }

    const now = new Date();
    
    // Calculate today's revenue (from last closing time or start of day)
    const venueStatus = await pool.query(
      'SELECT closing_time FROM venues WHERE id = $1',
      [venueId]
    );
    const lastClosingTime = venueStatus.rows[0]?.closing_time;
    const dayStartTime = lastClosingTime ? new Date(lastClosingTime) : new Date(new Date().setHours(0, 0, 0, 0));
    
    // Get today's orders with GST breakdown
    const GST_RATE = 0.09;
    const todayOrders = await pool.query(
      `SELECT 
        o.id,
        o.total_amount,
        oi.price,
        oi.quantity
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.venue_id = $1 
         AND o.payment_status = 'PAID'
         AND o.created_at >= $2
         AND o.created_at < $3`,
      [venueId, dayStartTime, now]
    );
    
    // Calculate subtotal, GST, and total
    let subtotal = 0;
    const orderIds = new Set<number>();
    
    todayOrders.rows.forEach((row: any) => {
      if (row.price && row.quantity) {
        subtotal += parseFloat(row.price) * parseInt(row.quantity);
      }
      if (row.id) {
        orderIds.add(row.id);
      }
    });
    
    const gst = subtotal * GST_RATE;
    const revenue = subtotal + gst;
    const ordersCount = orderIds.size;
    
    // Log today's revenue (create table if it doesn't exist)
    const todayDate = new Date(now.toISOString().split('T')[0]);
    try {
      await pool.query(
        `INSERT INTO daily_revenue_logs (venue_id, date, revenue, subtotal, gst, orders_count, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (venue_id, date) 
         DO UPDATE SET
           revenue = EXCLUDED.revenue,
           subtotal = EXCLUDED.subtotal,
           gst = EXCLUDED.gst,
           orders_count = EXCLUDED.orders_count,
           closed_at = EXCLUDED.closed_at`,
        [venueId, todayDate, revenue, subtotal, gst, ordersCount, now]
      );
    } catch (dbError: any) {
      // If table doesn't exist, create it and retry
      if (dbError.code === '42P01' || dbError.message.includes('does not exist')) {
        console.log('⚠️ daily_revenue_logs table not found. Creating it...');
        try {
          await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_revenue_logs (
              id SERIAL PRIMARY KEY,
              venue_id VARCHAR(10) REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
              date DATE NOT NULL,
              revenue DECIMAL(10, 2) NOT NULL,
              subtotal DECIMAL(10, 2) NOT NULL,
              gst DECIMAL(10, 2) NOT NULL,
              orders_count INTEGER NOT NULL,
              closed_at TIMESTAMP NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(venue_id, date)
            );
            CREATE INDEX IF NOT EXISTS idx_daily_revenue_logs_venue ON daily_revenue_logs(venue_id);
            CREATE INDEX IF NOT EXISTS idx_daily_revenue_logs_date ON daily_revenue_logs(date DESC);
          `);
          
          // Retry the insert
          await pool.query(
            `INSERT INTO daily_revenue_logs (venue_id, date, revenue, subtotal, gst, orders_count, closed_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (venue_id, date) 
             DO UPDATE SET
               revenue = EXCLUDED.revenue,
               subtotal = EXCLUDED.subtotal,
               gst = EXCLUDED.gst,
               orders_count = EXCLUDED.orders_count,
               closed_at = EXCLUDED.closed_at`,
            [venueId, todayDate, revenue, subtotal, gst, ordersCount, now]
          );
          console.log('✅ daily_revenue_logs table created and data inserted');
        } catch (createError: any) {
          console.error('❌ Failed to create daily_revenue_logs table:', createError.message);
          throw createError;
        }
      } else {
        throw dbError;
      }
    }
    
    // Update closing time
    await pool.query(
      `UPDATE venues SET closing_time = $1 WHERE id = $2`,
      [now, venueId]
    );

    res.json({ 
      success: true, 
      closing_time: now.toISOString(),
      daily_revenue: {
        revenue: revenue.toFixed(2),
        subtotal: subtotal.toFixed(2),
        gst: gst.toFixed(2),
        orders: ordersCount
      }
    });
  } catch (error) {
    console.error('Error closing venue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/partner/open-venue (Admin or Manager for their venue)
router.post('/open-venue', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { venueId } = req.body;
    
    if (!venueId || !['001', '002', '003'].includes(venueId)) {
      return res.status(400).json({ error: 'Invalid venue ID' });
    }
    
    // Managers can only open their own venue
    if (user.role !== 'admin' && user.venue_id !== venueId) {
      return res.status(403).json({ error: 'Access denied. You can only open your own venue.' });
    }

    const now = new Date();
    const todayDate = new Date(now.toISOString().split('T')[0]);
    
    // Delete today's revenue log entry (if it exists) to mark venue as open
    // This is separate from operating hours - it's just for revenue tracking
    await pool.query(
      `DELETE FROM daily_revenue_logs WHERE venue_id = $1 AND date = $2`,
      [venueId, todayDate]
    );
    
    // Set closing_time to now() when opening (this marks the start of the new revenue period)
    // When calculating today's revenue, we use closing_time as the day start
    // Setting it to now() means today's revenue will start from this point (resets to 0)
    await pool.query(
      `UPDATE venues SET closing_time = $1 WHERE id = $2`,
      [now, venueId]
    );

    res.json({ success: true, message: 'Venue opened. Revenue tracking reset to 0 for new day. Previous days\' revenue is logged below.' });
  } catch (error) {
    console.error('Error opening venue:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
