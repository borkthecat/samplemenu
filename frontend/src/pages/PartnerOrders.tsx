import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getAuthHeaders } from '../hooks/useAuth';
import { OrdersIcon, LogoutIcon, PrintIcon } from '../components/icons';
import { ReceiptPrint } from '../components/ReceiptPrint';

// Partner Orders Page

interface Order {
  id: number;
  order_number: string;
  venue_id?: string;
  venue_name?: string;
  table_number: string;
  phone_number: string | null;
  customer_name: string | null;
  status: string;
  payment_status?: string;
  total_amount: string;
  created_at: string;
  items: Array<{
    menu_item_id: number;
    menu_item_title?: string;
    quantity: number;
    price: string;
    subtotal: string;
    doneness?: string | null;
  }>;
}

function PartnerOrders() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const getVenueColor = (venueId: string) => {
    const colors: Record<string, string> = {
      '001': '#3b82f6', // Blue for PROOST
      '002': '#10b981', // Green for THE PUBLIC HOUSE
      '003': '#f59e0b', // Orange for ROCKSHOTS
    };
    return colors[venueId] || '#6b7280';
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Wait for auth to load from localStorage
    if (authLoading) return;
    
    if (!user || !token) {
      navigate('/partner/login');
      return;
    }

    fetchOrders();
    
    // Continuous syncing every 5 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, [user, token, authLoading]);

  const fetchOrders = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      // Only fetch orders with status='READY' (marked ready by KDS)
      const url = `${API_BASE}/partner/orders?status=READY`;
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Separate unpaid (current) and paid (past) orders
  const currentOrders = orders.filter(order => order.payment_status !== 'PAID');
  const pastOrders = orders.filter(order => order.payment_status === 'PAID');

  const updatePaymentStatus = async (orderId: number, paymentStatus: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/partner/orders/${orderId}/payment-status`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payment_status: paymentStatus }),
      });

      if (response.ok) {
        // Refresh orders
        fetchOrders();
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to update payment status' }));
        alert(error.error || 'Failed to update payment status');
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Failed to update payment status');
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      {printingOrder && (
        <ReceiptPrint 
          order={printingOrder} 
          onClose={() => setPrintingOrder(null)} 
        />
      )}
      <div style={{ minHeight: '100vh', backgroundColor: '#fff', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <header style={{
        backgroundColor: '#fff',
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        borderBottom: '1px solid #e9ecef',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: isMobile ? '1rem' : '0'
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#212529', fontWeight: '700' }}>Orders</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d', fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
            Venue {user?.venue_id} • {user?.email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/partner/dashboard')}
            style={{
              padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: '500',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
              e.currentTarget.style.borderColor = '#d1d5db';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            Dashboard
          </button>
          <button
            onClick={logout}
            style={{
              padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.5rem',
              backgroundColor: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1f2937';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#111827';
            }}
          >
            <LogoutIcon size={isMobile ? 16 : 18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Current Orders - UNPAID */}
        {currentOrders.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <h2 style={{ 
              margin: '0 0 1.5rem 0', 
              fontSize: isMobile ? '1.5rem' : '1.75rem', 
              fontWeight: '600', 
              color: '#212529',
              letterSpacing: '-0.02em'
            }}>
              Current Orders ({currentOrders.length})
            </h2>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {currentOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: '#fff',
                    padding: isMobile ? '1.25rem' : '1.75rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    transition: 'all 0.2s ease',
                    border: '1px solid #e5e7eb'
                  }}
                  onMouseOver={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '1rem' : '0',
                    marginBottom: '1.5rem',
                    paddingBottom: '1.5rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: '600', color: '#111827' }}>
                        {order.order_number}
                      </h3>
                      {order.venue_name && (
                        <div style={{ 
                          marginBottom: '0.5rem',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: getVenueColor(order.venue_id || '') + '20',
                          color: getVenueColor(order.venue_id || ''),
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: '600',
                          display: 'inline-block',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {order.venue_name}
                        </div>
                      )}
                      <div style={{ color: '#6b7280', fontSize: isMobile ? '0.875rem' : '0.9375rem', lineHeight: '1.6', marginTop: '0.5rem' }}>
                        <div style={{ marginBottom: '0.375rem', fontWeight: '500', color: '#374151' }}>
                          {order.table_number}
                        </div>
                        {order.customer_name && (
                          <div style={{ marginBottom: '0.375rem' }}>
                            <span style={{ color: '#374151', fontWeight: '500' }}>Name:</span> {order.customer_name}
                          </div>
                        )}
                        {order.phone_number && (
                          <div style={{ marginBottom: '0.375rem' }}>
                            <span style={{ color: '#374151', fontWeight: '500' }}>Phone:</span> {order.phone_number}
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <div style={{ 
                        fontSize: isMobile ? '1.5rem' : '2rem', 
                        fontWeight: '600', 
                        color: '#111827',
                        marginBottom: '0.75rem'
                      }}>
                        ${parseFloat(order.total_amount).toFixed(2)}
                      </div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        display: 'inline-block',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Unpaid
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.875rem 0', fontSize: isMobile ? '0.9375rem' : '1rem', fontWeight: '600', color: '#374151' }}>Items</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {order.items && order.items.map((item, index) => (
                        <li key={index} style={{
                          padding: isMobile ? '0.625rem 0.875rem' : '0.75rem 1rem',
                          backgroundColor: '#f9fafb',
                          marginBottom: '0.5rem',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid #f3f4f6'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '400', color: '#6b7280', fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                              {item.menu_item_title || `Item #${item.menu_item_id}`} × {item.quantity}
                            </span>
                            {item.doneness && (
                              <span style={{ 
                                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                color: '#1a1a1a',
                                fontWeight: '600'
                              }}>
                                Doneness: {item.doneness}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: '500', color: '#111827', fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                            ${parseFloat(item.subtotal).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* GST Breakdown */}
                  {order.items && order.items.length > 0 && (() => {
                    const GST_RATE = 0.09;
                    const subtotal = order.items.reduce((sum: number, item: any) => {
                      const itemSubtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) : item.subtotal;
                      return sum + itemSubtotal;
                    }, 0);
                    const gstAmount = subtotal * GST_RATE;
                    const calculatedTotal = subtotal + gstAmount;
                    
                    return (
                      <div style={{ 
                        marginBottom: '1.5rem', 
                        padding: isMobile ? '1rem' : '1.25rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          fontSize: isMobile ? '0.875rem' : '0.9375rem',
                          color: '#6b7280'
                        }}>
                          <span>Subtotal:</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>${subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          fontSize: isMobile ? '0.875rem' : '0.9375rem',
                          color: '#6b7280'
                        }}>
                          <span>GST (9%):</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>${gstAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #e5e7eb',
                          fontSize: isMobile ? '1rem' : '1.125rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          <span>Total:</span>
                          <span>${calculatedTotal.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#9ca3af', 
                          marginTop: '0.5rem',
                          textAlign: 'center'
                        }}>
                          All prices include 9% GST
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row', marginTop: '1rem' }}>
                    <button
                      onClick={() => setPrintingOrder(order)}
                      style={{
                        padding: isMobile ? '1rem 1.75rem' : '1.125rem 2rem',
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: isMobile ? '1rem' : '1.0625rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flex: isMobile ? '1' : '0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                      }}
                    >
                      <PrintIcon size={18} />
                      <span>Print Receipt</span>
                    </button>
                    <button
                      onClick={() => updatePaymentStatus(order.id, 'PAID')}
                      style={{
                        padding: isMobile ? '1rem 1.75rem' : '1.125rem 2rem',
                        backgroundColor: '#111827',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: isMobile ? '1rem' : '1.0625rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        flex: isMobile ? '1' : '0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#1f2937';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#111827';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
                      }}
                    >
                      Mark as Paid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Orders - PAID */}
        {pastOrders.length > 0 && (
          <div>
            <h2 style={{ 
              margin: '0 0 1.5rem 0', 
              fontSize: isMobile ? '1.5rem' : '1.75rem', 
              fontWeight: '600', 
              color: '#212529',
              letterSpacing: '-0.02em'
            }}>
              Past Orders ({pastOrders.length})
            </h2>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {pastOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: '#fff',
                    padding: isMobile ? '1.25rem' : '1.75rem',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    opacity: 0.85
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '1rem' : '0',
                    marginBottom: '1.5rem',
                    paddingBottom: '1.5rem',
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: '600', color: '#111827' }}>
                        {order.order_number}
                      </h3>
                      <div style={{ color: '#6b7280', fontSize: isMobile ? '0.875rem' : '0.9375rem', lineHeight: '1.6' }}>
                        <div style={{ marginBottom: '0.375rem', fontWeight: '500', color: '#374151' }}>
                          {order.table_number}
                        </div>
                        {order.customer_name && (
                          <div style={{ marginBottom: '0.375rem' }}>
                            <span style={{ color: '#374151', fontWeight: '500' }}>Name:</span> {order.customer_name}
                          </div>
                        )}
                        {order.phone_number && (
                          <div style={{ marginBottom: '0.375rem' }}>
                            <span style={{ color: '#374151', fontWeight: '500' }}>Phone:</span> {order.phone_number}
                          </div>
                        )}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                      <div style={{ 
                        fontSize: isMobile ? '1.5rem' : '2rem', 
                        fontWeight: '600', 
                        color: '#111827',
                        marginBottom: '0.75rem'
                      }}>
                        ${parseFloat(order.total_amount).toFixed(2)}
                      </div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '6px',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        display: 'inline-block',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Paid
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.875rem 0', fontSize: isMobile ? '0.9375rem' : '1rem', fontWeight: '600', color: '#374151' }}>Items</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {order.items && order.items.map((item, index) => (
                        <li key={index} style={{
                          padding: isMobile ? '0.625rem 0.875rem' : '0.75rem 1rem',
                          backgroundColor: '#f9fafb',
                          marginBottom: '0.5rem',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid #f3f4f6'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontWeight: '400', color: '#6b7280', fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                              {item.menu_item_title || `Item #${item.menu_item_id}`} × {item.quantity}
                            </span>
                            {item.doneness && (
                              <span style={{ 
                                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                                color: '#1a1a1a',
                                fontWeight: '600'
                              }}>
                                Doneness: {item.doneness}
                              </span>
                            )}
                          </div>
                          <span style={{ fontWeight: '500', color: '#111827', fontSize: isMobile ? '0.875rem' : '0.9375rem' }}>
                            ${parseFloat(item.subtotal).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* GST Breakdown */}
                  {order.items && order.items.length > 0 && (() => {
                    const GST_RATE = 0.09;
                    const subtotal = order.items.reduce((sum: number, item: any) => {
                      const itemSubtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) : item.subtotal;
                      return sum + itemSubtotal;
                    }, 0);
                    const gstAmount = subtotal * GST_RATE;
                    const calculatedTotal = subtotal + gstAmount;
                    
                    return (
                      <div style={{ 
                        marginBottom: '1.5rem', 
                        padding: isMobile ? '1rem' : '1.25rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          fontSize: isMobile ? '0.875rem' : '0.9375rem',
                          color: '#6b7280'
                        }}>
                          <span>Subtotal:</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>${subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginBottom: '0.5rem',
                          fontSize: isMobile ? '0.875rem' : '0.9375rem',
                          color: '#6b7280'
                        }}>
                          <span>GST (9%):</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>${gstAmount.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px solid #e5e7eb',
                          fontSize: isMobile ? '1rem' : '1.125rem',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          <span>Total:</span>
                          <span>${calculatedTotal.toFixed(2)}</span>
                        </div>
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#9ca3af', 
                          marginTop: '0.5rem',
                          textAlign: 'center'
                        }}>
                          All prices include 9% GST
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => setPrintingOrder(order)}
                    style={{
                      padding: isMobile ? '1rem 1.75rem' : '1.125rem 2rem',
                      backgroundColor: '#f3f4f6',
                      color: '#111827',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: isMobile ? '1rem' : '1.0625rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      width: isMobile ? '100%' : 'auto',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e5e7eb';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }}
                  >
                    <PrintIcon size={18} />
                    <span>Print Receipt</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {currentOrders.length === 0 && pastOrders.length === 0 && (
          <div style={{
            backgroundColor: '#fff',
            padding: '4rem 2rem',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 1.5rem',
              borderRadius: '50%',
              backgroundColor: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e5e7eb'
            }}>
              <OrdersIcon size={40} color="#9ca3af" />
            </div>
            <h3 style={{ color: '#111827', marginBottom: '0.5rem', fontSize: '1.25rem', fontWeight: '600' }}>No orders yet</h3>
            <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>
              Orders will appear here once marked ready by the kitchen
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default PartnerOrders;

