import { pool } from '../config/database';

/**
 * Clear all test data: orders, order items, and revenue logs
 * 
 * WARNING: This will delete ALL orders and revenue data from the database!
 * Only use this for clearing test data before production deployment.
 * 
 * Usage:
 *   ts-node src/scripts/clearTestData.ts
 */
async function clearTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🗑️  Clearing all test data...');
    
    // Count records before deletion
    const ordersCount = await client.query('SELECT COUNT(*) as count FROM orders');
    const revenueCount = await client.query('SELECT COUNT(*) as count FROM daily_revenue_logs');
    const archiveOrdersCount = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'orders_archive'
    `).then(async (result) => {
      if (result.rows.length > 0) {
        const count = await client.query('SELECT COUNT(*) as count FROM orders_archive');
        return count.rows[0].count;
      }
      return 0;
    }).catch(() => 0);
    
    console.log(`📊 Current data counts:`);
    console.log(`   - Orders: ${ordersCount.rows[0].count}`);
    console.log(`   - Revenue logs: ${revenueCount.rows[0].count}`);
    if (archiveOrdersCount > 0) {
      console.log(`   - Archived orders: ${archiveOrdersCount}`);
    }
    
    // Delete all order items (will be cascaded, but explicit for clarity)
    console.log('🗑️  Deleting all order items...');
    const orderItemsResult = await client.query('DELETE FROM order_items');
    console.log(`✅ Deleted ${orderItemsResult.rowCount} order items`);
    
    // Delete all orders
    console.log('🗑️  Deleting all orders...');
    const ordersResult = await client.query('DELETE FROM orders');
    console.log(`✅ Deleted ${ordersResult.rowCount} orders`);
    
    // Delete all revenue logs
    console.log('🗑️  Deleting all revenue logs...');
    const revenueResult = await client.query('DELETE FROM daily_revenue_logs');
    console.log(`✅ Deleted ${revenueResult.rowCount} revenue logs`);
    
    // Clear archive tables if they exist
    try {
      console.log('🗑️  Checking for archive tables...');
      const archiveTablesCheck = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name IN ('orders_archive', 'order_items_archive')
      `);
      
      if (archiveTablesCheck.rows.length > 0) {
        for (const row of archiveTablesCheck.rows) {
          const tableName = row.table_name;
          console.log(`🗑️  Clearing ${tableName}...`);
          const archiveResult = await client.query(`DELETE FROM ${tableName}`);
          console.log(`✅ Cleared ${archiveResult.rowCount} records from ${tableName}`);
        }
      } else {
        console.log('ℹ️  No archive tables found');
      }
    } catch (error: any) {
      console.log('ℹ️  Archive tables may not exist, skipping...');
    }
    
    // Reset sequences (optional, but good practice)
    console.log('🔄 Resetting sequences...');
    try {
      await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
      await client.query('ALTER SEQUENCE daily_revenue_logs_id_seq RESTART WITH 1');
      console.log('✅ Sequences reset');
    } catch (error: any) {
      console.log('ℹ️  Could not reset sequences (may not exist):', error.message);
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Successfully cleared all test data!');
    console.log('📊 Database is now clean and ready for production.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing test data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  clearTestData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { clearTestData };

