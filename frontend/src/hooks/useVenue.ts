import { useState, useEffect } from 'react';
import { getCurrentVenue, getCurrentToken } from '../utils/venueDetector';

/**
 * Hook to get current venue ID
 * CRUCIAL: Automatically detects ?venue=001 from URL and saves to localStorage
 * The venue persists even if user closes tab and reopens later
 */
export function useVenue() {
  const [venueId, setVenueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for token first, then fallback to venue_id
    // This also triggers localStorage persistence if venue is in URL
    getCurrentToken(); // Check if token exists (side effect: stores in localStorage)
    const venue = getCurrentVenue(); // This will save ?venue=001 to localStorage if present
    
    // If token exists, venue will be null (token takes priority)
    // We still set venueId for backwards compatibility in some places
    setVenueId(venue);
    setLoading(false);

    // Listen for URL changes (e.g., if user navigates with ?venue=002)
    const handleLocationChange = () => {
      const newVenue = getCurrentVenue(); // This will save new venue to localStorage
      if (newVenue !== venueId) {
        setVenueId(newVenue);
      }
    };

    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleLocationChange);
    
    // Also check on hash change (some routing scenarios)
    window.addEventListener('hashchange', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, [venueId]);

  return { venueId, loading, setVenueId };
}

