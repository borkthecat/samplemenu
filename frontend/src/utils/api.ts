import { getSlugFromVenueId } from './venueDetector';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface MenuItem {
  id: number;
  wp_id: number | null;
  venue_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean;
  display_order: number;
  subheader?: string;
}

export interface OrderItem {
  menu_item_id: number;
  quantity: number;
  price: number; // Required - price from WordPress menu item
  menu_item_title?: string; // Actual menu item name (from WordPress)
  menu_item_image_url?: string | null; // Menu item image URL
  doneness?: string | null; // Doneness level for steak items
}

export interface Order {
  id: number;
  order_number: string;
  venue_id: string;
  venue_name?: string;
  table_number: string;
  phone_number: string | null;
  customer_name: string | null;
  status: string;
  total_amount: number | string;
  items?: OrderItem[];
  created_at: string;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    // Check if API URL is configured
    if (API_BASE_URL.includes('localhost') && window.location.hostname !== 'localhost') {
      throw new Error('Backend API URL not configured. Please set VITE_API_URL environment variable.');
    }

    // Add timeout to fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000); // 18 second timeout

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.statusText}`);
      }

      return response.json();
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. The backend server may be slow or unreachable. Please check your connection.');
      }
      throw fetchError;
    }
  } catch (error: any) {
    // Enhanced error handling with better messages
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      if (API_BASE_URL.includes('localhost')) {
        throw new Error('Backend API not configured. Please set VITE_API_URL in Vercel environment variables.');
      }
      throw new Error(`Failed to connect to backend: ${API_BASE_URL}. Please check if the backend is running.`);
    }
    throw error;
  }
}

export const api = {
  // Menu
  getMenu: (venueId: string | null, token?: string | null, tableNumber?: string | null): Promise<MenuItem[]> => {
    const params: string[] = [];
    
    if (token) {
      params.push(`token=${encodeURIComponent(token)}`);
    } else if (venueId) {
      // Use venue slug in URL for cleaner URLs (e.g., ?proost instead of ?venue=001)
      const venueSlug = getSlugFromVenueId(venueId);
      if (venueSlug) {
        params.push(venueSlug);
      } else {
        // Fallback to venue_id for backwards compatibility
        params.push(`venue_id=${encodeURIComponent(venueId)}`);
      }
    } else {
      throw new Error('Either venueId or token is required');
    }
    
    // Add table number if provided
    if (tableNumber) {
      params.push(`table=${encodeURIComponent(tableNumber)}`);
    }
    
    return fetchAPI(`/menu?${params.join('&')}`);
  },

  getMenuItem: (id: number): Promise<MenuItem> =>
    fetchAPI(`/menu/item/${id}`),

  // Orders
  createOrder: (data: {
    venue_id?: string;
    token?: string;
    table_number: string;
    phone_number?: string;
    customer_name?: string;
    items: OrderItem[];
  }): Promise<Order> =>
    fetchAPI('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getVenueSettings: (venueId: string): Promise<{ require_customer_name: boolean; require_phone_number: boolean }> =>
    fetchAPI(`/venue/${venueId}/settings`),
  getVenueSettingsByToken: (token: string): Promise<{ require_customer_name: boolean; require_phone_number: boolean }> =>
    fetchAPI(`/venue/settings?token=${encodeURIComponent(token)}`),

  getOrder: (id: number): Promise<Order> =>
    fetchAPI(`/orders/${id}`),

  updateOrderStatus: (id: number, status: string): Promise<Order> =>
    fetchAPI(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Operating Hours
  getOperatingHours: (venueId?: string): Promise<{
    closed_all_day?: boolean;
    mon_thu_sat: { hours: string; last_order: string; open_time?: string };
    friday: { hours: string; last_order: string; open_time?: string };
  }> => fetchAPI(`/operating-hours${venueId ? `?venue=${venueId}` : ''}`),
  
  updateOperatingHours: (venueId: string, operatingHours: {
    closed_all_day?: boolean;
    mon_thu_sat: { hours: string; last_order: string; open_time?: string };
    friday: { hours: string; last_order: string; open_time?: string };
  }): Promise<{ success: boolean; operating_hours: any }> =>
    fetchAPI(`/operating-hours/${venueId}`, {
      method: 'PUT',
      body: JSON.stringify({ operating_hours: operatingHours }),
    }),
};

