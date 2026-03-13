import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const venues = [
  { id: '001', name: 'PROOST' },
  { id: '002', name: 'THE PUBLIC HOUSE' },
  { id: '003', name: 'ROCKSHOTS' }
];

const menuItems = [
  { name: 'Caesar Salad', description: 'Crisp romaine lettuce with parmesan cheese, croutons, and creamy caesar dressing', price: 12.99, category: 'Salads' },
  { name: 'Grilled Chicken Breast', description: 'Tender grilled chicken breast served with seasonal vegetables and mashed potatoes', price: 18.99, category: 'Main_Course' },
  { name: 'Margherita Pizza', description: 'Classic pizza with fresh mozzarella, tomato sauce, and basil leaves', price: 14.99, category: 'Main_Course' },
  { name: 'Beef Burger', description: 'Juicy beef patty with lettuce, tomato, onion, and special sauce on a brioche bun', price: 16.99, category: 'Main_Course' },
  { name: 'Fish and Chips', description: 'Beer-battered cod with crispy fries and tartar sauce', price: 17.99, category: 'Main_Course' },
  { name: 'Pasta Carbonara', description: 'Creamy pasta with bacon, parmesan cheese, and black pepper', price: 15.99, category: 'Main_Course' },
  { name: 'Chocolate Brownie', description: 'Warm chocolate brownie with vanilla ice cream', price: 8.99, category: 'Desserts' },
  { name: 'Cheesecake', description: 'New York style cheesecake with berry compote', price: 9.99, category: 'Desserts' },
  { name: 'Ice Cream Sundae', description: 'Three scoops of ice cream with hot fudge and whipped cream', price: 7.99, category: 'Desserts' },
  { name: 'Greek Salad', description: 'Mixed greens with feta cheese, olives, tomatoes, and vinaigrette', price: 13.99, category: 'Salads' },
  { name: 'Cobb Salad', description: 'Chicken, bacon, eggs, avocado, and blue cheese on mixed greens', price: 15.99, category: 'Salads' },
  { name: 'Chicken Wings', description: 'Spicy buffalo wings with blue cheese dip', price: 11.99, category: 'Appetizers' },
  { name: 'Mozzarella Sticks', description: 'Breaded mozzarella with marinara sauce', price: 9.99, category: 'Appetizers' },
  { name: 'Onion Rings', description: 'Beer-battered onion rings with ranch dressing', price: 8.99, category: 'Appetizers' },
  { name: 'French Fries', description: 'Crispy golden fries with ketchup', price: 6.99, category: 'Sides' },
  { name: 'Mashed Potatoes', description: 'Creamy mashed potatoes with butter', price: 5.99, category: 'Sides' },
  { name: 'Steak', description: 'Grilled ribeye steak with garlic butter and vegetables', price: 28.99, category: 'Main_Course' },
  { name: 'Salmon Fillet', description: 'Pan-seared salmon with lemon butter and rice', price: 22.99, category: 'Main_Course' },
  { name: 'Vegetarian Burger', description: 'Plant-based patty with all the fixings', price: 15.99, category: 'Main_Course' },
  { name: 'Chicken Caesar Wrap', description: 'Grilled chicken, romaine lettuce, parmesan, and caesar dressing in a flour tortilla', price: 13.99, category: 'Main_Course' },
  { name: 'BBQ Ribs', description: 'Slow-cooked pork ribs with BBQ sauce and coleslaw', price: 24.99, category: 'Main_Course' },
  { name: 'Mac and Cheese', description: 'Creamy macaroni and cheese with breadcrumbs', price: 12.99, category: 'Main_Course' },
  { name: 'Crab Cakes', description: 'Pan-fried crab cakes with remoulade sauce', price: 19.99, category: 'Appetizers' },
  { name: 'Bruschetta', description: 'Toasted bread with tomatoes, garlic, and fresh basil', price: 10.99, category: 'Appetizers' },
  { name: 'Garlic Bread', description: 'Crispy bread with garlic butter and herbs', price: 7.99, category: 'Appetizers' },
  { name: 'Onion Soup', description: 'French onion soup with melted cheese', price: 9.99, category: 'Appetizers' },
  { name: 'Caesar Wrap', description: 'Caesar salad wrapped in a flour tortilla', price: 11.99, category: 'Main_Course' },
  { name: 'Club Sandwich', description: 'Triple-decker sandwich with turkey, bacon, and lettuce', price: 14.99, category: 'Main_Course' },
  { name: 'Lemon Tart', description: 'Tangy lemon tart with whipped cream', price: 8.99, category: 'Desserts' },
  { name: 'Tiramisu', description: 'Classic Italian dessert with coffee and mascarpone', price: 10.99, category: 'Desserts' },
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function addMenuItems() {
  try {
    console.log('🔄 Adding menu items to database...\n');

    let totalAdded = 0;
    let totalSkipped = 0;

    for (const item of menuItems) {
      const venue = getRandomElement(venues);
      const displayOrder = getRandomNumber(1, 100);

      try {
        const result = await pool.query(
          `INSERT INTO menu_items 
           (wp_id, venue_id, name, description, price, category, image_url, is_available, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (wp_id, venue_id) 
           DO UPDATE SET
             name = EXCLUDED.name,
             description = EXCLUDED.description,
             price = EXCLUDED.price,
             category = EXCLUDED.category,
             is_available = EXCLUDED.is_available,
             display_order = EXCLUDED.display_order,
             synced_at = CURRENT_TIMESTAMP`,
          [
            null, // wp_id (null since these are direct DB entries)
            venue.id,
            item.name,
            item.description,
            item.price,
            item.category,
            null, // image_url
            true, // is_available
            displayOrder,
          ]
        );

        console.log(`✅ Added: ${item.name} to ${venue.name} (${venue.id})`);
        totalAdded++;
      } catch (error: any) {
        console.error(`❌ Failed to add ${item.name}:`, error.message);
        totalSkipped++;
      }
    }

    console.log(`\n✅ Complete: ${totalAdded} added, ${totalSkipped} skipped`);
    console.log('📍 Venues: PROOST (001), THE PUBLIC HOUSE (002), ROCKSHOTS (003)');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMenuItems();

