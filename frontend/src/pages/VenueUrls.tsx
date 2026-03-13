import { useEffect, useState } from 'react';

interface VenueData {
  venueId: string;
  venueName: string;
  token: string;
  url: string;
}

/**
 * Page to display venue URLs with encrypted tokens
 * This page shows the 3 venue URLs that can be used for QR codes
 */
function VenueUrls() {
  const [venues, setVenues] = useState<VenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVenueTokens = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const response = await fetch(`${API_BASE}/venue/tokens`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch venue tokens');
        }
        
        const data = await response.json();
        if (data.success && data.venues) {
          setVenues(data.venues);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err: any) {
        console.error('Error fetching venue tokens:', err);
        setError(err.message || 'Failed to load venue URLs');
      } finally {
        setLoading(false);
      }
    };

    fetchVenueTokens();
  }, []);

  const copyToClipboard = (text: string, venueName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied ${venueName} URL to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
    });
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0e27',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #10b981',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#94a3b8' }}>Loading venue URLs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0e27',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Error</h2>
          <p style={{ color: '#94a3b8' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0e27',
      color: '#fff',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          marginBottom: '0.5rem',
          fontWeight: '700',
          color: '#fff'
        }}>
          Venue URLs
        </h1>
        <p style={{
          color: '#94a3b8',
          fontSize: '1.1rem',
          marginBottom: '3rem'
        }}>
          Use these encrypted URLs for QR codes at each venue
        </p>

        <div style={{
          display: 'grid',
          gap: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))'
        }}>
          {venues.map(venue => {

            return (
              <div key={venue.venueId} style={{
                backgroundColor: '#1a1f3a',
                borderRadius: '16px',
                padding: '2rem',
                border: '2px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <div>
                    <h2 style={{
                      fontSize: '1.5rem',
                      margin: 0,
                      fontWeight: '600',
                      color: '#fff'
                    }}>
                      {venue.venueName}
                    </h2>
                    <p style={{
                      color: '#64748b',
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.9rem'
                    }}>
                      Venue ID: {venue.venueId}
                    </p>
                  </div>
                  <div style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    Active
                  </div>
                </div>

                <div style={{
                  marginBottom: '1.5rem'
                }}>
                  <label style={{
                    display: 'block',
                    color: '#94a3b8',
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600'
                  }}>
                    Encrypted URL
                  </label>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    wordBreak: 'break-all',
                    fontSize: '0.9rem',
                    color: '#e2e8f0',
                    marginBottom: '1rem'
                  }}>
                    {venue.url}
                  </div>
                  <button
                    onClick={() => copyToClipboard(venue.url, venue.venueName)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }}
                  >
                    Copy URL
                  </button>
                </div>

                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.85rem',
                    color: '#94a3b8'
                  }}>
                    <strong style={{ color: '#60a5fa' }}>Token:</strong> {venue.token.substring(0, 20) + '...'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          backgroundColor: '#1a1f3a',
          borderRadius: '16px',
          border: '2px solid rgba(255,255,255,0.1)'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            marginBottom: '1rem',
            color: '#fff'
          }}>
            📋 Instructions
          </h3>
          <ul style={{
            color: '#94a3b8',
            lineHeight: '1.8',
            paddingLeft: '1.5rem'
          }}>
            <li>Each URL is encrypted with a unique token tied to the venue</li>
            <li>Use these URLs to generate QR codes for each location</li>
            <li>Tokens cannot be tampered with - backend validates on every request</li>
            <li>Share the appropriate URL with each venue location</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default VenueUrls;

