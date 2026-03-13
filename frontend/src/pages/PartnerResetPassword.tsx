import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function PartnerResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isMobile] = useState(window.innerWidth < 768);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Invalid reset link. Token is missing.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Password reset successfully!');
        setTimeout(() => {
          navigate('/partner/login');
        }, 2000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err: any) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fff',
      padding: '1rem',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: isMobile ? '2rem 1.5rem' : '3rem',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '440px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '2rem', 
            fontWeight: '700',
            color: '#212529',
            marginBottom: '0.5rem'
          }}>
            Reset Password
          </h1>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600',
              color: '#334155',
              fontSize: '0.9rem'
            }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter new password"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                backgroundColor: '#fff'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#111827';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(17, 24, 39, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              fontWeight: '600',
              color: '#334155',
              fontSize: '0.9rem'
            }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm new password"
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '1rem',
                transition: 'all 0.2s',
                boxSizing: 'border-box',
                backgroundColor: '#fff'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#111827';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(17, 24, 39, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.875rem 1rem',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '1px solid #fecaca',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              padding: '0.875rem 1rem',
              backgroundColor: '#dcfce7',
              color: '#166534',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              border: '1px solid #bbf7d0',
              fontSize: '0.9rem'
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              backgroundColor: (loading || !token) ? '#94a3b8' : '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: (loading || !token) ? 'not-allowed' : 'pointer',
              boxShadow: (loading || !token) ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              marginBottom: '1.5rem'
            }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <a
              href="/partner/login"
              style={{
                color: '#111827',
                textDecoration: 'none',
                fontSize: '0.9375rem',
                fontWeight: '500'
              }}
            >
              Back to Login
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PartnerResetPassword;

