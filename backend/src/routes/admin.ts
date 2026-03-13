import { Router, Request, Response } from 'express';
import { pool } from '../config/database';

const router = Router();

/**
 * TEMPORARY ADMIN ENDPOINT - DELETE AFTER USE
 * 
 * POST /api/admin/clear-test-data
 * 
 * Clears all test data: orders, order items, and revenue logs
 * 
 * WARNING: This will delete ALL orders and revenue data!
 * 
 * Security: Add a secret token check if needed
 */
router.post('/clear-test-data', async (req: Request, res: Response) => {
  try {
    // Optional: Add a secret token check
    // const secret = req.headers['x-admin-secret'];
    // if (secret !== process.env.ADMIN_SECRET) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const client = await pool.connect();
    
    try {
      console.log('🗑️  Clearing all test data...');
      
      // Note: TRUNCATE auto-commits, so we don't use BEGIN/COMMIT
      
      // Get counts before deletion for reporting
      const beforeOrders = await client.query('SELECT COUNT(*) as count FROM orders');
      const beforeItems = await client.query('SELECT COUNT(*) as count FROM order_items');
      const beforeRevenue = await client.query('SELECT COUNT(*) as count FROM daily_revenue_logs');
      
      const ordersCount = parseInt(beforeOrders.rows[0].count);
      const itemsCount = parseInt(beforeItems.rows[0].count);
      const revenueCount = parseInt(beforeRevenue.rows[0].count);
      
      console.log(`📊 Before: ${ordersCount} orders, ${itemsCount} items, ${revenueCount} revenue logs`);
      
      // Use TRUNCATE for guaranteed deletion (more reliable than DELETE)
      // TRUNCATE is faster and cannot be rolled back easily, but we're in a transaction
      await client.query('TRUNCATE TABLE order_items CASCADE');
      console.log(`✅ Truncated order_items table`);
      
      await client.query('TRUNCATE TABLE orders CASCADE');
      console.log(`✅ Truncated orders table`);
      
      await client.query('TRUNCATE TABLE daily_revenue_logs CASCADE');
      console.log(`✅ Truncated daily_revenue_logs table`);
      
      // Clear archive tables if they exist
      try {
        await client.query('TRUNCATE TABLE order_items_archive CASCADE');
        await client.query('TRUNCATE TABLE orders_archive CASCADE');
        console.log('✅ Truncated archive tables');
      } catch (error: any) {
        // Archive tables may not exist, that's fine
        console.log('ℹ️  Archive tables not found or already empty');
      }
      
      // Verify deletion - check if any orders remain
      const verifyOrders = await client.query('SELECT COUNT(*) as count FROM orders');
      const verifyItems = await client.query('SELECT COUNT(*) as count FROM order_items');
      const verifyRevenue = await client.query('SELECT COUNT(*) as count FROM daily_revenue_logs');
      
      const remainingOrders = parseInt(verifyOrders.rows[0].count);
      const remainingItems = parseInt(verifyItems.rows[0].count);
      const remainingRevenue = parseInt(verifyRevenue.rows[0].count);
      
      console.log(`🔍 After: ${remainingOrders} orders, ${remainingItems} items, ${remainingRevenue} revenue logs remaining`);
      
      if (remainingOrders > 0 || remainingItems > 0 || remainingRevenue > 0) {
        console.error('❌ ERROR: Data still exists after TRUNCATE! This should not happen.');
        throw new Error(`Failed to clear all data. Remaining: ${remainingOrders} orders, ${remainingItems} items, ${remainingRevenue} revenue logs`);
      }
      
      // Reset venue closing times (clears day start tracking)
      const venuesReset = await client.query('UPDATE venues SET closing_time = NULL');
      console.log(`✅ Reset closing times for ${venuesReset.rowCount} venues`);
      
      
      // Reset sequences
      try {
        await client.query('ALTER SEQUENCE orders_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE order_items_id_seq RESTART WITH 1');
        await client.query('ALTER SEQUENCE daily_revenue_logs_id_seq RESTART WITH 1');
        console.log('✅ Sequences reset');
      } catch (error: any) {
        console.log('ℹ️  Could not reset sequences:', error.message);
      }
      
      // Final verification after truncate (which auto-committed)
      const finalCheck = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM orders) as orders_count,
          (SELECT COUNT(*) FROM order_items) as items_count,
          (SELECT COUNT(*) FROM daily_revenue_logs) as revenue_count
      `);
      
      const finalCounts = finalCheck.rows[0];
      
      res.json({ 
        success: true, 
        message: 'All test data cleared successfully',
        deleted: {
          orders: ordersCount,
          order_items: itemsCount,
          revenue_logs: revenueCount,
          venues_reset: venuesReset.rowCount
        },
        verification: {
          orders_remaining: remainingOrders,
          items_remaining: remainingItems,
          revenue_remaining: remainingRevenue
        }
      });
      
    } catch (error) {
      // No need to rollback - TRUNCATE auto-commits
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error: any) {
    console.error('❌ Error clearing test data:', error);
    res.status(500).json({ 
      error: 'Failed to clear test data',
      message: error.message 
    });
  }
});

/**
 * TEMPORARY ENDPOINT - Run migration to add doneness column
 * POST /api/admin/add-doneness-column
 */
router.post('/add-doneness-column', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding doneness column to order_items table...');
    
    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' AND column_name = 'doneness'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('✅ Doneness column already exists');
      return res.json({ 
        success: true, 
        message: 'Doneness column already exists',
        alreadyExists: true
      });
    }
    
    // Add the column
    await client.query(`
      ALTER TABLE order_items 
      ADD COLUMN doneness VARCHAR(50)
    `);
    
    console.log('✅ Doneness column added successfully');
    
    // Verify it was added
    const verify = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' AND column_name = 'doneness'
    `);
    
    res.json({ 
      success: true, 
      message: 'Doneness column added successfully',
      column: verify.rows[0]
    });
    
  } catch (error: any) {
    console.error('❌ Error adding doneness column:', error);
    res.status(500).json({ 
      error: 'Failed to add doneness column',
      message: error.message 
    });
  } finally {
    client.release();
  }
});

/**
 * TEMPORARY ENDPOINT - Clear data for a specific venue only
 * POST /api/admin/clear-venue-data
 * Body: { venue_id: '001' }
 */
router.post('/clear-venue-data', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { venue_id } = req.body;
    
    if (!venue_id) {
      return res.status(400).json({ error: 'venue_id is required' });
    }
    
    console.log(`🗑️  Clearing orders and revenue for venue ${venue_id}...`);
    console.log(`ℹ️  Note: Menu items (menu catalog) will NOT be deleted - only orders and revenue`);
    
    // Get counts before deletion
    const beforeOrders = await client.query('SELECT COUNT(*) as count FROM orders WHERE venue_id = $1', [venue_id]);
    const beforeRevenue = await client.query('SELECT COUNT(*) as count FROM daily_revenue_logs WHERE venue_id = $1', [venue_id]);
    
    const ordersCount = parseInt(beforeOrders.rows[0].count);
    const revenueCount = parseInt(beforeRevenue.rows[0].count);
    
    console.log(`📊 Before: ${ordersCount} orders, ${revenueCount} revenue logs for venue ${venue_id}`);
    
    // Delete order items first (they're part of orders, must be deleted with orders due to foreign key)
    // But menu_items (the menu catalog) stays untouched
    const deletedItems = await client.query(
      'DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE venue_id = $1)',
      [venue_id]
    );
    console.log(`✅ Deleted ${deletedItems.rowCount} order items (items within orders - menu catalog untouched)`);
    
    // Delete orders
    await client.query('DELETE FROM orders WHERE venue_id = $1', [venue_id]);
    console.log(`✅ Deleted orders for venue ${venue_id}`);
    
    // Delete revenue logs
    await client.query('DELETE FROM daily_revenue_logs WHERE venue_id = $1', [venue_id]);
    console.log(`✅ Deleted revenue logs for venue ${venue_id}`);
    
    // Verify deletion
    const verifyOrders = await client.query('SELECT COUNT(*) as count FROM orders WHERE venue_id = $1', [venue_id]);
    const verifyRevenue = await client.query('SELECT COUNT(*) as count FROM daily_revenue_logs WHERE venue_id = $1', [venue_id]);
    
    const remainingOrders = parseInt(verifyOrders.rows[0].count);
    const remainingRevenue = parseInt(verifyRevenue.rows[0].count);
    
    console.log(`🔍 After: ${remainingOrders} orders, ${remainingRevenue} revenue logs remaining for venue ${venue_id}`);
    
    res.json({ 
      success: true, 
      message: `Orders and revenue cleared successfully for venue ${venue_id}. Menu catalog (menu_items) remains untouched.`,
      deleted: {
        orders: ordersCount,
        revenue_logs: revenueCount
      },
      verification: {
        orders_remaining: remainingOrders,
        revenue_remaining: remainingRevenue
      },
      note: 'Menu items (menu catalog) were NOT deleted - only orders and revenue were cleared'
    });
    
  } catch (error: any) {
    console.error('❌ Error clearing venue data:', error);
    res.status(500).json({ 
      error: 'Failed to clear venue data',
      message: error.message 
    });
  } finally {
    client.release();
  }
});

export default router;

