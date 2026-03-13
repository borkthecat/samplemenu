
interface ReceiptPrintProps {
  order: {
    id: number;
    order_number: string;
    venue_id?: string;
    venue_name?: string;
    table_number: string;
    customer_name?: string | null;
    phone_number?: string | null;
    total_amount: number | string;
    created_at: string;
    items: Array<{
      menu_item_id: number;
      menu_item_title?: string;
      quantity: number;
      price: number | string;
      subtotal: number | string;
      doneness?: string | null;
    }>;
  };
  onClose: () => void;
}

export function ReceiptPrint({ order, onClose }: ReceiptPrintProps) {
  const venueName = order.venue_name || (order.venue_id === '001' ? 'PROOST' : order.venue_id === '002' ? 'THE PUBLIC HOUSE' : order.venue_id === '003' ? 'ROCKSHOTS' : order.venue_id || 'Restaurant');
  const restaurantName = 'Rare & Refine';
  const uen = '202518001G';
  
  // Calculate GST breakdown
  // Items are stored with base prices (without GST)
  // Subtotal = sum of all item subtotals (base prices)
  // GST = 9% of subtotal
  // Total = subtotal + GST
  const GST_RATE = 0.09;
  const subtotal = order.items.reduce((sum: number, item: any) => {
    const itemSubtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) : item.subtotal;
    return sum + itemSubtotal;
  }, 0);
  const gstAmount = subtotal * GST_RATE;
  const calculatedTotal = subtotal + gstAmount;
  
  const printReceipt = () => {
    // Detect iOS/iPad specifically (Safari on iOS)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+ detection
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check if popups are blocked
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (isIOS) {
        alert('Popup blocked! For iPad printing:\n\n1. Make sure you\'re using Safari (not Chrome)\n2. Go to Settings → Safari → Block Pop-ups (turn OFF)\n3. Try printing again');
      } else {
        alert('Popup blocked! Please allow popups for this site to print receipts.\n\nTo fix:\n1. Click the popup blocker icon in your browser address bar\n2. Or go to browser settings and allow popups for this site');
      }
      console.error('❌ Print failed: Popup blocked by browser');
      return;
    }

    // Add error handling
    try {
      const itemsHtml = order.items.map(item => {
      const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
      const subtotal = typeof item.subtotal === 'string' ? parseFloat(item.subtotal) : item.subtotal;
      return `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px dotted #ddd;">
            <div style="font-weight: 600; margin-bottom: 2px; font-size: 12px;">${item.menu_item_title || `Item #${item.menu_item_id}`}</div>
            ${item.doneness ? `<div style="font-size: 10px; color: #1a1a1a; font-weight: 600; margin-bottom: 2px;">Doneness: ${item.doneness}</div>` : ''}
            <div style="font-size: 11px; color: #666;">${item.quantity} × S$${price.toFixed(2)}</div>
          </td>
          <td style="text-align: right; padding: 6px 0; border-bottom: 1px dotted #ddd; font-weight: 600; font-size: 12px;">
            S$${subtotal.toFixed(2)}
          </td>
        </tr>
      `;
    }).join('');

    const date = new Date(order.created_at);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt - ${order.order_number}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 10mm;
              }
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', 'Courier', monospace;
              font-size: 12px;
              line-height: 1.4;
              max-width: 300px;
              margin: 0 auto;
              padding: 20px;
              color: #000;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            .logo {
              text-align: center;
              margin-bottom: 20px;
              padding: 10px;
            }
            .logo img {
              max-width: 150px;
              max-height: 80px;
              object-fit: contain;
              display: block;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .venue-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 15px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            .total-row {
              border-top: 2px solid #000;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="logo" style="text-align: center; margin-bottom: 15px;">
            <img src="/logo.png" alt="Logo" style="max-width: 120px; max-height: 60px; object-fit: contain; display: block; margin: 0 auto 10px;" onerror="this.style.display='none';">
            <div style="font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 5px;">${restaurantName}</div>
            <div style="font-size: 11px; text-align: center; color: #666;">UEN: ${uen}</div>
          </div>
          <div class="header" style="text-align: center; margin-bottom: 15px; font-size: 12px;">
            <div style="font-weight: 600; margin-bottom: 3px;">${venueName}</div>
            <div style="margin-bottom: 2px;">Order #${order.order_number.split('-')[1] || order.order_number}</div>
            <div style="margin-bottom: 2px;">${dateStr} ${timeStr}</div>
            <div style="margin-bottom: 2px;">${order.table_number}</div>
            ${order.customer_name ? `<div style="margin-bottom: 2px;">Customer: ${order.customer_name}</div>` : ''}
            ${order.phone_number ? `<div style="margin-bottom: 2px;">Phone: ${order.phone_number}</div>` : ''}
          </div>
          <div class="divider"></div>
          <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
            ${itemsHtml}
          </table>
          <div class="divider"></div>
          <div style="margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
              <span>Subtotal:</span>
              <span>S$${subtotal.toFixed(2)}</span>
            </div>
            <div style="margin-top: 8px; margin-bottom: 5px;">
              <div style="font-size: 11px; font-weight: 600; margin-bottom: 3px;">Charges:</div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-left: 10px;">
                <span>GST, 9%:</span>
                <span>S$${gstAmount.toFixed(2)}</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 10px; padding-top: 8px; border-top: 1px solid #000;">
              <span>Total:</span>
              <span>S$${calculatedTotal.toFixed(2)}</span>
            </div>
          </div>
          <div class="footer" style="text-align: center; margin-top: 20px; font-size: 10px; color: #666;">
            <div style="margin-bottom: 5px;">Thank you for dining with us!</div>
            <div style="margin-top: 10px; font-size: 9px;">${dateStr}</div>
          </div>
        </body>
      </html>
    `;

    // For iOS/iPad: Special handling for Safari AirPrint
    if (isIOS) {
      printWindow.document.open();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      
      // iOS Safari needs more time and specific handling
      const waitForIOSLoad = () => {
        // Check if document is ready
        if (printWindow.document.readyState === 'complete' || printWindow.document.readyState === 'interactive') {
          // Additional delay for iOS to render content
          setTimeout(() => {
            tryIOSPrint();
          }, 300);
        } else {
          // Wait for load event
          printWindow.addEventListener('load', () => {
            setTimeout(() => {
              tryIOSPrint();
            }, 300);
          }, { once: true });
          // Fallback timeout (longer for iOS)
          setTimeout(() => {
            tryIOSPrint();
          }, 2000);
        }
      };
      
      const tryIOSPrint = () => {
        try {
          printWindow.focus();
          
          if (typeof printWindow.print !== 'function') {
            console.error('❌ Print failed: print() function not available on iOS');
            alert('Printing is not available. Please make sure you\'re using Safari on iPad, and that AirPrint is enabled in Settings → General → AirPrint.');
            printWindow.close();
            return;
          }
          
          // iOS needs a small delay before calling print()
          setTimeout(() => {
            try {
              printWindow.print();
              console.log('✅ Print dialog opened successfully (iOS/iPad)');
              
              // Don't close immediately on iOS - let user interact with AirPrint dialog
              setTimeout(() => {
                printWindow.close();
              }, 3000);
            } catch (printError) {
              console.error('❌ iOS print error:', printError);
              alert('Failed to print on iPad.\n\nSolutions:\n1. Use Safari (not Chrome)\n2. Printer must support AirPrint OR be on same Wi-Fi\n3. Go to Settings → General → AirPrint (should be enabled)\n4. If printer doesn\'t support AirPrint, use a print server app\n5. Make sure printer and iPad are on same Wi-Fi network');
              printWindow.close();
            }
          }, 200);
        } catch (error) {
          console.error('❌ iOS print setup error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert('Failed to setup print on iPad. Please try again.\n\nError: ' + errorMessage);
          printWindow.close();
        }
      };
      
      waitForIOSLoad();
    } 
    // For Android and other mobile devices
    else if (isMobile) {
      printWindow.document.open();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      
      // Wait for DOM to be ready on mobile
      const waitForLoad = () => {
        if (printWindow.document.readyState === 'complete') {
          tryPrint();
        } else {
          printWindow.addEventListener('load', tryPrint, { once: true });
          // Fallback timeout
          setTimeout(tryPrint, 1000);
        }
      };
      
      const tryPrint = () => {
        try {
          printWindow.focus();
          
          if (typeof printWindow.print !== 'function') {
            console.error('❌ Print failed: print() function not available');
            alert('Printing is not available in this browser.\n\nFor Android:\n• Use Chrome browser\n• Make sure printer is connected via Wi-Fi/Network\n• Or use a print app like "Print Service Plugin"\n\nFor iPad:\n• Use Safari browser\n• Printer must support AirPrint or be on network');
            printWindow.close();
            return;
          }
          
          // Small delay to ensure content is rendered
          setTimeout(() => {
            try {
              printWindow.print();
              console.log('✅ Print dialog opened successfully (Android)');
              
              // Close window after longer delay on mobile
              setTimeout(() => {
                printWindow.close();
              }, 2000);
            } catch (printError) {
              console.error('❌ Android print error:', printError);
              alert('Failed to print on Android.\n\nCommon solutions:\n1. Make sure printer is on same Wi-Fi network\n2. Install "Print Service Plugin" from Play Store\n3. Or connect printer via USB to a computer and share it\n4. Try using Chrome browser (not other browsers)');
              printWindow.close();
            }
          }, 100);
        } catch (error) {
          console.error('❌ Print setup error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert('Failed to setup print on Android.\n\nPlease ensure:\n• Printer is connected to Wi-Fi network\n• Using Chrome browser\n• Printer appears in Android print settings\n\nError: ' + errorMessage);
          printWindow.close();
        }
      };
      
      waitForLoad();
    } else {
      // Desktop: use document.write (original method)
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      
      // Wait for content to load, then print
      setTimeout(() => {
        try {
          printWindow.focus();
          
          if (typeof printWindow.print !== 'function') {
            console.error('❌ Print failed: print() function not available');
            alert('Printing is not available in this browser. Please try a different browser (Chrome, Edge, or Firefox).');
            printWindow.close();
            return;
          }
          
          printWindow.print();
          
          setTimeout(() => {
            printWindow.close();
          }, 1000);
          
          console.log('✅ Print dialog opened successfully');
        } catch (error) {
          console.error('❌ Print error:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          alert('Failed to open print dialog. Please check your browser settings and try again.\n\nError: ' + errorMessage);
          printWindow.close();
        }
      }, 500);
    }
    
    onClose();
    } catch (error) {
      console.error('❌ Error creating print window:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert('Failed to create print window. Please try again.\n\nError: ' + errorMessage);
      if (printWindow) {
        printWindow.close();
      }
    }
  };

  return (
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '700' }}>Print Receipt</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: '#6b7280' }}>
          Order #{order.order_number.split('-')[1] || order.order_number} - {order.table_number}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#f3f4f6',
              color: '#111827',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Cancel
          </button>
          <button
            onClick={printReceipt}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

