import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function updateOrderStatus() {
  const orderId = process.argv[2];
  const newStatus = process.argv[3];

  if (!orderId || !newStatus) {
    console.log('Usage: ts-node updateOrderStatus.ts <order_id> <status>');
    console.log('Example: ts-node updateOrderStatus.ts 1 PAID');
    console.log('\nValid statuses: UNPAID, PAID, PENDING KITCHEN, READY');
    process.exit(1);
  }

  try {
    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [newStatus, orderId]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Order #${orderId} not found`);
    } else {
      const order = result.rows[0];
      console.log(`✅ Order #${orderId} updated to status: ${newStatus}`);
      console.log(`   Order Number: ${order.order_number}`);
      console.log(`   Venue: ${order.venue_id}`);
      console.log(`   Table: ${order.table_number}`);
    }

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updateOrderStatus();

