import { pool } from '../config/database';

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📊 Tables in database:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Check venues
    const venues = await pool.query('SELECT * FROM venues');
    console.log(`\n🏢 Venues: ${venues.rows.length}`);
    venues.rows.forEach(v => {
      console.log(`  - ${v.id}: ${v.name}`);
    });

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();

