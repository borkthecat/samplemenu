import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { useVenue } from './hooks/useVenue';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmation from './pages/OrderConfirmation';
import KDS from './pages/KDS';
import KDSAll from './pages/KDSAll';
import PartnerLogin from './pages/PartnerLogin';
import PartnerDashboard from './pages/PartnerDashboard';
import PartnerOrders from './pages/PartnerOrders';
// import PartnerForgotPassword from './pages/PartnerForgotPassword'; // Disabled - backend code kept
// import PartnerResetPassword from './pages/PartnerResetPassword'; // Disabled - backend code kept
import VenueUrls from './pages/VenueUrls';
import FloatingCart from './components/FloatingCart';
import OperatingHoursPopup from './components/OperatingHoursPopup';

function AppRoutes() {
  const { venueId, loading } = useVenue();
  const location = useLocation();
  const showFloatingCart = location.pathname.startsWith('/menu') || location.pathname.startsWith('/cart') || location.pathname.startsWith('/checkout');
  const showOperatingHoursPopup = location.pathname === '/menu';

  const RequireVenue = ({ children }: { children: React.ReactNode }) => {
    if (!venueId) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h1>Venue not found</h1>
          <p>Please scan a valid QR code or include ?venue=XXX in the URL</p>
          <p style={{ marginTop: '1rem', color: '#666' }}>
            Example: <code>?venue=001</code>
          </p>
        </div>
      );
    }
    return <>{children}</>;
  };

  return (
    <>
      <Routes>
        {/* Consumer Routes */}
        <Route
          path="/menu"
          element={
            loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
            ) : (
              <RequireVenue>
                <MenuPage />
              </RequireVenue>
            )
          }
        />
        <Route
          path="/cart"
          element={
            loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
            ) : (
              <RequireVenue>
                <CartPage />
              </RequireVenue>
            )
          }
        />
        <Route
          path="/checkout"
          element={
            loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
            ) : (
              <RequireVenue>
                <CheckoutPage />
              </RequireVenue>
            )
          }
        />
        <Route
          path="/order-confirmation/:id"
          element={<OrderConfirmation />}
        />

        {/* KDS Routes */}
        <Route
          path="/kds"
          element={<KDS />}
        />
        <Route
          path="/kds/all"
          element={<KDSAll />}
        />

        {/* Partner Portal Routes */}
        <Route path="/partner/login" element={<PartnerLogin />} />
        {/* Forgot password routes disabled - backend code kept for future use */}
        {/* <Route path="/partner/forgot-password" element={<PartnerForgotPassword />} /> */}
        {/* <Route path="/partner/reset-password" element={<PartnerResetPassword />} /> */}
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/partner/orders" element={<PartnerOrders />} />

        {/* Venue URLs (for client display) */}
        <Route path="/venue-urls" element={<VenueUrls />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/menu" replace />} />
      </Routes>
      {showFloatingCart && <FloatingCart />}
      {/* Only show operating hours popup on menu page (not cart, checkout, KDS, or Partner Portal) */}
      {showOperatingHoursPopup && <OperatingHoursPopup />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
