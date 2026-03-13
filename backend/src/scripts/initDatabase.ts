import { pool } from '../config/database';

/**
 * Initialize database tables
 * Run this script to create all necessary tables
 */
async function initDatabase() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        venue_id VARCHAR(10) NOT NULL,
        table_number VARCHAR(20) NOT NULL,
        phone_number VARCHAR(20),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
        total_amount DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add payment_status column if it doesn't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'orders' AND column_name = 'payment_status'
        ) THEN
          ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';
        END IF;
      END $$;
    `);

    // Add customer_name column if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'orders' AND column_name = 'customer_name'
        ) THEN
          ALTER TABLE orders ADD COLUMN customer_name VARCHAR(100);
        END IF;
      END $$;
    `);

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_venue_created ON orders(venue_id, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_venue_status ON orders(venue_id, status, created_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id)
    `);

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for orders updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
      CREATE TRIGGER update_orders_updated_at
      BEFORE UPDATE ON orders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Ensure users table exists and add password reset fields
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        venue_id VARCHAR(10),
        role VARCHAR(50) DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add password reset fields if they don't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'reset_token'
        ) THEN
          ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'reset_token_expires_at'
        ) THEN
          ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMP;
        END IF;
      END $$;
    `);

    // Create index for reset token if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) 
      WHERE reset_token IS NOT NULL
    `);

    // Add day_started_at column if it doesn't exist (for manual day reset)
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'day_started_at'
        ) THEN
          ALTER TABLE users ADD COLUMN day_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;
    `);

    // Create index for day_started_at if it doesn't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_day_started_at ON users(day_started_at) 
      WHERE day_started_at IS NOT NULL
    `);

    // Ensure venues table exists and add order requirement settings
    await client.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        require_customer_name BOOLEAN DEFAULT false,
        require_phone_number BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closing_time TIMESTAMP WITH TIME ZONE,
        operating_hours JSONB
      )
    `);

    // Add requirement columns if they don't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'venues' AND column_name = 'require_customer_name'
        ) THEN
          ALTER TABLE venues ADD COLUMN require_customer_name BOOLEAN DEFAULT false;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'venues' AND column_name = 'require_phone_number'
        ) THEN
          ALTER TABLE venues ADD COLUMN require_phone_number BOOLEAN DEFAULT false;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'venues' AND column_name = 'closing_time'
        ) THEN
          ALTER TABLE venues ADD COLUMN closing_time TIMESTAMP WITH TIME ZONE;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'venues' AND column_name = 'operating_hours'
        ) THEN
          ALTER TABLE venues ADD COLUMN operating_hours JSONB DEFAULT '{"mon_thu_sat": {"hours": "3:00 PM - 11:00 PM", "last_order": "10:45 PM"}, "friday": {"hours": "3:00 PM - 1:00 AM", "last_order": "12:45 AM"}}'::jsonb;
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        wp_id INTEGER,
        venue_id VARCHAR(10) REFERENCES venues(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(100),
        image_url VARCHAR(500),
        is_available BOOLEAN DEFAULT true,
        display_order INTEGER DEFAULT 0,
        subheader VARCHAR(255),
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(wp_id, venue_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_menu_items_venue ON menu_items(venue_id)`);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'subheader') THEN
          ALTER TABLE menu_items ADD COLUMN subheader VARCHAR(255);
        END IF;
      END $$;
    `);

    // Create table_numbers table for QR code validation
    await client.query(`
      CREATE TABLE IF NOT EXISTS table_numbers (
        id SERIAL PRIMARY KEY,
        table_number VARCHAR(50) NOT NULL,
        venue_id VARCHAR(10) NOT NULL,
        qr_token VARCHAR(100) UNIQUE NOT NULL,
        qr_code_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(venue_id, table_number)
      )
    `);

    // Create indexes for table_numbers
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_table_numbers_venue ON table_numbers(venue_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_table_numbers_lookup ON table_numbers(venue_id, table_number)
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating database tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

export default initDatabase;

