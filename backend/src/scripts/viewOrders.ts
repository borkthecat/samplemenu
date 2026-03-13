import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function viewOrders() {
  try {
    // Get all orders
    const ordersResult = await pool.query(`
      SELECT 
        o.id,
        o.order_number,
        o.venue_id,
        o.table_number,
        o.status,
        o.total_amount,
        o.created_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 20
    `);

    console.log('\n📦 Recent Orders:\n');
    console.log('ID | Order Number | Venue | Table | Status | Total | Items | Created');
    console.log('-'.repeat(80));

    ordersResult.rows.forEach(order => {
      console.log(
        `${order.id.toString().padEnd(3)} | ` +
        `${order.order_number.padEnd(12)} | ` +
        `${order.venue_id.padEnd(5)} | ` +
        `${(order.table_number || 'N/A').padEnd(5)} | ` +
        `${order.status.padEnd(15)} | ` +
        `$${parseFloat(order.total_amount.toString()).toFixed(2).padStart(6)} | ` +
        `${order.item_count.toString().padStart(5)} | ` +
        `${new Date(order.created_at).toLocaleString()}`
      );
    });

    // Get order details for a specific order
    if (process.argv[2]) {
      const orderId = parseInt(process.argv[2]);
      console.log(`\n\n📋 Details for Order #${orderId}:\n`);
      
      const detailResult = await pool.query(`
        SELECT 
          o.*,
          json_agg(
            json_build_object(
              'menu_item_id', oi.menu_item_id,
              'quantity', oi.quantity,
              'price', oi.price,
              'subtotal', oi.subtotal
            )
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1
        GROUP BY o.id
      `, [orderId]);

      if (detailResult.rows.length > 0) {
        const order = detailResult.rows[0];
        console.log('Order:', JSON.stringify(order, null, 2));
      } else {
        console.log('Order not found');
      }
    }

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

viewOrders();

