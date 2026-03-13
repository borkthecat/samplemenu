import { useEffect, useState } from 'react';
import { useKDSOrdersAll } from '../hooks/useKDSOrdersAll';
import { initAudioContextForNotifications } from '../hooks/useKDSOrders';
import { ReadyIcon, BellIcon, PrintIcon } from '../components/icons';
import { ReceiptPrint } from '../components/ReceiptPrint';

const AUDIO_ENABLED_KEY = 'kds_audio_enabled';

function KDSAll() {
  const { loading, allOrders, updateOrderStatus, newOrderBanner } = useKDSOrdersAll();
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem(AUDIO_ENABLED_KEY) === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fadingOrders, setFadingOrders] = useState<Set<number>>(new Set());
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  
  // Show PREPARING and PROCESSING orders, exclude fading ones unless they're in fadingOrders (for fade animation)
  const displayOrders = allOrders
    .filter(o => o.status !== 'READY' && o.status !== 'UNPAID')
    .filter(o => !fadingOrders.has(o.id))
    .concat(
      allOrders.filter(o => fadingOrders.has(o.id) && o.status !== 'READY' && o.status !== 'UNPAID')
    );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleEnableAudio = async () => {
    try {
      console.log('🔔 Enabling audio notifications...');
      const ctx = initAudioContextForNotifications();
      if (!ctx) {
        alert('Failed to initialize audio. Please check your browser settings.');
        return;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.frequency.value = 800;
      osc1.type = 'sine';
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1.2, now + 0.02); // Louder volume
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.2);
      setAudioEnabled(true);
      localStorage.setItem(AUDIO_ENABLED_KEY, 'true');
    } catch (error) {
      alert('Failed to enable audio notifications. Please check your browser settings and allow audio.');
    }
  };

  const venueNames: Record<string, string> = {
    '001': 'PROOST',
    '002': 'THE PUBLIC HOUSE',
    '003': 'ROCKSHOTS',
  };


  const getVenueColor = (venueId: string) => {
    const colors: Record<string, string> = {
      '001': '#3b82f6',
      '002': '#10b981',
      '003': '#f59e0b',
    };
    return colors[venueId] || '#6b7280';
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #111827',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fff',
      color: '#111827',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      position: 'relative'
    }}>
      {/* New Order Banner */}
      {newOrderBanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#10b981',
          color: '#fff',
          padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'slideDown 0.3s ease-out',
          pointerEvents: 'none'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: isMobile ? '0.9375rem' : '1rem', 
              fontWeight: '600',
              marginBottom: '0.125rem'
            }}>
              New Order Received
            </div>
            <div style={{ fontSize: isMobile ? '0.8125rem' : '0.875rem', opacity: 0.9 }}>
              Order #{newOrderBanner.order_number?.split('-')[1] || newOrderBanner.id} • {newOrderBanner.table_number || 'N/A'} • {newOrderBanner.venue_name || newOrderBanner.venue_id || 'Unknown'}
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div style={{
          position: 'fixed',
          top: newOrderBanner ? (isMobile ? '3.5rem' : '4rem') : '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10b981',
          color: '#fff',
          padding: '1rem 2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 10001,
          fontSize: '1rem',
          fontWeight: '600',
          transition: 'top 0.3s ease-out'
        }}>
          {successMessage}
        </div>
      )}
      
      {!audioEnabled && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '1rem' : '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#fff',
          borderRadius: isMobile ? '12px' : '16px',
          padding: isMobile ? '0.875rem 1rem' : '1rem 1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '0.75rem' : '1rem',
          maxWidth: isMobile ? 'calc(100% - 2rem)' : '500px',
          width: isMobile ? 'auto' : '90%',
          border: '1px solid #e5e7eb',
          marginBottom: isMobile ? '0' : '0'
        }}>
          <div style={{
            width: isMobile ? '36px' : '40px',
            height: isMobile ? '36px' : '40px',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BellIcon size={isMobile ? 18 : 20} color="#111827" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: isMobile ? '0.125rem' : '0.25rem'
            }}>
              Enable Sound Notifications
            </p>
            <p style={{
              margin: 0,
              fontSize: isMobile ? '0.75rem' : '0.8125rem',
              color: '#6b7280',
              lineHeight: '1.3'
            }}>
              Get notified when new orders arrive
            </p>
          </div>
          <button
            onClick={handleEnableAudio}
            style={{
              padding: isMobile ? '0.5rem 1rem' : '0.625rem 1.25rem',
              backgroundColor: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: isMobile ? '0.8125rem' : '0.875rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1f2937';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#111827';
            }}
          >
            Enable
          </button>
        </div>
      )}

      <header style={{ 
        backgroundColor: '#fff',
        padding: isMobile ? '1rem' : '1.5rem 2rem',
        borderBottom: '1px solid #e9ecef',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginTop: newOrderBanner ? (isMobile ? '3.5rem' : '4rem') : '0',
        transition: 'margin-top 0.3s ease-out'
      }}>
        <div>
          <h1 style={{ 
            margin: 0, 
            fontSize: isMobile ? '1.5rem' : '2rem', 
            color: '#111827', 
            fontWeight: '700' 
          }}>
            Kitchen Display System - All Venues
          </h1>
          <p style={{ 
            margin: '0.5rem 0 0 0', 
            color: '#6b7280', 
            fontSize: isMobile ? '0.875rem' : '1rem' 
          }}>
            Viewing orders from all locations
          </p>
        </div>
      </header>

      <main style={{ 
        padding: isMobile ? '1rem' : '2rem',
        paddingBottom: isMobile ? (!audioEnabled ? '6rem' : '2rem') : '2rem',
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {displayOrders.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: isMobile ? '3rem 1rem' : '4rem 2rem',
            backgroundColor: '#f9fafb',
            borderRadius: '16px',
            border: '1px solid #e5e7eb'
          }}>
            <p style={{ 
              fontSize: isMobile ? '1rem' : '1.125rem', 
              color: '#6b7280', 
              margin: 0 
            }}>
              No active orders
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: isMobile ? '1rem' : '1.5rem',
            maxWidth: '1600px',
            margin: '0 auto'
          }}>
            {displayOrders.map((order) => {
              const venueColor = getVenueColor(order.venue_id || '');
              const venueName = order.venue_name || venueNames[order.venue_id || ''] || order.venue_id || 'Unknown';
              const totalAmount = typeof order.total_amount === 'string' ? parseFloat(order.total_amount || '0') : order.total_amount || 0;
              
              return (
                <div
                  key={order.id}
                  style={{
                    backgroundColor: '#fff',
                    border: `2px solid ${venueColor}`,
                    borderRadius: isMobile ? '12px' : '16px',
                    padding: isMobile ? '1rem' : '1.5rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, filter 1.5s ease-out',
                    opacity: fadingOrders.has(order.id) ? 0 : 1,
                    transform: fadingOrders.has(order.id) ? 'translateY(-30px) scale(0.90)' : 'translateY(0) scale(1)',
                    filter: fadingOrders.has(order.id) ? 'blur(4px)' : 'none',
                    pointerEvents: fadingOrders.has(order.id) ? 'none' : 'auto'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'flex-start',
                    marginBottom: '1rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid #e5e7eb',
                    gap: isMobile ? '0.75rem' : '0'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        backgroundColor: `${venueColor}20`,
                        color: venueColor,
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        marginBottom: '0.5rem'
                      }}>
                        {venueName}
                      </div>
                      <h2 style={{ 
                        margin: '0.5rem 0 0 0', 
                        fontSize: isMobile ? '1.5rem' : '1.75rem', 
                        fontWeight: '700',
                        color: '#111827'
                      }}>
                        Order #{order.order_number?.split('-')[1] || order.id}
                      </h2>
                      {order.table_number && (
                        <p style={{ 
                          margin: '0.5rem 0 0 0', 
                          color: '#6b7280', 
                          fontSize: isMobile ? '1rem' : '1.125rem' 
                        }}>
                          {order.table_number}
                        </p>
                      )}
                      {order.created_at && (
                        <p style={{ 
                          margin: '0.5rem 0 0 0', 
                          color: '#9ca3af', 
                          fontSize: isMobile ? '0.875rem' : '0.9375rem' 
                        }}>
                          {new Date(order.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                      {order.customer_name && (
                        <p style={{ 
                          margin: order.table_number ? '0.25rem 0 0 0' : '0.5rem 0 0 0', 
                          color: '#6b7280', 
                          fontSize: isMobile ? '1rem' : '1.125rem' 
                        }}>
                          {order.customer_name}
                        </p>
                      )}
                      {order.phone_number && (
                        <p style={{ 
                          margin: '0.25rem 0 0 0', 
                          color: '#6b7280', 
                          fontSize: isMobile ? '1rem' : '1.125rem' 
                        }}>
                          {order.phone_number}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ 
                      margin: '0 0 0.75rem 0', 
                      fontSize: isMobile ? '0.9375rem' : '1rem', 
                      fontWeight: '600', 
                      color: '#6b7280',
                      textTransform: 'uppercase'
                    }}>
                      Items
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.5rem' : '0.75rem' }}>
                      {order.items && Array.isArray(order.items) && order.items.map((item: any, index: number) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: isMobile ? '0.75rem' : '1rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {item.menu_item_image_url && (
                              <img
                                src={item.menu_item_image_url}
                                alt={item.menu_item_title || 'Item'}
                                style={{
                                  width: isMobile ? '60px' : '70px',
                                  height: isMobile ? '60px' : '70px',
                                  objectFit: 'cover',
                                  borderRadius: '6px',
                                  marginBottom: '0.5rem',
                                  float: 'left',
                                  marginRight: '0.75rem'
                                }}
                              />
                            )}
                            <div>
                              <p style={{ 
                                margin: 0, 
                                fontSize: isMobile ? '1rem' : '1.125rem', 
                                fontWeight: '600',
                                color: '#111827',
                                lineHeight: '1.4'
                              }}>
                                {item.menu_item_title || `Item #${item.menu_item_id}`} × {item.quantity}
                              </p>
                              {item.doneness && (
                                <p style={{ 
                                  margin: '0.25rem 0 0 0',
                                  fontSize: isMobile ? '0.875rem' : '0.9375rem',
                                  color: '#1a1a1a',
                                  fontWeight: '600'
                                }}>
                                  Doneness: {item.doneness}
                                </p>
                              )}
                            </div>
                          </div>
                          <p style={{ 
                            margin: 0, 
                            fontSize: isMobile ? '1rem' : '1.125rem', 
                            fontWeight: '600',
                            color: '#111827',
                            flexShrink: 0
                          }}>
                            ${parseFloat(item.subtotal || item.price * item.quantity || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb',
                    marginBottom: '1rem'
                  }}>
                    <p style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '0.9375rem' : '1rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      fontWeight: '600'
                    }}>
                      Total
                    </p>
                    <p style={{ 
                      margin: 0, 
                      fontSize: isMobile ? '1.5rem' : '1.75rem', 
                      fontWeight: '700',
                      color: '#111827'
                    }}>
                      ${totalAmount.toFixed(2)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
                    <button
                      onClick={async () => {
                        try {
                          if (order.status === 'PREPARING') {
                            await updateOrderStatus(order.id, 'PROCESSING');
                            setSuccessMessage('Order status updated to Processing!');
                            setTimeout(() => setSuccessMessage(null), 3000);
                          } else if (order.status === 'PROCESSING') {
                            setFadingOrders(prev => new Set(prev).add(order.id));
                            await updateOrderStatus(order.id, 'READY');
                            setSuccessMessage('Order marked as ready!');
                            setTimeout(() => setSuccessMessage(null), 3000);
                            setTimeout(() => {
                              setFadingOrders(prev => {
                                const next = new Set(prev);
                                next.delete(order.id);
                                return next;
                              });
                            }, 1500);
                          }
                        } catch (error) {
                          setFadingOrders(prev => {
                            const next = new Set(prev);
                            next.delete(order.id);
                            return next;
                          });
                          alert('Failed to update order status');
                        }
                      }}
                      disabled={order.status === 'READY'}
                      style={{
                        padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.25rem',
                        backgroundColor: order.status === 'PREPARING' ? '#dc2626' : order.status === 'PROCESSING' ? '#f59e0b' : '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: isMobile ? '0.8125rem' : '0.875rem',
                        fontWeight: '600',
                        cursor: order.status === 'READY' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        width: isMobile ? '100%' : 'auto',
                        justifyContent: 'center',
                        opacity: order.status === 'READY' ? 0.6 : 1,
                        flex: 1
                      }}
                      onMouseEnter={(e) => {
                        if (order.status !== 'READY') {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                      }}
                    >
                      <ReadyIcon size={16} color="#fff" />
                      <span>
                        {order.status === 'PREPARING' ? 'New Order' : 
                         order.status === 'PROCESSING' ? 'Processing' : 
                         'Order Ready'}
                      </span>
                    </button>
                    <button
                      onClick={() => setPrintingOrder(order)}
                      style={{
                        padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.25rem',
                        backgroundColor: '#f3f4f6',
                        color: '#111827',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: isMobile ? '0.8125rem' : '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        width: isMobile ? '100%' : 'auto',
                        flex: 1
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#f3f4f6';
                      }}
                    >
                      <PrintIcon size={16} />
                      Print Receipt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {printingOrder && (
        <ReceiptPrint 
          order={printingOrder} 
          onClose={() => setPrintingOrder(null)} 
        />
      )}
    </div>
  );
}

export default KDSAll;

