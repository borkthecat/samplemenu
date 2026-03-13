import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getAuthHeaders } from '../hooks/useAuth';
import { DownloadIcon, MoneyIcon, OrdersIcon, LogoutIcon } from '../components/icons';

interface PreviousDay {
  date: string;
  revenue: number;
  subtotal: number;
  gst: number;
  orders_count: number;
  closed_at: string;
}

interface VenueData {
  venue_id: string;
  venue_name: string;
  total_revenue: number;
  total_subtotal?: number;
  total_gst?: number;
  total_orders: number;
  today_revenue: number;
  today_subtotal?: number;
  today_gst?: number;
  today_orders: number;
  closing_time: string | null;
  is_closed?: boolean; // Explicit closed status from backend
  previous_days?: PreviousDay[];
}

interface Analytics {
  revenue: {
    total_revenue: string;
    total_subtotal?: string;
    total_gst?: string;
    total_orders: string;
  };
  today?: {
    today_revenue: string;
    today_subtotal?: string;
    today_gst?: string;
    today_orders: string;
  };
  venues?: VenueData[];
  dailyRevenue?: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
  recentOrders: Array<{
    id: number;
    order_number: string;
    venue_id?: string;
    table_number: string;
    payment_status?: string;
    total_amount: string;
    created_at: string;
  }>;
  previous_days?: PreviousDay[];
  is_closed?: boolean; // Closed status for manager view
}

function PartnerDashboard() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

    fetchAnalytics();
    
    // Auto-refresh analytics every 5 seconds to catch payment status updates quickly
    const interval = setInterval(() => {
      fetchAnalytics();
    }, 5000); // 5 seconds
    
    return () => clearInterval(interval);
  }, [user, token, authLoading, navigate]);

  const fetchAnalytics = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/partner/analytics?groupByDay=true`, {
        headers: getAuthHeaders(token),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Analytics data received:', data);
        setAnalytics(data);
      } else {
        console.error('Analytics API returned error:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseVenue = async (venueId: string) => {
    const venueName = venueId === '001' ? 'PROOST' : venueId === '002' ? 'THE PUBLIC HOUSE' : 'ROCKSHOTS';
    if (!confirm(`Close ${venueName}? Today's revenue will be logged and revenue tracking will reset.`)) {
      return;
    }

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/partner/close-venue`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ venueId }),
      });

      if (response.ok) {
        const data = await response.json();
        fetchAnalytics();
        if (data.daily_revenue) {
          alert(`${venueName} closed.\n\nToday's Revenue:\nSubtotal: $${data.daily_revenue.subtotal}\nGST (9%): $${data.daily_revenue.gst}\nTotal: $${data.daily_revenue.revenue}\nOrders: ${data.daily_revenue.orders}\n\nRevenue tracking reset for new day.`);
        } else {
          alert(`${venueName} closed. Revenue tracking reset.`);
        }
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to close venue' }));
        alert(error.error || 'Failed to close venue');
      }
    } catch (error) {
      console.error('Error closing venue:', error);
      alert('Failed to close venue');
    }
  };

  const handleOpenVenue = async (venueId: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const response = await fetch(`${API_BASE}/partner/open-venue`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ venueId }),
      });

      if (response.ok) {
        fetchAnalytics();
        alert('Venue opened. Revenue tracking reset to 0 for new day. Previous days\' revenue is logged below.');
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to open venue' }));
        alert(error.error || 'Failed to open venue');
      }
    } catch (error) {
      console.error('Error opening venue:', error);
      alert('Failed to open venue');
    }
  };


  const handleExportCSV = async (venueId?: string) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const exportVenueId = venueId || user?.venue_id;
      const url = venueId 
        ? `${API_BASE}/partner/export/csv?venueId=${venueId}`
        : `${API_BASE}/partner/export/csv`;
      const response = await fetch(url, {
        headers: getAuthHeaders(token),
      });

      if (response.ok) {
        const dateStr = new Date().toISOString().split('T')[0];
        const venueNameMap: Record<string, string> = {
          '001': 'PROOST',
          '002': 'THE_PUBLIC_HOUSE',
          '003': 'ROCKSHOTS'
        };
        const venueSlug = venueNameMap[exportVenueId || ''] || exportVenueId || 'venue';
        const filename = `${venueSlug}_${dateStr}_revenuereport.csv`;

        const blob = await response.blob();
        const urlObj = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(urlObj);
        document.body.removeChild(a);
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to export CSV' }));
        alert(error.error || 'Failed to export CSV');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
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
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
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
          <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#212529', fontWeight: '700' }}>
            Partner Portal
          </h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#6c757d', fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
            Venue {user?.venue_id} • {user?.email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/partner/orders')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1f2937';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#111827';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <OrdersIcon size={18} />
            <span>View Orders</span>
          </button>
          <button
            onClick={logout}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5a6268';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#6c757d';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <LogoutIcon size={18} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div style={{ padding: isMobile ? '1rem' : '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center', 
          marginBottom: '2rem',
          gap: isMobile ? '1rem' : '0'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1.75rem' : '2.25rem', color: '#212529', fontWeight: '700' }}>Dashboard</h2>
            <p style={{ margin: '0.75rem 0 0 0', color: '#6c757d', fontSize: isMobile ? '0.95rem' : '1.05rem' }}>
              View your sales history and revenue
            </p>
          </div>
          {user?.role !== 'admin' && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleExportCSV()}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#111827',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1f2937';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#111827';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
              >
                <DownloadIcon size={20} />
                <span>Download CSV Report</span>
              </button>
            </div>
          )}
        </div>

        {loading && !analytics ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            color: '#6c757d'
          }}>
            <p>Loading analytics...</p>
          </div>
        ) : analytics ? (
          <>
            {user?.role === 'admin' && analytics.venues && (
              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1.5rem' : '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                marginBottom: '2rem'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#212529', fontWeight: '700' }}>
                  All Venues Overview
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Venue</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Today Revenue</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Total Revenue</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Today Orders</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6c757d', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.venues.map((venue) => (
                        <>
                          <tr key={venue.venue_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '6px',
                                backgroundColor: getVenueColor(venue.venue_id) + '20',
                                color: getVenueColor(venue.venue_id),
                                fontSize: '0.8125rem',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>
                                {venue.venue_name}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#111827', fontWeight: '600' }}>
                              ${venue.today_revenue.toFixed(2)}
                              {venue.today_subtotal && venue.today_gst && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '400', marginTop: '0.25rem' }}>
                                  <div>Sub: ${venue.today_subtotal.toFixed(2)}</div>
                                  <div>GST: ${venue.today_gst.toFixed(2)}</div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#111827' }}>
                              ${venue.total_revenue.toFixed(2)}
                              {venue.total_subtotal && venue.total_gst && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '400', marginTop: '0.25rem' }}>
                                  <div>Sub: ${venue.total_subtotal.toFixed(2)}</div>
                                  <div>GST: ${venue.total_gst.toFixed(2)}</div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280' }}>{venue.today_orders}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {venue.is_closed ? (
                                <span style={{ color: '#dc2626', fontWeight: '600' }}>Closed</span>
                              ) : (
                                <span style={{ color: '#059669', fontWeight: '600' }}>Open</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                                <button
                                  onClick={() => handleExportCSV(venue.venue_id)}
                                  style={{
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: '#111827',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}
                                  title="Download CSV"
                                >
                                <DownloadIcon size={14} />
                                CSV
                              </button>
                              {venue.is_closed ? (
                                <button
                                  onClick={() => handleOpenVenue(venue.venue_id)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#059669',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  Open
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCloseVenue(venue.venue_id)}
                                  style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '0.875rem'
                                  }}
                                >
                                  Close
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {venue.previous_days && venue.previous_days.length > 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '1rem', backgroundColor: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                              <div style={{ marginBottom: '0.75rem', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>
                                Previous Days' Revenue:
                              </div>
                              <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {venue.previous_days.map((day: PreviousDay) => (
                                  <div key={day.date} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: '#fff',
                                    borderRadius: '6px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '0.875rem'
                                  }}>
                                    <div>
                                      <span style={{ fontWeight: '600', color: '#111827' }}>
                                        {new Date(day.date).toLocaleDateString('en-US', { 
                                          weekday: 'short', 
                                          month: 'short', 
                                          day: 'numeric' 
                                        })}
                                      </span>
                                      <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>
                                        ({day.orders_count} orders)
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                      <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#6b7280' }}>
                                        <div>Sub: ${day.subtotal.toFixed(2)}</div>
                                        <div>GST: ${day.gst.toFixed(2)}</div>
                                      </div>
                                      <div style={{ fontWeight: '600', color: '#111827' }}>
                                        ${day.revenue.toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: isMobile ? '0.75rem' : '1.5rem', 
              marginBottom: '2rem' 
            }}>
              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1rem' : '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1.25rem', marginBottom: isMobile ? '0.75rem' : '1.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{
                    width: isMobile ? '40px' : '60px',
                    height: isMobile ? '40px' : '60px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e5e7eb'
                  }}>
                    <MoneyIcon size={isMobile ? 20 : 28} color="#374151" />
                  </div>
                  <h3 style={{ margin: 0, color: '#6c757d', fontSize: isMobile ? '0.7rem' : '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', textAlign: isMobile ? 'center' : 'left' }}>Today's Revenue</h3>
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '2rem', fontWeight: '600', color: '#111827', letterSpacing: '-0.5px', textAlign: isMobile ? 'center' : 'left' }}>
                  ${analytics.today ? parseFloat(analytics.today.today_revenue).toFixed(2) : '0.00'}
                </p>
                {analytics.today && analytics.today.today_subtotal && analytics.today.today_gst && (
                  <div style={{ marginTop: '0.75rem', fontSize: isMobile ? '0.75rem' : '0.875rem', color: '#6b7280', textAlign: isMobile ? 'center' : 'left' }}>
                    <div>Subtotal: ${parseFloat(analytics.today.today_subtotal).toFixed(2)}</div>
                    <div>GST (9%): ${parseFloat(analytics.today.today_gst).toFixed(2)}</div>
                  </div>
                )}
              </div>

              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1rem' : '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1.25rem', marginBottom: isMobile ? '0.75rem' : '1.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{
                    width: isMobile ? '40px' : '60px',
                    height: isMobile ? '40px' : '60px',
                    borderRadius: '12px',
                    backgroundColor: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e5e7eb'
                  }}>
                    <MoneyIcon size={isMobile ? 20 : 28} color="#374151" />
                  </div>
                  <h3 style={{ margin: 0, color: '#6c757d', fontSize: isMobile ? '0.7rem' : '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', textAlign: isMobile ? 'center' : 'left' }}>Total Revenue</h3>
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '2rem', fontWeight: '600', color: '#111827', letterSpacing: '-0.5px', textAlign: isMobile ? 'center' : 'left' }}>
                  ${parseFloat(analytics.revenue.total_revenue).toFixed(2)}
                </p>
              </div>

              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1rem' : '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1.25rem', marginBottom: isMobile ? '0.75rem' : '1.5rem', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{
                    width: isMobile ? '40px' : '60px',
                    height: isMobile ? '40px' : '60px',
                    borderRadius: '12px',
                    backgroundColor: '#f0f4f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <OrdersIcon size={isMobile ? 20 : 28} color="#495057" />
                  </div>
                  <h3 style={{ margin: 0, color: '#6c757d', fontSize: isMobile ? '0.7rem' : '0.9rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', textAlign: isMobile ? 'center' : 'left' }}>Total Orders</h3>
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '2rem', fontWeight: '600', color: '#111827', letterSpacing: '-0.5px', textAlign: isMobile ? 'center' : 'left' }}>
                  {analytics.revenue.total_orders}
                </p>
              </div>
            </div>

            {/* Manager View: Open/Close Venue Controls */}
            {user?.role !== 'admin' && user?.venue_id && (
              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1.5rem' : '2rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                marginBottom: '2rem'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between', 
                  alignItems: isMobile ? 'flex-start' : 'center', 
                  gap: isMobile ? '1rem' : '0'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: isMobile ? '1.25rem' : '1.5rem', color: '#212529', fontWeight: '700', marginBottom: '0.5rem' }}>
                      Venue Status
                    </h3>
                    <p style={{ margin: 0, color: '#6c757d', fontSize: '0.95rem' }}>
                      {analytics.is_closed ? (
                        <span style={{ color: '#dc2626', fontWeight: '600' }}>Closed</span>
                      ) : (
                        <span style={{ color: '#059669', fontWeight: '600' }}>Open</span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {analytics.is_closed ? (
                      <button
                        onClick={() => handleOpenVenue(user.venue_id!)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#059669',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#047857';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#059669';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        Open Venue
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCloseVenue(user.venue_id!)}
                        style={{
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = '#b91c1c';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = '#dc2626';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        Close Venue
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {analytics.dailyRevenue && analytics.dailyRevenue.length > 0 && (
              <div style={{
                backgroundColor: '#fff',
                padding: isMobile ? '1.5rem' : '2.5rem',
                borderRadius: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: '1px solid #e9ecef',
                marginBottom: '2rem'
              }}>
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#212529', fontWeight: '700' }}>
                  Daily Revenue Breakdown
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ 
                          padding: '0.75rem', 
                          textAlign: 'left', 
                          color: '#6c757d', 
                          fontSize: '0.875rem', 
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Date
                        </th>
                        <th style={{ 
                          padding: '0.75rem', 
                          textAlign: 'right', 
                          color: '#6c757d', 
                          fontSize: '0.875rem', 
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Revenue
                        </th>
                        <th style={{ 
                          padding: '0.75rem', 
                          textAlign: 'right', 
                          color: '#6c757d', 
                          fontSize: '0.875rem', 
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Orders
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.dailyRevenue.map((day, index) => (
                        <tr 
                          key={day.date}
                          style={{ 
                            borderBottom: index < analytics.dailyRevenue!.length - 1 ? '1px solid #e5e7eb' : 'none',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <td style={{ 
                            padding: '0.75rem', 
                            color: '#111827',
                            fontSize: '0.9375rem',
                            fontWeight: '500'
                          }}>
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'right',
                            color: '#111827',
                            fontSize: '0.9375rem',
                            fontWeight: '600'
                          }}>
                            ${day.revenue.toFixed(2)}
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'right',
                            color: '#6b7280',
                            fontSize: '0.9375rem'
                          }}>
                            {day.orders}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{
              backgroundColor: '#fff',
              padding: isMobile ? '1.5rem' : '2.5rem',
              borderRadius: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center', 
                marginBottom: '1.5rem',
                gap: isMobile ? '1rem' : '0'
              }}>
                <h3 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '1.75rem', color: '#212529', fontWeight: '700' }}>Order History</h3>
                <button
                  onClick={() => navigate('/partner/orders')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#111827',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2937';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#111827';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  View All Orders →
                </button>
              </div>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {analytics.recentOrders && analytics.recentOrders.length > 0 ? (
                  analytics.recentOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/partner/orders`)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: isMobile ? '1.25rem' : '1.5rem',
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontSize: isMobile ? '1.1rem' : '1.15rem', 
                          color: '#111827', 
                          fontWeight: '600',
                          marginBottom: '0.5rem'
                        }}>
                          {order.order_number}
                        </div>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: '#6b7280', 
                          marginBottom: '0.25rem' 
                        }}>
                          {order.table_number}
                        </div>
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: '#9ca3af' 
                        }}>
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ 
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '0.5rem'
                      }}>
                        <div style={{ 
                          fontWeight: '600', 
                          fontSize: isMobile ? '1.1rem' : '1.25rem', 
                          color: '#111827'
                        }}>
                          ${parseFloat(order.total_amount).toFixed(2)}
                        </div>
                        <div style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Paid
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 2rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9375rem' }}>
                      No paid orders yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ 
            backgroundColor: '#fff',
            padding: '2rem',
            borderRadius: '16px',
            textAlign: 'center',
            color: '#6c757d'
          }}>
            <p>No analytics data available. Please check your connection or try refreshing the page.</p>
          </div>
        )}
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

export default PartnerDashboard;

