const VENUE_STORAGE_KEY = 'curo_venue_id';
const TOKEN_STORAGE_KEY = 'curo_venue_token';

const VENUE_SLUG_TO_ID: Record<string, string> = {
  'proost': '001',
  'thepublichouse': '002',
  'publichouse': '002',
  'rockshots': '003',
};

const VENUE_ID_TO_SLUG: Record<string, string> = {
  '001': 'proost',
  '002': 'thepublichouse',
  '003': 'rockshots',
};

export function getVenueIdFromSlug(slug: string | null): string | null {
  if (!slug) return null;
  return VENUE_SLUG_TO_ID[slug.toLowerCase()] || null;
}

export function getSlugFromVenueId(venueId: string | null): string | null {
  if (!venueId) return null;
  return VENUE_ID_TO_SLUG[venueId] || null;
}

export function getAllVenueSlugs(): string[] {
  return Object.keys(VENUE_SLUG_TO_ID);
}

/**
 * Detects venue token from URL parameter (secure method)
 * Example: ?token=MDAxOmFiYzEyMzQ1Ng==
 */
export function detectTokenFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

/**
 * Detects venue from URL parameter - checks for slug first, then legacy venue ID
 * Example: ?proost or ?venue=001
 */
export function detectVenueFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  
  for (const slug of getAllVenueSlugs()) {
    if (params.has(slug)) {
      return getVenueIdFromSlug(slug);
    }
  }
  
  return params.get('venue');
}

/**
 * Validates if a venue ID is allowed
 * Frontend validation - backend also validates for security
 */
const ALLOWED_VENUES = ['001', '002', '003'];

export function isValidVenue(venueId: string | null): boolean {
  if (!venueId) return false;
  return ALLOWED_VENUES.includes(venueId);
}

/**
 * Persists venue ID to localStorage for convenience
 */
export function persistVenue(venueId: string): void {
  if (!venueId || !isValidVenue(venueId)) return;
  localStorage.setItem(VENUE_STORAGE_KEY, venueId);
}

/**
 * Retrieves persisted venue ID from localStorage
 */
export function getPersistedVenue(): string | null {
  return localStorage.getItem(VENUE_STORAGE_KEY);
}

/**
 * Gets current token from URL or storage
 */
export function getCurrentToken(): string | null {
  const urlToken = detectTokenFromURL();
  if (urlToken) {
    localStorage.setItem(TOKEN_STORAGE_KEY, urlToken);
    return urlToken;
  }
  
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Gets current venue ID (from URL or storage)
 * CRUCIAL: If venue is detected from URL, it's immediately saved to localStorage
 * This ensures the venue persists even if user closes tab and reopens later
 * 
 * Priority order:
 * 1. Token from URL (secure method) - saves token to localStorage
 * 2. Venue ID from URL (?venue=001) - saves venue ID to localStorage
 * 3. Stored token from localStorage
 * 4. Stored venue ID from localStorage (persists across sessions)
 * 
 * SECURITY: Backend validates token/venue ID on every request (server-side security)
 */
export function getCurrentVenue(): string | null {
  // Priority 1: Token from URL (secure method)
  const token = detectTokenFromURL();
  if (token) {
    // CRUCIAL: Save token to localStorage immediately so it persists
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    // Extract venue ID from token for display purposes (backend will validate token)
    // For now, return a placeholder - components will use token for API calls
    return 'token-based'; // Placeholder to satisfy components
  }

  // Priority 2: Venue ID from URL (?venue=001)
  // CRUCIAL: This is where we detect ?venue=001 and save it immediately
  const urlVenue = detectVenueFromURL();
  if (urlVenue && isValidVenue(urlVenue)) {
    // CRUCIAL: Persist venue ID to localStorage immediately
    // This ensures it's remembered even if user closes tab and reopens 5 minutes later
    persistVenue(urlVenue);
    console.log(`📍 Venue detected from URL: ${urlVenue} - Saved to localStorage`);
    return urlVenue;
  }

  // Priority 3: Stored token from localStorage (persists across sessions)
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (storedToken) {
    console.log('📍 Using stored token from localStorage');
    return 'token-based'; // Placeholder to satisfy components
  }

  // Priority 4: Stored venue ID from localStorage (persists across sessions)
  // CRUCIAL: This is what makes the venue persist even after closing/reopening tab
  const storedVenue = getPersistedVenue();
  if (storedVenue && isValidVenue(storedVenue)) {
    console.log(`📍 Using stored venue from localStorage: ${storedVenue}`);
    return storedVenue;
  }

  return null;
}

/**
 * Detects table number from URL parameter
 * Example: ?table=1 or ?table=A1 or ?table=TABLE 13
 */
export function detectTableFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('table');
}

/**
 * Gets table number from URL or storage
 */
const TABLE_STORAGE_KEY = 'curo_table_number';

export function getCurrentTable(): string | null {
  // First check URL (highest priority - from QR code)
  const urlTable = detectTableFromURL();
  if (urlTable) {
    localStorage.setItem(TABLE_STORAGE_KEY, urlTable);
    return urlTable;
  }
  
  // Fallback to stored table number
  return localStorage.getItem(TABLE_STORAGE_KEY);
}

/**
 * Clears stored venue (for testing/debugging)
 */
export function clearVenue(): void {
  localStorage.removeItem(VENUE_STORAGE_KEY);
  localStorage.removeItem('curo_venue_locked'); // Clean up old lock key if exists
}

