/**
 * Script to add menu items to WordPress via REST API
 * 
 * Usage:
 * 1. Update WORDPRESS_URL, USERNAME, and PASSWORD below
 * 2. Run: node add-menu-items.js
 */

const WORDPRESS_URL = 'http://curo-cmslocal.local'; // Local WordPress URL
const USERNAME = 'admin';
const PASSWORD = 'mHMG p2fN TNrx wHWU OEFQ eofM'; // Application Password

// Category slugs mapping
const CATEGORIES = {
  'starters': 'Starters',
  'banhmi': 'Banh Mi',
  'oysters': 'Oysters',
  'salads': 'Salads',
  'mantoutapas': 'Mantou Tapas',
  'birthdaycake': 'Birthday Cake'
};

// Venue IDs - all items available at all 3 locations
const VENUE_IDS = ['001', '002', '003'];

// Menu items data
const menuItems = [
  // STARTERS
  {
    code: 'S1',
    name: 'Chicken Wings (6)',
    category: 'starters',
    price: 16,
    description: 'Crispy, juicy, and deepfried with a signature spice blend.'
  },
  {
    code: 'S2',
    name: 'Nachos Cheese',
    category: 'starters',
    price: 14,
    description: 'Loaded with savoury beef - the perfect bar bite.'
  },
  {
    code: 'S3',
    name: 'Nachos Beef',
    category: 'starters',
    price: 20,
    description: 'Loaded with savoury beef - the perfect bar bite.'
  },
  {
    code: 'S4',
    name: 'Satay Beef (10)',
    category: 'starters',
    price: 20,
    description: 'Grilled to smoky perfection, served with a secret peanut sauce.'
  },
  {
    code: 'S5',
    name: 'Satay Tau Kwa (5)',
    category: 'starters',
    price: 16,
    description: 'A twist on local favourites — charred tofu with tangy daikon and satay sauce.'
  },
  {
    code: 'S6',
    name: 'Satay Medley',
    category: 'starters',
    price: 24,
    description: 'Skewer goodness on a plate. 6 Beef Satay and 3 Tau Kwa'
  },
  {
    code: 'S7',
    name: 'Man Tou (6)',
    category: 'starters',
    price: 7,
    description: 'Golden-fried buns — crispy on the outside, soft inside. Served with condensed milk.'
  },
  {
    code: 'S8',
    name: 'Steamed Gyoza (8)',
    category: 'starters',
    price: 20,
    description: '8 juicy dumplings topped with spicy Lao Gan Ma for a flavour kick.'
  },
  {
    code: 'S9',
    name: 'Steak with Roasted Tomatoes',
    category: 'starters',
    price: 16,
    description: 'Tender beef slices balanced with sharp, house-pickled accents.'
  },
  
  // BANH MI
  {
    code: 'BM1',
    name: 'Homemade Beef Banh Mi',
    category: 'banhmi',
    price: 17,
    description: 'Marinated beef, pickled vegetables, and herbs in a crisp baguette — bold, savoury, and satisfying.',
    subheader: 'All banh mi come with a side of guava chips.'
  },
  {
    code: 'BM2',
    name: 'Cha Lua Banh Mi',
    category: 'banhmi',
    price: 14,
    description: 'Vietnamese pork sausage layered with fresh herbs and pickles — simple, authentic, and flavour-packed.',
    subheader: 'All banh mi come with a side of guava chips.'
  },
  {
    code: 'BM3',
    name: 'Chicken Banh Mi',
    category: 'banhmi',
    price: 14,
    description: 'Grilled chicken with tangy pickles, cilantro, and house sauce — a light yet hearty classic.',
    subheader: 'All banh mi come with a side of guava chips.'
  },
  
  // OYSTERS
  {
    code: 'O1',
    name: 'Fresh Oysters (6)',
    category: 'oysters',
    price: 24,
    description: 'Freshly shucked oysters with tabasco and lemon wedges'
  },
  {
    code: 'O2',
    name: 'Baked Oysters with Cheese (3)',
    category: 'oysters',
    price: 20,
    description: 'Creamy, golden perfection. 3 Fresh oysters baked under a rich blanket of melted cheese for the ultimate indulgence.'
  },
  {
    code: 'O3',
    name: 'Baked Oysters with Peanut (3)',
    category: 'oysters',
    price: 20,
    description: 'A bold local twist — 3 baked oysters topped with fragrant crushed peanuts for a nutty, savoury crunch.'
  },
  {
    code: 'O4',
    name: 'Baked Medley (3 Peanut & 3 Cheese)',
    category: 'oysters',
    price: 30,
    description: 'Double the goodness in a plate.'
  },
  
  // SALADS
  {
    code: 'SD1',
    name: 'Prawn Salad',
    category: 'salads',
    price: 20,
    description: 'Fresh greens topped with prawns in your choice of dressing.',
    subheader: 'Choice of Lao Gan Ma or roasted sesame dressing.'
  },
  {
    code: 'SD2',
    name: 'Steak Salad',
    category: 'salads',
    price: 20,
    description: 'Juicy grilled beef steak served over fresh greens with your choice of dressing.',
    subheader: 'Choice of Lao Gan Ma or roasted sesame dressing.'
  },
  {
    code: 'SD3',
    name: 'Grilled Chicken Salad',
    category: 'salads',
    price: 17,
    description: 'Tender grilled chicken over crisp greens with your choice of dressing.',
    subheader: 'Choice of Lao Gan Ma or roasted sesame dressing.'
  },
  {
    code: 'SD4',
    name: 'Tau Kwa Salad',
    category: 'salads',
    price: 17,
    description: 'Salad with tau kwa with your choice of dressing.',
    subheader: 'Choice of Lao Gan Ma or roasted sesame dressing.'
  },
  
  // MANTOU TAPAS
  {
    code: 'MT1',
    name: '6 Prawn Tapas',
    category: 'mantoutapas',
    price: 17,
    description: 'Tossed in Lao Gan Ma sauce, bringing a fiery umami crunch.'
  },
  {
    code: 'MT2',
    name: '6 Otah Tapas',
    category: 'mantoutapas',
    price: 17,
    description: 'A refreshing local twist with bold coastal flavours.'
  },
  {
    code: 'MT3',
    name: '6 Ham Tapas',
    category: 'mantoutapas',
    price: 17,
    description: 'Smooth Vietnamese ham with a modern touch.'
  },
  {
    code: 'MT4',
    name: '6 Beef Patty Tapas',
    category: 'mantoutapas',
    price: 17,
    description: 'Topped with wasabi, where heat meets bold.'
  },
  {
    code: 'MT5',
    name: '6 Chicken Tapas',
    category: 'mantoutapas',
    price: 17,
    description: 'Coated in a spicy glaze, punch and addictive'
  },
  {
    code: 'MT6',
    name: '8 Mixed Plate Tapas',
    category: 'mantoutapas',
    price: 22,
    description: 'Choice of mix of prawn, otah, ham, beef patty, chicken, or mushroom.'
  },
  
  // BIRTHDAY CAKE
  {
    code: 'BC1',
    name: 'Tiramisu (270g)',
    category: 'birthdaycake',
    price: 28,
    description: 'Classic Italian indulgence with rich espresso and mascarpone layers. (270grams)'
  }
];

// Helper function to create base64 auth
function getAuthHeader() {
  const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

// Helper function to get category term ID
async function getCategoryTermId(categorySlug) {
  try {
    const response = await fetch(
      `${WORDPRESS_URL}/wp-json/wp/v2/menu_category?slug=${categorySlug}`,
      {
        headers: {
          'Authorization': getAuthHeader()
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch category: ${response.statusText}`);
    }
    
    const categories = await response.json();
    if (categories.length > 0) {
      return categories[0].id;
    }
    
    // If category doesn't exist, try to create it
    console.log(`Category ${categorySlug} not found, attempting to create...`);
    const createResponse = await fetch(
      `${WORDPRESS_URL}/wp-json/wp/v2/menu_category`,
      {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: CATEGORIES[categorySlug],
          slug: categorySlug
        })
      }
    );
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create category: ${createResponse.statusText}`);
    }
    
    const newCategory = await createResponse.json();
    return newCategory.id;
  } catch (error) {
    console.error(`Error with category ${categorySlug}:`, error.message);
    return null;
  }
}

// Function to create a menu item
async function createMenuItem(item) {
  try {
    // Format title as "CODE Name"
    const title = `${item.code} ${item.name}`;
    
    // Combine subheader and description if subheader exists
    let content = item.description || '';
    if (item.subheader) {
      content = `${item.subheader}\n\n${content}`;
    }
    
    // Step 1: Create the menu item post
    const postData = {
      title: title,
      content: content,
      status: 'publish'
    };
    
    const createResponse = await fetch(
      `${WORDPRESS_URL}/wp-json/wp/v2/menu_item`,
      {
        method: 'POST',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      }
    );
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`HTTP ${createResponse.status}: ${errorText}`);
    }
    
    const createdItem = await createResponse.json();
    const itemId = createdItem.id;
    
    // Step 2: Update ACF fields using ACF REST API
    const acfFields = {
      fields: {
        category: item.category,
        venue_id: VENUE_IDS,
        price: item.price.toString(),
        item_code: item.code,
        description: item.description,
        subheader: item.subheader || ''
      }
    };
    
    const acfResponse = await fetch(
      `${WORDPRESS_URL}/wp-json/acf/v3/menu_item/${itemId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(acfFields)
      }
    );
    
    if (!acfResponse.ok) {
      const errorText = await acfResponse.text();
      throw new Error(`ACF Update failed: HTTP ${acfResponse.status}: ${errorText}`);
    }
    
    console.log(`✓ Created: ${title} (ID: ${itemId})`);
    return createdItem;
  } catch (error) {
    console.error(`✗ Failed to create ${item.code}:`, error.message);
    throw error;
  }
}

// Main function
async function main() {
  console.log('Starting menu items import...\n');
  console.log(`WordPress URL: ${WORDPRESS_URL}`);
  console.log(`Total items to import: ${menuItems.length}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const item of menuItems) {
    try {
      await createMenuItem(item);
      successCount++;
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      failCount++;
      console.error(`Error importing ${item.code}:`, error);
    }
  }
  
  console.log('\n=== Import Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
}

// Run the script
main().catch(console.error);

