import { useState } from 'react';

function PartnerForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isMobile] = useState(window.innerWidth < 768);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Password reset email sent! Check your inbox.');
      } else {
        setError(data.error || 'Failed to send reset email');
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
            Forgot Password
          </h1>
          <p style={{ margin: 0, color: '#6c757d', fontSize: '0.95rem' }}>
            Enter your email address and we'll send you a link to reset your password.
          </p>
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="venue001@curo.sg"
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
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              backgroundColor: loading ? '#94a3b8' : '#111827',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'all 0.2s',
              marginBottom: '1.5rem'
            }}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
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

export default PartnerForgotPassword;

