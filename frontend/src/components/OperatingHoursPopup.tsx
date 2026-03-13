import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../utils/api';

const OPERATING_HOURS_KEY = 'operating_hours_seen';

interface OperatingHours {
  closed_all_day?: boolean;
  mon_thu_sat: { hours: string; last_order: string };
  friday: { hours: string; last_order: string };
}

function OperatingHoursPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [hours, setHours] = useState<OperatingHours | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Only show popup on menu page with venue parameter (e.g., /menu?venue=001)
    // Never show on partner portal, KDS, or other pages
    if (location.pathname !== '/menu') {
      return;
    }
    
    const searchParams = new URLSearchParams(location.search);
    
    // Check for venue slug (proost, thepublichouse, rockshots) or venue ID
    let venueId: string | null = null;
    const venueSlugMap: Record<string, string> = {
      'proost': '001',
      'thepublichouse': '002',
      'publichouse': '002',
      'rockshots': '003'
    };
    
    for (const [slug, id] of Object.entries(venueSlugMap)) {
      if (searchParams.has(slug)) {
        venueId = id;
        break;
      }
    }
    
    if (!venueId) {
      venueId = searchParams.get('venue');
    }
    
    // If no venue parameter, don't show popup
    if (!venueId) {
      return;
    }

    // Always fetch operating hours from WordPress for this venue (so updates are reflected)
    api.getOperatingHours(venueId)
      .then((data) => {
        setHours(data);
        console.log('Operating hours fetched:', data);
        
        // Check if user has seen the popup for this venue before
        const hasSeenPopup = localStorage.getItem(`${OPERATING_HOURS_KEY}_${venueId}`);
        
        if (!hasSeenPopup) {
          // Show popup after a short delay for better UX
          setTimeout(() => {
            setShowPopup(true);
          }, 500);
        }
      })
      .catch((error) => {
        console.error('Failed to fetch operating hours:', error);
        // Use default hours if fetch fails
        const defaultHours = {
          closed_all_day: false,
          mon_thu_sat: { hours: '3:00 PM - 11:00 PM', last_order: '10:45 PM' },
          friday: { hours: '3:00 PM - 1:00 AM', last_order: '12:45 AM' }
        };
        setHours(defaultHours);
        
        // Check if user has seen the popup for this venue before
        const hasSeenPopup = localStorage.getItem(`${OPERATING_HOURS_KEY}_${venueId}`);
        
        if (!hasSeenPopup) {
          // Show popup after a short delay for better UX
          setTimeout(() => {
            setShowPopup(true);
          }, 500);
        }
      });
  }, [location.search]);

  // Don't render if no venue parameter
  const searchParams = new URLSearchParams(location.search);
  let venueId: string | null = null;
  const venueSlugMap: Record<string, string> = {
    'proost': '001',
    'thepublichouse': '002',
    'publichouse': '002',
    'rockshots': '003'
  };
  
  for (const [slug, id] of Object.entries(venueSlugMap)) {
    if (searchParams.has(slug)) {
      venueId = id;
      break;
    }
  }
  
  if (!venueId) {
    venueId = searchParams.get('venue');
  }
  
  if (!venueId || !hours) {
    return null;
  }

  const handleClose = () => {
    setShowPopup(false);
    // Mark as seen for this venue so it doesn't show again
    localStorage.setItem(`${OPERATING_HOURS_KEY}_${venueId}`, 'true');
  };

  // Get current day in Singapore timezone
  const getCurrentDay = () => {
    const singaporeTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
    const day = new Date(singaporeTime).getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    return day;
  };

  const currentDay = getCurrentDay();
  const isFriday = currentDay === 5;
  const isMonThuSat = currentDay === 1 || currentDay === 4 || currentDay === 6; // Monday, Thursday, or Saturday
  const isClosedAllDay = !!hours.closed_all_day;

  if (!showPopup || !hours) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderRadius: '20px',
          padding: '0',
          maxWidth: '360px',
          width: '100%',
          boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.3s ease-out',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative top accent */}
        <div style={{
          height: '4px',
          background: 'linear-gradient(90deg, #1a1a1a 0%, #c9a962 50%, #1a1a1a 100%)',
          width: '100%'
        }}></div>

        {/* Content */}
        <div style={{ padding: '1.75rem 1.5rem 1.5rem 1.5rem' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{
              margin: 0,
              fontSize: '1.375rem',
              fontWeight: '700',
              color: '#212529',
              letterSpacing: '-0.3px'
            }}>
              Operating Hours
            </h2>
          </div>

          {/* Hours Cards */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            {isClosedAllDay ? (
              <div style={{
                backgroundColor: '#fff5f0',
                borderRadius: '12px',
                padding: '1.25rem',
                border: '1.5px solid #1a1a1a',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(26, 26, 26, 0.15)'
              }}>
                <div style={{
                  fontSize: '1rem',
                  color: '#1a1a1a',
                  fontWeight: '700',
                  marginBottom: '0.5rem'
                }}>
                  Currently Closed
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#6c757d',
                  fontWeight: '500'
                }}>
                  Please check back later.
                </div>
              </div>
            ) : (
              <>
                {/* Monday-Thursday & Saturday Card */}
                <div style={{
                  backgroundColor: isMonThuSat ? '#fff5f0' : '#f8f9fa',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: isMonThuSat ? '1.5px solid #1a1a1a' : '1px solid #f0f0f0',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isMonThuSat ? '0 4px 16px rgba(26, 26, 26, 0.15)' : 'none'
                }}>
                  {/* Decorative corner accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '50px',
                    height: '50px',
                    background: isMonThuSat 
                      ? 'linear-gradient(135deg, rgba(26, 26, 26, 0.15) 0%, transparent 100%)'
                      : 'linear-gradient(135deg, rgba(26, 26, 26, 0.08) 0%, transparent 100%)',
                    borderRadius: '0 12px 0 100%'
                  }}></div>
                  
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: isMonThuSat ? '#1a1a1a' : '#212529',
                      letterSpacing: '0.2px',
                      marginBottom: '0.75rem'
                    }}>
                      Monday - Thursday & Saturday
                      {isMonThuSat && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.6875rem',
                          backgroundColor: '#1a1a1a',
                          color: 'white',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          Today
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#212529',
                      fontWeight: '600',
                      marginBottom: '0.375rem'
                    }}>
                      {hours.mon_thu_sat.hours}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#1a1a1a"/>
                      </svg>
                      Last Order: {hours.mon_thu_sat.last_order}
                    </div>
                  </div>
                </div>

                {/* Friday Card */}
                <div style={{
                  backgroundColor: isFriday ? '#fff5f0' : '#f8f9fa',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  border: isFriday ? '1.5px solid #1a1a1a' : '1px solid #f0f0f0',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isFriday ? '0 4px 16px rgba(26, 26, 26, 0.15)' : 'none'
                }}>
                  {/* Decorative corner accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '50px',
                    height: '50px',
                    background: isFriday
                      ? 'linear-gradient(135deg, rgba(26, 26, 26, 0.15) 0%, transparent 100%)'
                      : 'linear-gradient(135deg, rgba(26, 26, 26, 0.08) 0%, transparent 100%)',
                    borderRadius: '0 12px 0 100%'
                  }}></div>
                  
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: isFriday ? '#1a1a1a' : '#212529',
                      letterSpacing: '0.2px',
                      marginBottom: '0.75rem'
                    }}>
                      Friday
                      {isFriday && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.6875rem',
                          backgroundColor: '#1a1a1a',
                          color: 'white',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}>
                          Today
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#212529',
                      fontWeight: '600',
                      marginBottom: '0.375rem'
                    }}>
                      {hours.friday.hours}
                    </div>
                    <div style={{
                      fontSize: '0.8125rem',
                      color: '#1a1a1a',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#1a1a1a"/>
                      </svg>
                      Last Order: {hours.friday.last_order}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #c9a962 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: '600',
              boxShadow: '0 4px 16px rgba(26, 26, 26, 0.3)',
              transition: 'all 0.2s',
              letterSpacing: '0.2px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(26, 26, 26, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #c9a962 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(26, 26, 26, 0.3)';
            }}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

export default OperatingHoursPopup;

