import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { getCurrentToken, getCurrentVenue, getCurrentTable } from '../utils/venueDetector';
import type { MenuItem } from '../utils/api';

export function useMenu(venueId: string | null) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for token first (secure method)
    const token = getCurrentToken();
    // Also get venue ID as fallback
    const venue = getCurrentVenue() || venueId;
    
    if (!token && !venue) {
      setLoading(false);
      setError('No venue ID or token found. Please include ?venue=XXX or ?token=XXX in the URL.');
      return;
    }

    setLoading(true);
    setError(null);

    // Get table number from URL
    const tableNumber = getCurrentTable();

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        setError('Request timed out. Please check your internet connection and backend server status.');
        setLoading(false);
      }
    }, 20000); // 20 second timeout

    // Use token if available, otherwise use venue ID, and include table number
    api.getMenu(venue, token, tableNumber)
      .then((items) => {
        clearTimeout(timeoutId);
        setMenuItems(items);
        setLoading(false);
      })
      .catch((err: any) => {
        clearTimeout(timeoutId);
        console.error('Error fetching menu:', err);
        // Remove WordPress references from error messages
        let errorMessage = err.message || 'Failed to load menu.';
        // Clean up error messages to not mention WordPress
        errorMessage = errorMessage.replace(/WordPress/gi, '').replace(/wp-json/gi, '').trim();
        if (!errorMessage || errorMessage === '.') {
          errorMessage = 'Failed to load menu. Please try again later.';
        }
        setError(errorMessage);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, [venueId]);

  return { menuItems, loading, error };
}

