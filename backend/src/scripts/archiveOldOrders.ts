import { pool } from '../config/database';

/**
 * Archive old orders to reduce database size
 * 
 * This script moves orders older than the retention period (default: 1 year)
 * to archive tables. This helps maintain performance as the orders table grows.
 * 
 * Usage:
 *   ts-node src/scripts/archiveOldOrders.ts [retentionDays]
 * 
 * Example (archive orders older than 6 months):
 *   ts-node src/scripts/archiveOldOrders.ts 180
 */
async function archiveOldOrders(retentionDays: number = 365) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`📦 Archiving orders older than ${retentionDays} days (before ${cutoffDate.toISOString()})...`);
    
    // First, archive order items for orders that will be archived
    const ordersToArchive = await client.query(
      `SELECT id FROM orders WHERE created_at < $1`,
      [cutoffDate]
    );
    
    if (ordersToArchive.rows.length === 0) {
      console.log('✅ No orders to archive.');
      await client.query('COMMIT');
      return;
    }
    
    const orderIds = ordersToArchive.rows.map((row: any) => row.id);
    console.log(`📋 Found ${orderIds.length} orders to archive.`);
    
    // Archive order items
    const archiveItemsResult = await client.query(
      `INSERT INTO order_items_archive 
       SELECT id, order_id, menu_item_id, quantity, price, subtotal, created_at, CURRENT_TIMESTAMP
       FROM order_items
       WHERE order_id = ANY($1::int[])
       RETURNING id`,
      [orderIds]
    );
    console.log(`✅ Archived ${archiveItemsResult.rows.length} order items.`);
    
    // Archive orders
    const archiveOrdersResult = await client.query(
      `INSERT INTO orders_archive 
       SELECT id, order_number, venue_id, table_number, phone_number, customer_name, 
              status, payment_status, total_amount, created_at, updated_at, CURRENT_TIMESTAMP
       FROM orders
       WHERE id = ANY($1::int[])
       RETURNING id`,
      [orderIds]
    );
    console.log(`✅ Archived ${archiveOrdersResult.rows.length} orders.`);
    
    // Delete archived order items (CASCADE will handle this, but explicit for clarity)
    await client.query(
      `DELETE FROM order_items WHERE order_id = ANY($1::int[])`,
      [orderIds]
    );
    
    // Delete archived orders
    await client.query(
      `DELETE FROM orders WHERE id = ANY($1::int[])`,
      [orderIds]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ Successfully archived ${archiveOrdersResult.rows.length} orders and ${archiveItemsResult.rows.length} order items.`);
    console.log(`💾 Archived data is available in orders_archive and order_items_archive tables.`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error archiving orders:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  const retentionDays = process.argv[2] ? parseInt(process.argv[2]) : 365;
  archiveOldOrders(retentionDays)
    .then(() => {
      console.log('✅ Archiving complete.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Archiving failed:', error);
      process.exit(1);
    });
}

export { archiveOldOrders };

