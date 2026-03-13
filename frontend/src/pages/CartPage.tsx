import { useNavigate } from 'react-router-dom';
import { useVenue } from '../hooks/useVenue';
import { useCart } from '../hooks/useCart';
import { getCurrentToken, getCurrentVenue } from '../utils/venueDetector';
import { PlusIcon, MinusIcon, CartIcon } from '../components/icons';

function CartPage() {
  const { venueId } = useVenue();
  // Get venue ID (supports both token and venue ID modes)
  const venue = getCurrentVenue();
  const { cart, updateQuantity, removeFromCart, total, clearCart } = useCart(venueId || venue);
  const navigate = useNavigate();

  // Check if we have venue ID or token
  const token = getCurrentToken();
  const hasVenueOrToken = !!(venueId || venue || token);
  
  if (!hasVenueOrToken) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Venue not found</h1>
        <p>Please include ?venue=XXX or ?token=XXX in the URL, or scan a QR code</p>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        {/* Header */}
        <header style={{ 
          backgroundColor: '#fff',
          borderBottom: '1px solid #e9ecef',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '1rem 1rem 0.75rem 1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center'
          }}>
            <button
              onClick={() => navigate('/menu')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                color: '#666',
                fontSize: '1rem'
              }}
            >
              ←
            </button>
            <h1 style={{ 
              margin: 0, 
              fontSize: '1.25rem',
              color: '#212529',
              fontWeight: '600'
            }}>Cart</h1>
            <div style={{ width: '40px' }}></div>
          </div>
        </header>

        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 73px)',
          padding: '2rem 1rem'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '20px',
            padding: '3rem 2rem',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            maxWidth: '400px',
            width: '100%'
          }}>
            <div style={{ 
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #e9ecef'
            }}>
              <CartIcon size={40} />
            </div>
            <h1 style={{ 
              margin: '0 0 0.75rem 0', 
              color: '#212529', 
              fontSize: '1.5rem', 
              fontWeight: '600' 
            }}>
              Your cart is empty
            </h1>
            <p style={{ 
              color: '#999', 
              marginBottom: '2rem', 
              fontSize: '0.9375rem', 
              lineHeight: '1.5',
              margin: '0 0 2rem 0'
            }}>
              Start adding delicious items to your cart!
            </p>
            <button
              onClick={() => navigate('/menu')}
              style={{
                padding: '0.875rem 2rem',
                background: '#1a1a1a',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(26, 26, 26, 0.3)',
                transition: 'all 0.2s',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#6B3410';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(26, 26, 26, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 26, 26, 0.3)';
              }}
            >
              Browse Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      {/* Header */}
      <header style={{ 
        backgroundColor: '#fff',
        borderBottom: '1px solid #e9ecef',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '1rem 1rem 0.75rem 1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <button
            onClick={() => navigate('/menu')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              color: '#666',
              fontSize: '1rem'
            }}
          >
            ←
          </button>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.25rem',
            color: '#212529',
            fontWeight: '600'
          }}>Cart</h1>
          <div style={{ width: '40px' }}></div>
        </div>
      </header>

      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '1rem',
        paddingBottom: '2rem'
      }}>
        {/* Cart Items */}
        <div style={{ marginBottom: '1rem' }}>
          {cart.map((cartItem) => (
            <div
              key={cartItem.item.id}
              style={{
                backgroundColor: '#fff',
                borderRadius: '16px',
                padding: '1.25rem',
                marginBottom: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                display: 'flex',
                gap: '1rem'
              }}
            >
              {/* Image */}
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '12px',
                overflow: 'hidden',
                flexShrink: 0,
                backgroundColor: '#f8f9fa'
              }}>
                {cartItem.item.image_url ? (
                  <img 
                    src={cartItem.item.image_url} 
                    alt={cartItem.item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f8f9fa'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 12H5M5 12C5 13.5913 5.63214 15.1174 6.75736 16.2426C7.88258 17.3679 9.4087 18 11 18C12.5913 18 14.1174 17.3679 15.2426 16.2426C16.3679 15.1174 17 13.5913 17 12M5 12C5 10.4087 5.63214 8.88258 6.75736 7.75736C7.88258 6.63214 9.4087 6 11 6C12.5913 6 14.1174 6.63214 15.2426 7.75736C16.3679 8.88258 17 10.4087 17 12M17 12H21M9 3V7M9 17V21M15 3V7M15 17V21" stroke="#dee2e6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ 
                    margin: '0 0 0.25rem 0', 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: '#212529',
                    lineHeight: '1.4'
                  }}>
                    {cartItem.item.name}
                  </h3>
                  {cartItem.doneness && (
                    <p style={{ 
                      margin: '0 0 0.25rem 0', 
                      color: '#1a1a1a', 
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      Doneness: {cartItem.doneness}
                    </p>
                  )}
                  <p style={{ 
                    margin: 0, 
                    color: '#999', 
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>
                    ${parseFloat(cartItem.item.price.toString()).toFixed(2)} each
                  </p>
                </div>

                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginTop: 'auto'
                }}>
                  {/* Price and Remove Row */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                  }}>
                    <div style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '700', 
                      color: '#212529'
                    }}>
                      ${(parseFloat(cartItem.item.price.toString()) * cartItem.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => removeFromCart(cartItem.item.id)}
                      style={{
                        padding: '0.5rem 0.875rem',
                        background: 'transparent',
                        color: '#dc3545',
                        border: '1.5px solid #dc3545',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc3545';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#dc3545';
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '10px',
                    padding: '0.25rem',
                    width: 'fit-content'
                  }}>
                    <button
                      onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity - 1)}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        background: 'transparent',
                        color: '#666',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.color = '#1a1a1a';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      <MinusIcon size={16} />
                    </button>
                    <span style={{ 
                      minWidth: '32px', 
                      textAlign: 'center',
                      fontSize: '0.9375rem',
                      fontWeight: '600',
                      color: '#212529'
                    }}>
                      {cartItem.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(cartItem.item.id, cartItem.quantity + 1)}
                      style={{
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        background: 'transparent',
                        color: '#666',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff';
                        e.currentTarget.style.color = '#1a1a1a';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#666';
                      }}
                    >
                      <PlusIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary - Sticky */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          position: 'sticky',
          bottom: '1rem',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '1.5px solid #f0f0f0'
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1rem', 
              color: '#666',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Total</h2>
            <div style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700', 
              color: '#1a1a1a'
            }}>
              ${total.toFixed(2)}
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <button
              onClick={() => navigate('/checkout')}
              style={{
                padding: '1rem',
                background: '#1a1a1a',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(26, 26, 26, 0.3)',
                transition: 'all 0.2s',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#6B3410';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(26, 26, 26, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a1a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 26, 26, 0.3)';
              }}
            >
              Proceed to Checkout →
            </button>
            <button
              onClick={clearCart}
              style={{
                padding: '0.875rem',
                background: 'transparent',
                color: '#666',
                border: '1.5px solid #e9ecef',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.9375rem',
                fontWeight: '500',
                transition: 'all 0.2s',
                width: '100%'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#dc3545';
                e.currentTarget.style.color = '#dc3545';
                e.currentTarget.style.backgroundColor = '#fff5f5';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e9ecef';
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Clear Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CartPage;
