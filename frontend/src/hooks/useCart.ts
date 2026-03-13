import { useState, useEffect, useCallback, useRef } from 'react';
import type { MenuItem } from '../utils/api';
import { getCurrentToken, getCurrentVenue } from '../utils/venueDetector';

interface CartItem {
  item: MenuItem;
  quantity: number;
  doneness?: string; // For steak items
}

const CART_STORAGE_KEY = 'curo_cart';

/**
 * Gets a unique cart identifier for localStorage
 * Uses token if available (more secure), otherwise uses venue ID
 * This function MUST be called consistently across all components
 */
function getCartKey(): string | null {
  // Always check token first - it's the primary identifier
  const token = getCurrentToken();
  if (token) {
    // Use token as key when available - ensures cart is tied to the token
    return `token_${token}`;
  }
  
  // Fallback to venue ID from URL or storage
  const venueId = getCurrentVenue();
  if (venueId && venueId !== 'token-based') {
    // Use venue ID for legacy/development mode
    return `venue_${venueId}`;
  }
  
  return null;
}

export function useCart(venueId: string | null) {
  const loadCartFromStorage = useCallback(() => {
    const cartKey = getCartKey();
    
    if (!cartKey) {
      return [];
    }

    const storageKey = `${CART_STORAGE_KEY}_${cartKey}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('[useCart] Failed to parse stored cart:', e);
        return [];
      }
    }
    return [];
  }, []);

  // Initialize cart from localStorage immediately (synchronously on mount)
  const [cart, setCart] = useState<CartItem[]>(loadCartFromStorage);
  const isUpdatingRef = useRef(false);

  const reloadCart = useCallback(() => {
    if (isUpdatingRef.current) return;
    const loadedCart = loadCartFromStorage();
    setCart(loadedCart);
  }, [loadCartFromStorage]);

  // Load cart from localStorage when venue/token changes or on navigation
  useEffect(() => {
    const cartKey = getCartKey();
    
    if (!cartKey) {
      setCart([]);
      return;
    }

    reloadCart();

    // Listen for custom cart update event (same-tab updates)
    const handleCartUpdate = (e: CustomEvent) => {
      if (e.detail?.cartKey === cartKey) {
        setTimeout(reloadCart, 50);
      }
    };

    // Listen for storage changes (when cart is updated from other tabs/components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `${CART_STORAGE_KEY}_${cartKey}`) {
        reloadCart();
      }
    };

    // Listen for window focus (when navigating back to tab)
    const handleFocus = () => {
      reloadCart();
    };

    // Listen for visibility change (when switching tabs/windows)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        reloadCart();
      }
    };

    window.addEventListener('cartUpdated', handleCartUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [venueId, reloadCart]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    const cartKey = getCartKey();
    if (!cartKey) {
      return;
    }
    
    isUpdatingRef.current = true;
    const storageKey = `${CART_STORAGE_KEY}_${cartKey}`;
    
    if (cart.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } else {
      localStorage.removeItem(storageKey);
    }
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartKey } }));
    
    // Reset flag after a short delay to allow other components to reload
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
  }, [cart]);

  const addToCart = useCallback((item: MenuItem, quantity: number = 1, doneness?: string) => {
    setCart((prev) => {
      // For items with doneness, treat as separate if doneness differs
      if (doneness) {
        const existing = prev.find((ci) => ci.item.id === item.id && ci.doneness === doneness);
        if (existing) {
          return prev.map((ci) =>
            ci.item.id === item.id && ci.doneness === doneness
              ? { ...ci, quantity: ci.quantity + quantity }
              : ci
          );
        }
        return [...prev, { item, quantity, doneness }];
      }
      
      // For items without doneness, match by ID only
      const existing = prev.find((ci) => ci.item.id === item.id && !ci.doneness);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id && !ci.doneness
            ? { ...ci, quantity: ci.quantity + quantity }
            : ci
        );
      }
      return [...prev, { item, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: number) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: number, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity } : ci
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    const cartKey = getCartKey();
    setCart([]);
    if (cartKey) {
      const storageKey = `${CART_STORAGE_KEY}_${cartKey}`;
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartKey } }));
    }
  }, []);

  const total = cart.reduce(
    (sum, ci) => sum + ci.item.price * ci.quantity,
    0
  );

  return {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    total,
    itemCount: cart.reduce((sum, ci) => sum + ci.quantity, 0),
  };
}

