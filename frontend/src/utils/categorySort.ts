/**
 * Get the category slug from a category string
 * Handles both "slug: Name" format and plain slug format
 * This normalizes different category formats to a single slug
 */
export function getCategorySlug(category: string): string {
  if (!category) return 'other';
  
  // Handle "slug: Name" format
  if (category.includes(':')) {
    return category.split(':')[0].trim().toLowerCase();
  }
  // Return lowercase slug
  return category.toLowerCase().trim();
}

/**
 * Get the canonical category name for display
 * Prefers "slug: Name" format, otherwise formats nicely
 */
export function getCanonicalCategoryName(category: string): string {
  if (!category) return 'Other';
  
  // If it's already in "slug: Name" format, return the name part
  if (category.includes(':')) {
    const parts = category.split(':');
    if (parts.length >= 2) {
      return parts[1].trim();
    }
  }
  
  // Otherwise, use the category as-is (it will be formatted by formatCategoryName)
  return category;
}

/**
 * Sort categories with custom order:
 * - "promotions" always first
 * - "starters" second (if no promotions)
 * - "birthdaycake" always last
 * - Everything else maintains original order
 */
export function sortCategories(categories: string[]): string[] {
  // Define order: promotions first, starters second, birthdaycake last
  const firstCategory = 'promotions';
  const secondCategory = 'starters';
  const lastCategory = 'birthdaycake';
  
  // Separate categories into groups
  const first: string[] = [];
  const second: string[] = [];
  const middle: string[] = [];
  const last: string[] = [];
  
  categories.forEach(category => {
    const slug = getCategorySlug(category);
    
    if (slug === firstCategory) {
      first.push(category);
    } else if (slug === secondCategory) {
      second.push(category);
    } else if (slug === lastCategory) {
      last.push(category);
    } else {
      // Maintain original order for middle categories
      middle.push(category);
    }
  });
  
  // Return: promotions first, then starters, then middle (in original order), then last
  return [...first, ...second, ...middle, ...last];
}

