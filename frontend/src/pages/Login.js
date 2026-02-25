import React, { useState } from 'react';
import { Droplet, Mail, Lock, Building2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const Login = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    farmName: '',
    firstName: '',
    lastName: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }

    if (isSignup) {
      if (!formData.farmName || !formData.firstName || !formData.lastName) {
        setError('All fields are required for signup');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = isSignup ? '/auth/register/' : '/auth/login/';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(isSignup ? {
          email: formData.email,
          password: formData.password,
          farm_name: formData.farmName,
          first_name: formData.firstName,
          last_name: formData.lastName
        } : {
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Authentication failed');
      }

      // Store auth data
      localStorage.setItem('authToken', data.token || data.access_token);
      localStorage.setItem('farmId', data.farm?.id || data.farm_id);
      localStorage.setItem('farmName', data.farm?.name || data.farm_name);
      localStorage.setItem('userId', data.user?.id || data.user_id);
      localStorage.setItem('userEmail', formData.email);

      // Call the onLogin callback if provided
      if (onLogin) {
        onLogin(data);
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';

    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // For demo purposes - skip auth and go straight to dashboard
    localStorage.setItem('authToken', 'demo-token');
    localStorage.setItem('farmId', 'finch-farms');
    localStorage.setItem('farmName', 'Finch Farms');
    localStorage.setItem('userId', 'demo-user');
    localStorage.setItem('userEmail', 'demo@finchfarms.com');
    window.location.href = '/dashboard';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #f8fafc, #f0fdf4, #fffbeb)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.3 }}>
        <div style={{
          position: 'absolute',
          top: '5rem',
          right: '5rem',
          width: '20rem',
          height: '20rem',
          background: '#86efac',
          borderRadius: '9999px',
          filter: 'blur(64px)',
          animation: 'blob 7s infinite'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '5rem',
          left: '5rem',
          width: '20rem',
          height: '20rem',
          background: '#fcd34d',
          borderRadius: '9999px',
          filter: 'blur(64px)',
          animation: 'blob 7s infinite 2s'
        }} />
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 10px) scale(1.05); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        maxWidth: '28rem',
        width: '100%',
        background: 'white',
        borderRadius: '1.5rem',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
        border: '4px solid #3D7A4A',
        padding: '2.5rem',
        position: 'relative',
        zIndex: 10,
        animation: 'fadeIn 0.6s ease-out'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Droplet style={{ color: '#ea580c' }} size={36} />
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Finch Farms</h1>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Compliance Management</p>
            </div>
          </div>
          
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
            {isSignup ? 'Start Your Free Trial' : 'Welcome Back'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {isSignup 
              ? '30 days free, then $50/month. Cancel anytime.' 
              : 'Sign in to access your compliance dashboard'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
            <span style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
          {isSignup && (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ 
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#334155',
                  marginBottom: '0.5rem'
                }}>
                  Farm/Company Name
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 
                    size={18} 
                    style={{ 
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8'
                    }} 
                  />
                  <input
                    type="text"
                    name="farmName"
                    value={formData.farmName}
                    onChange={handleChange}
                    placeholder="e.g., Sunset Orchards"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem 0.75rem 2.75rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.5rem'
                  }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="John"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '0.5rem'
                  }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Smith"
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ 
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.5rem'
            }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                style={{ 
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }} 
              />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
          </div>

          <div style={{ marginBottom: isSignup ? '1rem' : '1.5rem' }}>
            <label style={{ 
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '0.5rem'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{ 
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }} 
              />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                style={{
                  width: '100%',
                  padding: '0.75rem 3rem 0.75rem 2.75rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0.25rem'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isSignup && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '0.5rem'
              }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock 
                  size={18} 
                  style={{ 
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8'
                  }} 
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.75rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3D7A4A'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: loading ? '#94a3b8' : 'linear-gradient(to right, #ea580c, #fbbf24)',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            {loading ? 'Please wait...' : (isSignup ? 'Start Free Trial' : 'Sign In')}
          </button>
        </form>

        {/* Toggle between login/signup */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
            }}
            style={{
              color: '#3D7A4A',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {isSignup 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Start free trial"}
          </button>
        </div>

        {/* Demo Login (for testing) */}
        <div style={{
          paddingTop: '1.5rem',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Just testing?
          </p>
          <button
            onClick={handleDemoLogin}
            style={{
              color: '#64748b',
              fontWeight: 600,
              background: 'none',
              border: '2px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#3D7A4A';
              e.target.style.color = '#3D7A4A';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.color = '#64748b';
            }}
          >
            Continue with Demo Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;