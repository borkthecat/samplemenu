/**
 * Format category names for display
 */
export function formatCategoryName(category: string): string {
  // Handle "slug: Name" format from ACF
  if (category.includes(':')) {
    const parts = category.split(':');
    if (parts.length >= 2) {
      return parts[1].trim(); // Return the name part after the colon
    }
  }

  // Category name mappings
  const categoryMap: Record<string, string> = {
    'mantoutapas': 'Mantou Tapas',
    'banhmi': 'Banh Mi',
    'starters': 'Starters',
    'oysters': 'Oysters',
    'salads': 'Salads',
    'birthdaycake': 'Birthday Cake',
    'barbites': 'Bar Bites'
  };

  // Return mapped name or format the category
  const lowerCategory = category.toLowerCase().trim();
  if (categoryMap[lowerCategory]) {
    return categoryMap[lowerCategory];
  }

  // Fallback: capitalize and replace underscores
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

