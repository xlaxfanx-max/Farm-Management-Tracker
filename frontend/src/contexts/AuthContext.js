import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, AUTH_SESSION_EXPIRED_EVENT } from '../services/api';

// Create context
const AuthContext = createContext(null);

// =============================================================================
// AUTH PROVIDER COMPONENT
// =============================================================================

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // AUTH STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  const clearAuthState = useCallback(() => {
    setUser(null);
    setCurrentCompany(null);
    setCompanies([]);
    setPermissions([]);
  }, []);

  const updateAuthState = useCallback((data) => {
    if (data.user) setUser(data.user);
    if (data.current_company) setCurrentCompany(data.current_company);
    if (data.companies) setCompanies(data.companies);
    if (data.permissions) setPermissions(data.permissions);
  }, []);

  // ---------------------------------------------------------------------------
  // AUTHENTICATION ACTIONS
  // ---------------------------------------------------------------------------

  const login = useCallback(async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login(email, password);
      updateAuthState(response.data);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [updateAuthState]);

  const register = useCallback(async (data) => {
    try {
      setError(null);
      const response = await authAPI.register(data);
      updateAuthState(response.data);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error ||
                      err.response?.data?.errors ||
                      'Registration failed';
      setError(message);
      return { success: false, error: message };
    }
  }, [updateAuthState]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // Ignore logout errors — cookies may already be cleared
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const refreshAuth = useCallback(async () => {
    try {
      await authAPI.refresh();
      return true;
    } catch (err) {
      clearAuthState();
      return false;
    }
  }, [clearAuthState]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await authAPI.me();
      updateAuthState({
        user: response.data,
        current_company: response.data.current_company,
        companies: response.data.companies,
        permissions: response.data.permissions,
      });
    } catch (err) {
      if (err.response?.status === 401) {
        // The api interceptor already tried to refresh — if we still get 401, session is gone
        clearAuthState();
      } else {
        clearAuthState();
      }
    } finally {
      setLoading(false);
    }
  }, [updateAuthState, clearAuthState]);

  // ---------------------------------------------------------------------------
  // COMPANY MANAGEMENT
  // ---------------------------------------------------------------------------

  const switchCompany = useCallback(async (companyId) => {
    try {
      setError(null);
      const response = await authAPI.switchCompany(companyId);
      setCurrentCompany(response.data.current_company);
      setPermissions(response.data.permissions);
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to switch company';
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // PERMISSION CHECKING
  // ---------------------------------------------------------------------------

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    if (user.is_superuser) return true;
    return permissions.includes(permission);
  }, [user, permissions]);

  const hasAnyPermission = useCallback((permissionList) => {
    return permissionList.some(p => hasPermission(p));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((permissionList) => {
    return permissionList.every(p => hasPermission(p));
  }, [hasPermission]);

  // ---------------------------------------------------------------------------
  // ROLE CHECKING
  // ---------------------------------------------------------------------------

  const hasRole = useCallback((roleCodename) => {
    if (!currentCompany) return false;
    return currentCompany.role_codename === roleCodename;
  }, [currentCompany]);

  const isOwnerOrAdmin = useCallback(() => {
    return hasRole('owner') || hasRole('admin');
  }, [hasRole]);

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // ---------------------------------------------------------------------------
  // SESSION EXPIRY LISTENER
  // Listen for the event emitted by the api.js interceptor when refresh fails.
  // This replaces the old window.location.href = '/login' hard redirect.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleSessionExpired = () => {
      clearAuthState();
      navigate('/login');
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearAuthState, navigate]);

  // ---------------------------------------------------------------------------
  // CONTEXT VALUE
  // ---------------------------------------------------------------------------

  const value = {
    // State
    user,
    currentCompany,
    companies,
    permissions,
    loading,
    error,
    isAuthenticated: !!user,

    // Auth actions
    login,
    register,
    logout,
    refreshAuth,

    // Company management
    switchCompany,

    // Permission/role checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isOwnerOrAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK
// =============================================================================

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
