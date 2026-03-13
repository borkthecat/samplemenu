import { useEffect, useState } from 'react';
import { useVenue } from '../hooks/useVenue';
import { useKDSOrders, initAudioContextForNotifications } from '../hooks/useKDSOrders';
import { ReadyIcon, BellIcon, PrintIcon } from '../components/icons';
import { ReceiptPrint } from '../components/ReceiptPrint';

const AUDIO_ENABLED_KEY = 'kds_audio_enabled';

function KDS() {
  const { venueId } = useVenue();
  const { loading, allOrders, updateOrderStatus, newOrderBanner } = useKDSOrders(venueId);
  const [audioEnabled, setAudioEnabled] = useState(() => {
    return localStorage.getItem(AUDIO_ENABLED_KEY) === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fadingOrders, setFadingOrders] = useState<Set<number>>(new Set());
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);
  
  // Auto-initialize and keep audio context alive if audio was previously enabled
  useEffect(() => {
    if (audioEnabled) {
      // Try to initialize audio context on page load if it was previously enabled
      const ctx = initAudioContextForNotifications();
      if (ctx) {
        // Try to resume if suspended
        if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
          ctx.resume().catch(() => {
            console.log('ℹ️ Audio context suspended - will resume when sound plays');
          });
        }
        
        // Keep context alive by playing a very short silent sound periodically
        // This prevents the browser from suspending it
        const keepAliveInterval = setInterval(() => {
          if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
            ctx.resume().catch(() => {});
          }
        }, 30000); // Check every 30 seconds
        
        return () => clearInterval(keepAliveInterval);
      }
    }
  }, [audioEnabled]);
  
  // Show PREPARING and PROCESSING orders, exclude fading ones unless they're in fadingOrders (for fade animation)
  const displayOrders = allOrders
    .filter((o: any) => o.status !== 'READY' && o.status !== 'UNPAID')
    .filter((o: any) => !fadingOrders.has(o.id))
    .concat(
      allOrders.filter((o: any) => fadingOrders.has(o.id) && o.status !== 'READY' && o.status !== 'UNPAID')
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
      
      // Initialize the global audio context (MUST happen during user gesture)
      const ctx = initAudioContextForNotifications();
      
      if (!ctx) {
        alert('Failed to initialize audio. Please check your browser settings.');
        return;
      }
      
      // CRITICAL: Resume if suspended (required by browser autoplay policy)
      // This must happen during the user gesture (button click)
      if (ctx.state === 'suspended') {
        await ctx.resume();
        // Audio context resumed
      }
      
      // Play a test sound to confirm it works and keep context active
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
      // Short, crisp test sound - 0.2 seconds
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1.2, now + 0.02); // Louder volume
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      
      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.05);
      osc2.stop(now + 0.2);
      
      // Test sound played
      
      // Enable audio and save preference
      setAudioEnabled(true);
      localStorage.setItem(AUDIO_ENABLED_KEY, 'true');
      
      // Audio notifications enabled
    } catch (error) {
      // Failed to enable audio (non-critical)
      alert('Failed to enable audio notifications. Please check your browser settings and allow audio.');
    }
  };

  if (!venueId) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#fff',
        color: '#111827',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#111827' }}>Venue Not Found</h1>
          <p style={{ color: '#6b7280' }}>Please include ?proost, ?thepublichouse, or ?rockshots in the URL</p>
        </div>
      </div>
    );
  }

      const venueNames: Record<string, string> = {
        '001': 'PROOST',
        '002': 'THE PUBLIC HOUSE',
        '003': 'ROCKSHOTS',
      };
  const venueName = venueNames[venueId] || `Venue ${venueId}`;

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fff',
      color: '#111827',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      position: 'relative'
    }}>
      {/* Success notification */}
      {successMessage && (
        <div style={{
          position: 'fixed',
          top: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10b981',
          color: '#fff',
          padding: '1rem 2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 10001,
          fontSize: '1rem',
          fontWeight: '600'
        }}>
          {successMessage}
        </div>
      )}
      
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
              Order #{newOrderBanner.order_number?.split('-')[1] || newOrderBanner.id} • {newOrderBanner.table_number || 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Audio Enable Banner - Small bottom notification */}
      {!audioEnabled && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '90%',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BellIcon size={20} color="#111827" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '0.25rem'
            }}>
              Enable Sound Notifications
            </p>
            <p style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: '#6b7280',
              lineHeight: '1.5'
            }}>
              Get sound alerts when new orders arrive
            </p>
          </div>
          <button
            onClick={handleEnableAudio}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
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
            Enable Sound
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
        gap: isMobile ? '0.75rem' : '1rem',
        marginTop: newOrderBanner ? (isMobile ? '3.5rem' : '4rem') : '0',
        transition: 'margin-top 0.3s ease-out'
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ 
            fontSize: isMobile ? '1.25rem' : '1.75rem',
            margin: 0,
            fontWeight: '700',
            color: '#111827',
            wordBreak: 'break-word'
          }}>
            {venueName}
          </h1>
          <p style={{ 
            margin: '0.5rem 0 0 0',
            color: '#6b7280',
            fontSize: isMobile ? '0.8125rem' : '0.95rem'
          }}>
            Kitchen Display System
          </p>
        </div>
        <div style={{
          padding: isMobile ? '0.5rem 1rem' : '0.5rem 1.25rem',
          backgroundColor: displayOrders.length > 0 ? '#10b981' : '#6b7280',
          color: '#fff',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: isMobile ? '0.8125rem' : '0.95rem',
          whiteSpace: 'nowrap'
        }}>
          {displayOrders.length} {displayOrders.length === 1 ? 'Order' : 'Orders'}
        </div>
      </header>

      {loading ? (
        <div style={{ 
          padding: '4rem 2rem',
          textAlign: 'center'
        }}>
          <div style={{
            border: '3px solid #f3f3f3',
            borderTop: '3px solid #111827',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading orders...</p>
        </div>
      ) : displayOrders.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '6rem 2rem',
          maxWidth: '600px',
          margin: '4rem auto'
        }}>
          <div style={{
            width: '100px',
            height: '100px',
            margin: '0 auto 2rem',
            borderRadius: '50%',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #e5e7eb'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h2 style={{ 
            color: '#111827',
            marginBottom: '0.75rem',
            fontSize: '1.75rem',
            fontWeight: '600'
          }}>
            No Active Orders
          </h2>
          <p style={{ 
            color: '#6b7280',
            fontSize: '1rem'
          }}>
            Waiting for new orders...
          </p>
        </div>
      ) : (
        <div style={{ 
          padding: isMobile ? '1rem' : '2rem',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: isMobile ? '1rem' : '1.5rem',
          maxWidth: '1600px',
          margin: '0 auto'
        }}>
          {displayOrders.map((order) => (
            <div
              key={order.id}
              style={{
                backgroundColor: '#fff',
                borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '1rem' : '1.5rem',
                border: '2px solid #e5e7eb',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'opacity 1.5s ease-out, transform 1.5s ease-out, filter 1.5s ease-out',
                opacity: fadingOrders.has(order.id) ? 0 : 1,
                transform: fadingOrders.has(order.id) ? 'translateY(-30px) scale(0.90)' : 'translateY(0) scale(1)',
                filter: fadingOrders.has(order.id) ? 'blur(4px)' : 'none',
                pointerEvents: fadingOrders.has(order.id) ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.5rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid #e9ecef'
              }}>
                <div>
                  <h2 style={{ 
                    margin: 0,
                    fontSize: isMobile ? '1.5rem' : '2rem',
                    fontWeight: '700',
                    color: '#111827',
                    letterSpacing: '-0.5px'
                  }}>
                    #{order.order_number.split('-')[1]}
                  </h2>
                  <p style={{ 
                    margin: '0.75rem 0 0 0',
                    color: '#6b7280',
                    fontSize: isMobile ? '0.875rem' : '1rem'
                  }}>
                    {order.table_number}
                  </p>
                  <p style={{ 
                    margin: '0.5rem 0 0 0',
                    color: '#9ca3af',
                    fontSize: isMobile ? '0.8125rem' : '0.875rem'
                  }}>
                    {new Date(order.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {order.customer_name && (
                    <p style={{ 
                      margin: '0.5rem 0 0 0',
                      color: '#9ca3af',
                      fontSize: isMobile ? '0.8125rem' : '0.875rem'
                    }}>
                      {order.customer_name}
                    </p>
                  )}
                  {order.phone_number && (
                    <p style={{ 
                      margin: '0.5rem 0 0 0',
                      color: '#9ca3af',
                      fontSize: isMobile ? '0.8125rem' : '0.875rem'
                    }}>
                      {order.phone_number}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {order.status}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0',
                  fontSize: '1rem',
                  color: '#6b7280',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Items
                </h3>
                {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {order.items.map((item: any, index: number) => (
                        <div
                          key={index}
                          style={{
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            border: '1px solid #e5e7eb',
                            gap: '1rem'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            flex: 1,
                            minWidth: 0
                          }}>
                            {item.menu_item_image_url ? (
                              <img
                                src={item.menu_item_image_url}
                                alt={item.menu_item_title || 'Menu item'}
                                style={{
                                  width: '60px',
                                  height: '60px',
                                  objectFit: 'cover',
                                  borderRadius: '8px',
                                  flexShrink: 0,
                                  backgroundColor: '#e5e7eb'
                                }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '8px',
                                backgroundColor: '#e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <polyline points="21 15 16 10 5 21"/>
                                </svg>
                              </div>
                            )}
                            <span style={{ 
                              fontWeight: '500',
                              color: '#111827',
                              fontSize: '1rem',
                              lineHeight: '1.4'
                            }}>
                              <div>
                                <div>{item.menu_item_title ? item.menu_item_title : `Item #${item.menu_item_id}`} × {item.quantity}</div>
                                {item.doneness && (
                                  <div style={{ 
                                    marginTop: '0.25rem',
                                    fontSize: '0.875rem',
                                    color: '#1a1a1a',
                                    fontWeight: '600'
                                  }}>
                                    Doneness: {item.doneness}
                                  </div>
                                )}
                              </div>
                            </span>
                          </div>
                          <span style={{ 
                            color: '#6b7280',
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}>
                            ${parseFloat((item.subtotal || 0).toString()).toFixed(2)}
                          </span>
                        </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No items available</p>
                )}
              </div>

              <div style={{ 
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'stretch' : 'center',
                gap: isMobile ? '1rem' : '0',
                paddingTop: '1.5rem',
                borderTop: '1px solid #e9ecef'
              }}>
                <div>
                  <div style={{ 
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600'
                  }}>
                    Total
                  </div>
                  <div style={{ 
                    fontSize: isMobile ? '1.5rem' : '2rem',
                    fontWeight: '700',
                    color: '#111827'
                  }}>
                    ${parseFloat(order.total_amount.toString()).toFixed(2)}
                  </div>
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

            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
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

export default KDS;
