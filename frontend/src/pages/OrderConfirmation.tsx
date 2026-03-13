import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import type { Order } from '../utils/api';
import { useVenue } from '../hooks/useVenue';
import { useCart } from '../hooks/useCart';

interface OrderItemWithTitle {
  menu_item_id: number;
  quantity: number;
  price: number;
  subtotal?: number;
  menu_item_title?: string;
}

function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { venueId } = useVenue();
  const { clearCart } = useCart(venueId);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsWithTitles, setItemsWithTitles] = useState<OrderItemWithTitle[]>([]);

  useEffect(() => {
    if (!id) return;
    clearCart();
    api.getOrder(parseInt(id))
      .then(async (orderData) => {
        setOrder(orderData);
        
        // Fetch menu item titles if not already included
        if (orderData.items && orderData.items.length > 0) {
          const itemsWithTitles = await Promise.all(
            orderData.items.map(async (item: any) => {
              // Check if title is already included
              if (item.menu_item_title) {
                return { ...item, menu_item_title: item.menu_item_title };
              }
              
              // Fetch menu item name from API
              try {
                const menuItem = await api.getMenuItem(item.menu_item_id);
                return { ...item, menu_item_title: menuItem.name };
              } catch (error) {
                console.error(`Failed to fetch menu item ${item.menu_item_id}:`, error);
                return { ...item, menu_item_title: `Item #${item.menu_item_id}` };
              }
            })
          );
          setItemsWithTitles(itemsWithTitles);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #1a1a1a',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#666', fontSize: '1rem' }}>Loading order...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          maxWidth: '400px'
        }}>
          <h1 style={{ 
            margin: '0 0 1rem 0', 
            color: '#212529', 
            fontSize: '1.5rem',
            fontWeight: '600'
          }}>
            Order not found
          </h1>
          <p style={{ 
            color: '#666', 
            marginBottom: '1.5rem',
            fontSize: '0.9375rem'
          }}>
            The order you're looking for doesn't exist.
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
              e.currentTarget.style.backgroundColor = '#2d2d2d';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Back to Menu
          </button>
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
          <div style={{ width: '40px' }}></div>
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.25rem',
            color: '#212529',
            fontWeight: '600'
          }}>Order Confirmed</h1>
          <div style={{ width: '40px' }}></div>
        </div>
      </header>

      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '2rem 1rem',
        paddingBottom: '2rem'
      }}>
        {/* Success Card */}
        <div style={{ 
          backgroundColor: '#fff', 
          borderRadius: '20px', 
          padding: '2.5rem 2rem', 
          marginBottom: '1.5rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          textAlign: 'center'
        }}>
          <div style={{ 
            width: '80px',
            height: '80px',
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            backgroundColor: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(26, 26, 26, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ 
            color: '#212529', 
            marginBottom: '0.75rem', 
            fontSize: '1.75rem', 
            fontWeight: '700' 
          }}>
            Order Confirmed!
          </h1>
          <p style={{ 
            color: '#666', 
            fontSize: '0.9375rem',
            marginBottom: '1.5rem'
          }}>
            Your order has been received and will be prepared shortly.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #f0f0f0'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#999',
                marginBottom: '0.25rem'
              }}>
                Table
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '700',
                color: '#212529'
              }}>
                {order.table_number}
              </div>
            </div>
            <div style={{
              width: '1px',
              height: '40px',
              backgroundColor: '#e9ecef'
            }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '0.875rem', 
                color: '#999',
                marginBottom: '0.25rem'
              }}>
                Total
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '700',
                color: '#1a1a1a'
              }}>
                ${parseFloat(order.total_amount.toString()).toFixed(2)}
              </div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#999',
                marginTop: '0.25rem'
              }}>
                (GST inclusive)
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        {(itemsWithTitles.length > 0 || (order.items && order.items.length > 0)) && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}>
            <h3 style={{ 
              margin: '0 0 1.25rem 0', 
              fontSize: '1rem', 
              color: '#666',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Order Items
            </h3>
            <div>
              {(itemsWithTitles.length > 0 ? itemsWithTitles : order.items || []).map((item: any, index: number) => {
                const itemName = item.menu_item_title || `Item #${item.menu_item_id}`;
                const allItems = itemsWithTitles.length > 0 ? itemsWithTitles : order.items || [];
                return (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1.25rem',
                    paddingBottom: '1.25rem',
                    borderBottom: index < allItems.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                      <div style={{ 
                        fontWeight: '600', 
                        color: '#212529',
                        fontSize: '0.9375rem',
                        marginBottom: '0.25rem'
                      }}>
                        {itemName}
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        color: '#999',
                        fontWeight: '500'
                      }}>
                        Qty: {item.quantity}
                      </div>
                    </div>
                    <div style={{ 
                      fontWeight: '700', 
                      color: '#212529',
                      fontSize: '1rem',
                      whiteSpace: 'nowrap'
                    }}>
                      ${parseFloat((item.subtotal || (item.price * item.quantity)).toString()).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => {
            clearCart();
            navigate('/menu');
          }}
          style={{
            width: '100%',
            padding: '1rem',
            background: '#1a1a1a',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(26, 26, 26, 0.3)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2d2d2d';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(26, 26, 26, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 26, 26, 0.3)';
          }}
        >
          Order Again
        </button>
      </div>
    </div>
  );
}

export default OrderConfirmation;

