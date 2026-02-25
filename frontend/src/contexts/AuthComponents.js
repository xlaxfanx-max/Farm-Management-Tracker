// =============================================================================
// COMPANY SELECTOR COMPONENT
// =============================================================================
//
// Dropdown for switching between companies (for users in multiple companies)
//
// Create as: frontend/src/components/CompanySelector.js
//
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';

export function CompanySelector() {
  const { currentCompany, companies, switchCompany } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (companyId) => {
    if (companyId === currentCompany?.id) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    await switchCompany(companyId);
    setLoading(false);
    setIsOpen(false);
    
    // Optionally refresh the page to reload all data
    window.location.reload();
  };

  // Don't show if user only has one company
  if (companies.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
        <Building2 className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 truncate max-w-[180px]">
          {currentCompany?.name || 'No Company'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-w-[200px]"
      >
        <Building2 className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 truncate flex-1 text-left">
          {loading ? 'Switching...' : currentCompany?.name || 'Select Company'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => handleSwitch(company.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-700 truncate">
                  {company.name}
                </div>
                <div className="text-xs text-gray-500">
                  {company.role}
                </div>
              </div>
              {company.id === currentCompany?.id && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// USER MENU COMPONENT
// =============================================================================
//
// Dropdown menu for user profile, settings, and logout
//
// Create as: frontend/src/components/UserMenu.js
//
// =============================================================================

export function UserMenu() {
  const { user, currentCompany, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    // AuthContext will handle clearing state
    // You may want to redirect to login page
  };

  const initials = user 
    ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-sm font-medium text-white">{initials}</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="font-medium text-gray-900">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="text-sm text-gray-500 truncate">
              {user?.email}
            </div>
            {currentCompany && (
              <div className="mt-1 text-xs text-primary font-medium">
                {currentCompany.role} at {currentCompany.name}
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <a
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Your Profile
            </a>
            <a
              href="/settings"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setIsOpen(false)}
            >
              Settings
            </a>
            {currentCompany?.role_codename === 'owner' && (
              <a
                href="/company-settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setIsOpen(false)}
              >
                Company Settings
              </a>
            )}
          </div>

          {/* Logout */}
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// =============================================================================
// PERMISSION GATE COMPONENT
// =============================================================================
//
// Conditionally renders children based on user permissions
//
// Usage:
//   <PermissionGate permission="create_farms">
//     <button>Add Farm</button>
//   </PermissionGate>
//
// =============================================================================

export function PermissionGate({ 
  permission, 
  permissions, // Array of permissions (any match)
  requireAll = false, // If true with array, require all permissions
  fallback = null, // What to render if permission denied
  children 
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else {
    hasAccess = true; // No permission specified, allow access
  }

  return hasAccess ? children : fallback;
}


// =============================================================================
// ROLE BADGE COMPONENT
// =============================================================================
//
// Displays a colored badge for user role
//
// =============================================================================

export function RoleBadge({ role, size = 'sm' }) {
  const roleColors = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    manager: 'bg-green-100 text-green-800',
    applicator: 'bg-orange-100 text-orange-800',
    worker: 'bg-gray-100 text-gray-800',
    viewer: 'bg-gray-100 text-gray-600',
    pca: 'bg-teal-100 text-teal-800',
    accountant: 'bg-yellow-100 text-yellow-800',
  };

  const sizeClasses = {
    xs: 'text-xs px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-2.5 py-1',
  };

  const colorClass = roleColors[role?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${colorClass} ${sizeClass}`}>
      {role}
    </span>
  );
}


// =============================================================================
// INVITE USER MODAL
// =============================================================================
//
// Modal for inviting new users to the company
//
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { authAPI, rolesAPI } from '../services/api';

export function InviteUserModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [message, setMessage] = useState('');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  const fetchRoles = async () => {
    try {
      const response = await rolesAPI.available();
      setRoles(response.data);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.invite(email, role, message);
      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setRole('viewer');
    setMessage('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Invite Team Member</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="colleague@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {roles.map((r) => (
                <option key={r.codename} value={r.codename}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              placeholder="Welcome to the team!"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
