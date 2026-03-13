import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVenue } from '../hooks/useVenue';
import { useCart } from '../hooks/useCart';
import { getCurrentToken, getCurrentVenue } from '../utils/venueDetector';
import { CartIcon } from './icons';

function FloatingCart() {
  const { venueId } = useVenue();
  const token = getCurrentToken();
  const venue = getCurrentVenue();
  const effectiveVenueId = venueId || venue;
  const { itemCount } = useCart(effectiveVenueId);
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  // Force reload cart when location changes (navigation between pages)
  // This ensures the counter updates when navigating back from cart/checkout
  useEffect(() => {
    // Trigger a cart reload by dispatching the cartUpdated event
    // This ensures all useCart hooks reload from localStorage
    const timer = setTimeout(() => {
      const cartKey = token 
        ? `token_${token}` 
        : effectiveVenueId && effectiveVenueId !== 'token-based'
          ? `venue_${effectiveVenueId}` 
          : null;
      if (cartKey) {
        window.dispatchEvent(new CustomEvent('cartUpdated', { 
          detail: { cartKey } 
        }));
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [location.pathname, effectiveVenueId, token]);

  if (!effectiveVenueId && !token) {
    return null;
  }

  return (
    <button
      onClick={() => navigate('/cart')}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        width: '64px',
        height: '64px',
        backgroundColor: '#1a1a1a',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        cursor: 'pointer',
        boxShadow: isHovered 
          ? '0 8px 24px rgba(26, 26, 26, 0.4)' 
          : '0 4px 16px rgba(26, 26, 26, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isHovered ? 'translateY(-4px) scale(1.05)' : 'translateY(0) scale(1)',
        fontFamily: "'Montserrat', sans-serif",
        padding: 0
      }}
      aria-label={`Cart with ${itemCount} items`}
    >
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%'
      }}>
        <CartIcon size={28} color="#fff" />
        {itemCount > 0 && (
          <span 
            key={itemCount}
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ff4757',
              color: '#fff',
              borderRadius: '50%',
              minWidth: '24px',
              height: '24px',
              fontSize: '0.75rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              padding: itemCount > 9 ? '0 6px' : '0 2px'
            }}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </div>
    </button>
  );
}

export default FloatingCart;

