import { useState, useRef, useEffect } from 'react';
import { useVenue } from '../hooks/useVenue';
import { useMenu } from '../hooks/useMenu';
import { useCart } from '../hooks/useCart';
import { getCurrentToken, getCurrentVenue, getCurrentTable } from '../utils/venueDetector';
import type { MenuItem } from '../utils/api';
import { formatCategoryName } from '../utils/formatCategory';
import { sortCategories, getCategorySlug, getCanonicalCategoryName } from '../utils/categorySort';
import plusIcon from '../assets/plus-icon.svg';
import closeIcon from '../assets/close-icon.svg';

function MenuPage() {
  const { venueId } = useVenue();
  // Check for token or venue ID
  const token = getCurrentToken();
  const venue = getCurrentVenue();
  const hasVenueOrToken = !!(token || venue || venueId);
  
  const { menuItems, loading, error } = useMenu(venueId);
  const { addToCart } = useCart(venueId || venue);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [isVenueClosed] = useState(false);
  const [donenessModal, setDonenessModal] = useState<{ item: MenuItem; fromDetail?: boolean } | null>(null);
  const [selectedDoneness, setSelectedDoneness] = useState<string>('');
  
  // Category scroll handler - MUST be before any early returns
  const categoryContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Read table number from URL on component mount
  useEffect(() => {
    const table = getCurrentTable();
    if (table) {
      setTableNumber(table);
    }
  }, []);
  
  // Scroll to selected category when it changes
  useEffect(() => {
    if (categoryContainerRef.current && selectedCategory) {
      const selectedButton = categoryContainerRef.current.querySelector(`[data-category="${selectedCategory}"]`) as HTMLElement;
      if (selectedButton) {
        selectedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedCategory]);

  if (!hasVenueOrToken) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <h1 style={{ color: '#333', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '600' }}>Venue not found</h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>Please scan a valid QR code or include ?venue=XXX or ?token=XXX in the URL</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
      }}>
        <div>
          <div style={{ 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #1a1a1a',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#666', fontSize: '1rem' }}>Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#fff' }}>
        <div style={{ 
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>Error loading menu</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem', fontSize: '0.95rem' }}>{error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#1a1a1a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Check if item requires doneness selection
  const requiresDoneness = (item: MenuItem): boolean => {
    if (!item || !item.name) return false;
    const itemName = item.name.toLowerCase();
    // Match "steak" with "roasted" (potatoes or tomatoes) - flexible matching
    const hasSteak = itemName.includes('steak');
    const hasRoasted = itemName.includes('roasted');
    const result = hasSteak && hasRoasted;
    console.log('🔍 requiresDoneness check:', { itemName, hasSteak, hasRoasted, result });
    return result;
  };

  const handleAddToCart = (item: MenuItem, fromDetail: boolean = false) => {
    if (isVenueClosed) return; // Prevent adding to cart if venue is closed
    
    console.log('🔍 Checking item:', item.name, 'requiresDoneness:', requiresDoneness(item));
    
    // If item requires doneness, show modal
    if (requiresDoneness(item)) {
      console.log('✅ Opening doneness modal for:', item.name);
      setDonenessModal({ item, fromDetail });
      setSelectedDoneness('');
      return;
    }
    
    // Otherwise, add directly to cart
    console.log('➕ Adding to cart directly:', item.name);
    addToCart(item);
    
    // Close detail modal if it was open
    if (fromDetail) {
      setSelectedItem(null);
    }
  };

  const handleConfirmDoneness = () => {
    if (!donenessModal || !selectedDoneness) {
      alert('Please select a doneness level');
      return;
    }
    
    addToCart(donenessModal.item, 1, selectedDoneness);
    setDonenessModal(null);
    setSelectedDoneness('');
    
    // Close detail modal if it was open
    if (donenessModal.fromDetail) {
      setSelectedItem(null);
    }
  };

  const itemsByCategory = menuItems.reduce((acc, item) => {
    const originalCategory = item.category || 'other';
    const categorySlug = getCategorySlug(originalCategory);
    if (!acc[categorySlug]) {
      acc[categorySlug] = {
        items: [],
        displayName: getCanonicalCategoryName(originalCategory)
      };
    }
    acc[categorySlug].items.push(item);
    return acc;
  }, {} as Record<string, { items: MenuItem[]; displayName: string }>);

  // Get all categories and sort them (Starters first, Birthday Cake last)
  const categorySlugs = sortCategories(Object.keys(itemsByCategory));
  
  // Set default selected category if none selected
  if (!selectedCategory && categorySlugs.length > 0) {
    setSelectedCategory(categorySlugs[0]);
  }

  // Get items for selected category
  const displayedItems = selectedCategory ? itemsByCategory[selectedCategory]?.items || [] : [];

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#fff'
    }}>
      {/* Header with Cart */}
      <header style={{ 
        backgroundColor: '#fff',
        borderBottom: '1px solid #e9ecef',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '1rem 1rem 0.75rem 1rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: tableNumber ? '1rem' : '0.75rem',
          width: '100%',
          position: 'relative',
          minHeight: '40px'
        }}>
          {tableNumber ? (
            <div style={{
              fontSize: '0.8125rem',
              color: '#495057',
              fontWeight: '600',
              padding: '0.5rem 1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              whiteSpace: 'nowrap',
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              <span>{tableNumber}</span>
            </div>
          ) : null}
          <h1 style={{ 
            margin: 0, 
            fontSize: '1.5rem',
            color: '#1a1a1a',
            fontWeight: '600',
            width: '100%',
            textAlign: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            letterSpacing: '0.05em'
          }}>Menu</h1>
        </div>

        {/* Category Tabs */}
        <div 
          ref={(node) => { categoryContainerRef.current = node; }}
          className="category-scroll"
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            gap: '0.5rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            paddingBottom: '0.75rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <style>{`
            .category-scroll::-webkit-scrollbar {
              display: none;
            }
            .category-scroll {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
          `}</style>
          {categorySlugs.map((categorySlug) => {
            const categoryData = itemsByCategory[categorySlug];
            const displayName = categoryData?.displayName || categorySlug;
            return (
              <button
                key={categorySlug}
                data-category={categorySlug}
                onClick={() => {
                  setSelectedCategory(categorySlug);
                  // Scroll to selected category
                  if (categoryContainerRef.current) {
                    const button = categoryContainerRef.current.querySelector(`[data-category="${categorySlug}"]`) as HTMLElement;
                    if (button) {
                      const container = categoryContainerRef.current;
                      const buttonLeft = button.offsetLeft;
                      const buttonWidth = button.offsetWidth;
                      const containerWidth = container.offsetWidth;
                      const scrollLeft = container.scrollLeft;
                      const buttonCenter = buttonLeft + buttonWidth / 2;
                      const containerCenter = scrollLeft + containerWidth / 2;
                      const scrollTo = scrollLeft + (buttonCenter - containerCenter);
                      
                      container.scrollTo({
                        left: scrollTo,
                        behavior: 'smooth'
                      });
                    }
                  }
                }}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: selectedCategory === categorySlug ? '#c9a962' : 'transparent',
                  color: selectedCategory === categorySlug ? '#fff' : '#666',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: selectedCategory === categorySlug ? '600' : '500',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
                onMouseOver={(e) => {
                  if (selectedCategory !== categorySlug) {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedCategory !== categorySlug) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {formatCategoryName(displayName)}
              </button>
            );
          })}
        </div>
      </header>

      {/* Menu Items Grid */}
      <main style={{ 
        padding: '1rem',
        maxWidth: '100%'
      }}>
        {displayedItems.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#666'
          }}>
            <p style={{ fontSize: '1rem' }}>No items in this category.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem'
          }}>
            {displayedItems.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                style={{ 
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  position: 'relative',
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  transform: selectedItem?.id === item.id ? 'scale(0.98)' : 'scale(1)'
                }}
                onMouseOver={(e) => {
                  if (selectedItem?.id !== item.id) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedItem?.id !== item.id) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                {/* Image */}
                <div style={{
                  width: '100%',
                  height: '140px',
                  overflow: 'hidden',
                  backgroundColor: '#f8f9fa',
                  position: 'relative'
                }}>
                  {item.image_url ? (
                    <img 
                      src={item.image_url} 
                      alt={item.name}
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
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 12H5M5 12C5 13.5913 5.63214 15.1174 6.75736 16.2426C7.88258 17.3679 9.4087 18 11 18C12.5913 18 14.1174 17.3679 15.2426 16.2426C16.3679 15.1174 17 13.5913 17 12M5 12C5 10.4087 5.63214 8.88258 6.75736 7.75736C7.88258 6.63214 9.4087 6 11 6C12.5913 6 14.1174 6.63214 15.2426 7.75736C16.3679 8.88258 17 10.4087 17 12M17 12H21M9 3V7M9 17V21M15 3V7M15 17V21" stroke="#dee2e6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                  
                  {/* Circular Add Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(item);
                    }}
                    style={{
                      position: 'absolute',
                      bottom: '0.75rem',
                      right: '0.75rem',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#1a1a1a',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(26, 26, 26, 0.4)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      zIndex: 10
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 26, 26, 0.5)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(26, 26, 26, 0.4)';
                    }}
                  >
                    <img src={plusIcon} alt="Add" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)' }} />
                  </button>
                </div>

                {/* Content */}
                <div style={{
                  padding: '0.75rem'
                }}>
                  <h3 style={{
                    margin: '0 0 0.25rem 0',
                    fontSize: '0.9375rem',
                    fontWeight: '600',
                    color: '#212529',
                    lineHeight: '1.3',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {item.name}
                  </h3>
                  <p style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '0.75rem',
                    color: '#6c757d',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: '2.4em'
                  }}>
                    {item.description || 'Delicious food item'}
                  </p>
                  <div style={{
                    fontSize: '0.9375rem',
                    fontWeight: '600',
                    color: '#212529'
                  }}>
                    ${parseFloat(item.price.toString()).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
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

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out',
            overflowY: 'auto'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              animation: 'slideUp 0.3s ease-out',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
            >
              <img src={closeIcon} alt="Close" style={{ width: '20px', height: '20px' }} />
            </button>

            {/* Image */}
            <div style={{
              width: '100%',
              height: '250px',
              overflow: 'hidden',
              backgroundColor: '#f8f9fa',
              position: 'relative'
            }}>
              {selectedItem.image_url ? (
                <img 
                  src={selectedItem.image_url} 
                  alt={selectedItem.name}
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
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 12H5M5 12C5 13.5913 5.63214 15.1174 6.75736 16.2426C7.88258 17.3679 9.4087 18 11 18C12.5913 18 14.1174 17.3679 15.2426 16.2426C16.3679 15.1174 17 13.5913 17 12M5 12C5 10.4087 5.63214 8.88258 6.75736 7.75736C7.88258 6.63214 9.4087 6 11 6C12.5913 6 14.1174 6.63214 15.2426 7.75736C16.3679 8.88258 17 10.4087 17 12M17 12H21M9 3V7M9 17V21M15 3V7M15 17V21" stroke="#dee2e6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              {/* Name and Price */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.75rem'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#212529',
                  lineHeight: '1.3',
                  flex: 1,
                  paddingRight: '1rem'
                }}>
                  {selectedItem.name}
                </h2>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1a1a1a',
                  whiteSpace: 'nowrap'
                }}>
                  ${parseFloat(selectedItem.price.toString()).toFixed(2)}
                </div>
              </div>

              {/* Subheader if available */}
              {selectedItem.subheader && (
                <p style={{
                  margin: '0 0 1rem 0',
                  fontSize: '0.875rem',
                  color: '#1a1a1a',
                  fontWeight: '500',
                  fontStyle: 'italic'
                }}>
                  {selectedItem.subheader}
                </p>
              )}

              {/* Description */}
              <div style={{
                marginBottom: '2rem',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid #f0f0f0'
              }}>
                <p style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  color: '#666',
                  lineHeight: '1.6'
                }}>
                  {selectedItem.description || 'No description available.'}
                </p>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart(selectedItem, true);
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
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
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
                <img src={plusIcon} alt="Add" style={{ width: '20px', height: '20px', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doneness Selection Modal */}
      {donenessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: '#111827'
            }}>
              Select Doneness
            </h3>
            <p style={{ 
              margin: '0 0 1.5rem 0', 
              color: '#6b7280',
              fontSize: '1rem'
            }}>
              {donenessModal.item.name}
            </p>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Doneness Level *
              </label>
              <select
                value={selectedDoneness}
                onChange={(e) => setSelectedDoneness(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  color: '#111827',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#1a1a1a';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                }}
              >
                <option value="">-- Select Doneness --</option>
                <option value="RARE">RARE</option>
                <option value="MEDIUM RARE">MEDIUM RARE</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="WELL DONE">WELL DONE</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setDonenessModal(null);
                  setSelectedDoneness('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#f3f4f6',
                  color: '#111827',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDoneness}
                disabled={!selectedDoneness}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: selectedDoneness ? '#1a1a1a' : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedDoneness ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: 'background-color 0.2s'
                }}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuPage;
