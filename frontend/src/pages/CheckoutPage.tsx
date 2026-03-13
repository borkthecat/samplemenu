import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVenue } from '../hooks/useVenue';
import { useCart } from '../hooks/useCart';
import { api } from '../utils/api';
import { getCurrentToken, getCurrentTable } from '../utils/venueDetector';

function CheckoutPage() {
  const { venueId } = useVenue();
  const { cart, total, clearCart } = useCart(venueId);
  const navigate = useNavigate();

  // Auto-detect table number from URL (from QR code) or storage
  const detectedTable = getCurrentTable();
  const [tableNumber, setTableNumber] = useState(detectedTable || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [requireName, setRequireName] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [operatingHours, setOperatingHours] = useState<any>(null);
  const isTableAutoDetected = !!detectedTable; // Track if table was auto-detected

  // Calculate GST (9%)
  const GST_RATE = 0.09;
  const subtotal = total;
  const gstAmount = subtotal * GST_RATE;
  const totalWithGST = subtotal + gstAmount;

  // Check if venue is closed based on operating hours
  const checkIfClosed = (hours: any) => {
    // TEST MODE: Check URL parameter ?test_closed=true to force closed state
    // Check this first, before checking hours
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test_closed') === 'true') {
      console.log('TEST MODE: Forcing closed state');
      return true;
    }
    
    if (!hours) return false;
    if (hours.closed_all_day) {
      return true;
    }
    
    const now = new Date();
    const singaporeTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
    const currentDay = singaporeTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    const currentHour = singaporeTime.getHours();
    const currentMinute = singaporeTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // Get last order and open time based on day
    let lastOrderTime: string;
    let openTime: string;
    if (currentDay === 5) { // Friday
      lastOrderTime = hours.friday?.last_order || '12:45 AM';
      openTime = hours.friday?.open_time || '3:00 PM';
    } else if (currentDay === 1 || currentDay === 4 || currentDay === 6) { // Monday, Thursday, Saturday
      lastOrderTime = hours.mon_thu_sat?.last_order || '10:45 PM';
      openTime = hours.mon_thu_sat?.open_time || '3:00 PM';
    } else {
      // Sunday, Tuesday, Wednesday - assume closed or use Mon/Thu/Sat hours
      lastOrderTime = hours.mon_thu_sat?.last_order || '10:45 PM';
      openTime = hours.mon_thu_sat?.open_time || '3:00 PM';
    }
    
    // Parse time string (e.g., "10:45 PM" or "12:45 AM") to minutes since midnight
    const parseTime = (timeStr: string): number => {
      const trimmed = timeStr.trim();
      const parts = trimmed.split(' ');
      if (parts.length < 2) {
        // Try to parse without period (assume 24-hour format)
        const [hours, minutes] = trimmed.split(':').map(Number);
        return (hours || 0) * 60 + (minutes || 0);
      }
      const [time, period] = parts;
      const [hours, minutes] = time.split(':').map(Number);
      let hour24 = hours || 0;
      if (period?.toUpperCase() === 'PM' && hours !== 12) hour24 += 12;
      if (period?.toUpperCase() === 'AM' && hours === 12) hour24 = 0;
      return hour24 * 60 + (minutes || 0);
    };
    
    const lastOrderMinutes = parseTime(lastOrderTime);
    const openTimeMinutes = parseTime(openTime);
    
    // Logic: Closed if current time >= last order time AND current time < open time
    // This handles both cases:
    // 1. Last order is early morning (e.g., 4:00 AM) and open time is afternoon (e.g., 3:00 PM)
    //    - Closed from 4:00 AM to 3:00 PM
    // 2. Last order is late night (e.g., 10:45 PM) and open time is afternoon (e.g., 3:00 PM)
    //    - Closed from 10:45 PM to midnight, then from midnight to 3:00 PM next day
    
    let isClosed = false;
    
    if (lastOrderMinutes < openTimeMinutes) {
      // Normal case: last order is before open time (e.g., 4:00 AM last order, 3:00 PM open)
      // Closed if: current time >= last order AND current time < open time
      isClosed = currentTimeMinutes >= lastOrderMinutes && currentTimeMinutes < openTimeMinutes;
    } else {
      // Day wrap case: last order is after open time (e.g., 10:45 PM last order, 3:00 PM open)
      // Closed if: current time >= last order (late night) OR current time < open time (early day)
      isClosed = currentTimeMinutes >= lastOrderMinutes || currentTimeMinutes < openTimeMinutes;
    }
    
    // Debug logging
    console.log('Time Check:', {
      currentTime: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`,
      currentDay,
      lastOrderTime,
      lastOrderMinutes,
      openTime,
      openTimeMinutes,
      currentTimeMinutes,
      isClosed,
      note: lastOrderMinutes < openTimeMinutes ? 'Normal case' : 'Day wrap case'
    });
    
    return isClosed;
  };

  // Fetch venue settings and operating hours
  useEffect(() => {
    const token = getCurrentToken();
    
    if (token) {
      // If using token, fetch settings by token
      api.getVenueSettingsByToken(token).then((settings) => {
        console.log('Venue settings fetched (via token):', settings);
        setRequireName(settings.require_customer_name);
        setRequirePhone(settings.require_phone_number);
      }).catch((error) => {
        console.error('Failed to fetch venue settings (via token):', error);
      });
      
      // Get venue ID from token for operating hours
      // Try to get from URL parameters (venue slug or venue ID)
      const urlParams = new URLSearchParams(window.location.search);
      let venueForHours: string | null = null;
      
      // Check for venue slugs first
      const venueSlugMap: Record<string, string> = {
        'proost': '001',
        'thepublichouse': '002',
        'publichouse': '002',
        'rockshots': '003'
      };
      
      for (const [slug, id] of Object.entries(venueSlugMap)) {
        if (urlParams.has(slug)) {
          venueForHours = id;
          break;
        }
      }
      
      // Fallback to venue parameter
      if (!venueForHours) {
        venueForHours = urlParams.get('venue') || '001';
      }
      
      api.getOperatingHours(venueForHours).then((hours) => {
        setOperatingHours(hours);
        setIsClosed(checkIfClosed(hours));
      }).catch(console.error);
    } else if (venueId) {
      // Otherwise use venueId
      api.getVenueSettings(venueId).then((settings) => {
        console.log('Venue settings fetched (via venueId):', settings);
        setRequireName(settings.require_customer_name);
        setRequirePhone(settings.require_phone_number);
      }).catch((error) => {
        console.error('Failed to fetch venue settings (via venueId):', error);
      });
      
      api.getOperatingHours(venueId).then((hours) => {
        setOperatingHours(hours);
        setIsClosed(checkIfClosed(hours));
      }).catch(console.error);
    }
  }, [venueId]);

  // Periodically check if venue opens again (every 30 seconds)
  // Also check test mode immediately and on interval
  useEffect(() => {
    // Check test mode immediately
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test_closed') === 'true') {
      setIsClosed(true);
      return; // Don't set up interval if in test mode
    }
    
    if (!operatingHours) return;
    
    const checkInterval = setInterval(() => {
      const closed = checkIfClosed(operatingHours);
      setIsClosed(closed);
      // If venue opens, the popup will automatically disappear
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(checkInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatingHours]);

  // Update table number if detected from URL
  useEffect(() => {
    const urlTable = getCurrentTable();
    if (urlTable && !tableNumber) {
      setTableNumber(urlTable);
    }
  }, [tableNumber]);

  if (!venueId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Venue not found</h1>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Your cart is empty</h1>
        <button onClick={() => navigate('/menu')}>Back to Menu</button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent order if closed
    if (isClosed) {
      const closedMessage = operatingHours?.closed_all_day
        ? 'We are currently closed.'
        : 'We are currently closed. Last order time has passed.';
      setError(closedMessage);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Include price with each item (database needs this for Orders > Items relationship)
      const orderItems = cart.map((cartItem) => ({
        menu_item_id: cartItem.item.id,
        doneness: cartItem.doneness || null,
        quantity: cartItem.quantity,
        price: parseFloat(cartItem.item.price.toString()), // Send price from WordPress
      }));

      // Use token if available (secure), otherwise fallback to venue_id
      const token = getCurrentToken();
      
      const order = await api.createOrder({
        ...(token ? { token } : { venue_id: venueId! }),
        table_number: tableNumber,
        phone_number: phoneNumber || undefined,
        customer_name: customerName || undefined,
        items: orderItems,
      });

      clearCart();
      navigate(`/order-confirmation/${order.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create order');
      setLoading(false);
    }
  };

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
            onClick={() => navigate('/cart')}
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
          }}>Checkout</h1>
          <div style={{ width: '40px' }}></div>
        </div>
      </header>

      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '1rem',
        paddingBottom: '2rem'
      }}>
        {/* Order Summary - Sticky on mobile */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          position: 'sticky',
          top: '73px',
          zIndex: 10
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.75rem'
          }}>
            <h2 style={{ 
              margin: 0, 
              fontSize: '1rem', 
              color: '#666',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>Order Summary</h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#1a1a1a'
              }}>
                ${totalWithGST.toFixed(2)}
              </span>
              {cart.length > 0 && total > 0 && (
                <span style={{
                  fontSize: '0.75rem',
                  color: '#999',
                  fontWeight: '400',
                  marginTop: '0.25rem'
                }}>
                  (incl. GST)
                </span>
              )}
            </div>
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: '#999',
            marginBottom: '0.75rem'
          }}>
            {cart.reduce((sum, item) => sum + item.quantity, 0)} item{cart.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? 's' : ''}
          </div>
          
          {/* GST Breakdown - Always show when there are items in cart */}
          {cart.length > 0 && total > 0 ? (
            <div style={{
              borderTop: '1px solid #f0f0f0',
              paddingTop: '0.75rem',
              marginTop: '0.75rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
                color: '#666',
                marginBottom: '0.5rem'
              }}>
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
                color: '#666',
                marginBottom: '0.5rem'
              }}>
                <span>GST (9%)</span>
                <span>${gstAmount.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1rem',
                fontWeight: '600',
                color: '#212529',
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #f0f0f0'
              }}>
                <span>Total</span>
                <span>${totalWithGST.toFixed(2)}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Form */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h2 style={{ 
            margin: '0 0 1.5rem 0', 
            fontSize: '1.25rem', 
            color: '#212529',
            fontWeight: '600'
          }}>Order Details</h2>
            
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
            {!isTableAutoDetected ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.625rem', 
                  fontWeight: '600',
                  color: '#212529',
                  fontSize: '0.9375rem'
                }}>
                  Table Number *
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  required
                  placeholder="Enter table number"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '1.5px solid #e9ecef',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    backgroundColor: '#fff',
                    color: '#212529',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1a1a1a';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26, 26, 26, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            ) : (
              <div style={{ 
                marginBottom: '1.5rem',
                padding: '0.875rem 1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e9ecef'
              }}>
                <div style={{ 
                  fontSize: '0.75rem',
                  color: '#6c757d',
                  marginBottom: '0.25rem',
                  fontWeight: '500'
                }}>
                  Table Number
                </div>
                <div style={{ 
                  fontSize: '1rem',
                  color: '#212529',
                  fontWeight: '600'
                }}>
                  {tableNumber}
                </div>
              </div>
            )}
            </div>

            {requireName && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.625rem',
                  fontWeight: '600',
                  color: '#212529',
                  fontSize: '0.9375rem'
                }}>
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  placeholder="Enter your name"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '1.5px solid #e9ecef',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    backgroundColor: '#fff',
                    color: '#212529',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1a1a1a';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26, 26, 26, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}

            {requirePhone && (
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.625rem',
                  fontWeight: '600',
                  color: '#212529',
                  fontSize: '0.9375rem'
                }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="Enter phone number"
                  style={{
                    width: '100%',
                    padding: '0.875rem 1rem',
                    border: '1.5px solid #e9ecef',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    backgroundColor: '#fff',
                    color: '#212529',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1a1a1a';
                    e.currentTarget.style.outline = 'none';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(26, 26, 26, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            )}


            {error && (
              <div style={{ 
                padding: '1rem', 
                background: '#fff3cd', 
                color: '#856404', 
                borderRadius: '12px', 
                marginBottom: '1.5rem',
                border: '1.5px solid #ffc107',
                fontSize: '0.9375rem'
              }}>
                {error}
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '2rem'
            }}>
              <button
                type="submit"
                disabled={loading || isClosed}
                style={{
                  padding: '1rem',
                  background: (loading || isClosed) ? '#ccc' : '#1a1a1a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: (loading || isClosed) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  boxShadow: (loading || isClosed) ? 'none' : '0 4px 12px rgba(26, 26, 26, 0.3)',
                  transition: 'all 0.2s',
                  width: '100%'
                }}
                onMouseOver={(e) => {
                  if (!loading && !isClosed) {
                    e.currentTarget.style.backgroundColor = '#2d2d2d';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(26, 26, 26, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading && !isClosed) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 26, 26, 0.3)';
                  }
                }}
              >
                {loading ? 'Placing Order...' : isClosed ? 'Closed' : 'Place Order'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/cart')}
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
                  e.currentTarget.style.borderColor = '#1a1a1a';
                  e.currentTarget.style.color = '#1a1a1a';
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = '#e9ecef';
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                ← Back to Cart
              </button>
            </div>
          </form>
        </div>

        {/* Order Items List */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '1.5rem',
          marginTop: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}>
          <h3 style={{ 
            margin: '0 0 1.25rem 0', 
            fontSize: '1rem', 
            color: '#666',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>Items</h3>
          
          <div>
            {cart.map((cartItem) => (
              <div key={cartItem.item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
                paddingBottom: '1.25rem',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <div style={{ flex: 1, paddingRight: '1rem' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#212529',
                    fontSize: '0.9375rem',
                    marginBottom: '0.25rem'
                  }}>
                    {cartItem.item.name}
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#999',
                    fontWeight: '500'
                  }}>
                    Qty: {cartItem.quantity}
                  </div>
                </div>
                <div style={{ 
                  fontWeight: '700', 
                  color: '#212529',
                  fontSize: '1rem',
                  whiteSpace: 'nowrap'
                }}>
                  ${(parseFloat(cartItem.item.price.toString()) * cartItem.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CheckoutPage;
