import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

// Create context
const AuthContext = createContext(null);

// Token storage keys
const ACCESS_TOKEN_KEY = 'farm_tracker_access_token';
const REFRESH_TOKEN_KEY = 'farm_tracker_refresh_token';

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

  // ---------------------------------------------------------------------------
  // TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }, []);

  const getRefreshToken = useCallback(() => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }, []);

  const setTokens = useCallback((access, refresh) => {
    if (access) localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }, []);

  // ---------------------------------------------------------------------------
  // AUTH STATE MANAGEMENT
  // ---------------------------------------------------------------------------

  const clearAuthState = useCallback(() => {
    setUser(null);
    setCurrentCompany(null);
    setCompanies([]);
    setPermissions([]);
    clearTokens();
  }, [clearTokens]);

  const updateAuthState = useCallback((data) => {
    if (data.user) setUser(data.user);
    if (data.current_company) setCurrentCompany(data.current_company);
    if (data.companies) setCompanies(data.companies);
    if (data.permissions) setPermissions(data.permissions);
    if (data.tokens) {
      setTokens(data.tokens.access, data.tokens.refresh);
    }
  }, [setTokens]);

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
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (err) {
      // Ignore logout errors
    } finally {
      clearAuthState();
    }
  }, [getRefreshToken, clearAuthState]);

  const refreshAuth = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthState();
      return false;
    }

    try {
      const response = await authAPI.refresh(refreshToken);
      setTokens(response.data.access, response.data.refresh);
      return true;
    } catch (err) {
      clearAuthState();
      return false;
    }
  }, [getRefreshToken, setTokens, clearAuthState]);

  const fetchCurrentUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

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
        // Try to refresh token
        const refreshed = await refreshAuth();
        if (refreshed) {
          // Retry fetching user
          try {
            const response = await authAPI.me();
            updateAuthState({
              user: response.data,
              current_company: response.data.current_company,
              companies: response.data.companies,
              permissions: response.data.permissions,
            });
          } catch {
            clearAuthState();
          }
        }
      } else {
        clearAuthState();
      }
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, updateAuthState, refreshAuth, clearAuthState]);

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

    // Token access (for API interceptors)
    getAccessToken,
    getRefreshToken,
    setTokens,
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
