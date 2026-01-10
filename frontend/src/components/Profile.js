import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Save,
  X,
  Edit2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  Eye,
  EyeOff,
  Shield,
  Calendar,
  Building2
} from 'lucide-react';

const Profile = ({ onBack }) => {
  const { user, refreshUser, currentCompany } = useAuth();
  
  // Profile state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Profile form data
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  
  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Notification preferences state
  const [editingNotifications, setEditingNotifications] = useState(false);
  const [notifications, setNotifications] = useState({
    email_pur_reminders: true,
    email_water_test_due: true,
    email_phi_warnings: true,
    email_weekly_summary: false,
    email_team_updates: true,
  });
  const [savingNotifications, setSavingNotifications] = useState(false);

  // Initialize form data from user
  useEffect(() => {
    if (user) {
      setProfileData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
      });
      
      // Load notification preferences if available
      if (user.notification_preferences) {
        setNotifications(user.notification_preferences);
      }
    }
  }, [user]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (passwordSuccess) {
      const timer = setTimeout(() => setPasswordSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [passwordSuccess]);

  // Handle profile form changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    
    try {
      await authAPI.updateProfile(profileData);
      await refreshUser();
      setEditingProfile(false);
      setSuccess('Profile updated successfully');
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Cancel profile editing
  const handleCancelProfile = () => {
    setProfileData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    });
    setEditingProfile(false);
    setError(null);
  };

  // Handle password form changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    setPasswordError(null);
  };

  // Validate password
  const validatePassword = () => {
    if (passwordData.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return false;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match');
      return false;
    }
    if (passwordData.current_password === passwordData.new_password) {
      setPasswordError('New password must be different from current password');
      return false;
    }
    return true;
  };

  // Save new password
  const handleSavePassword = async () => {
    if (!validatePassword()) return;
    
    setSavingPassword(true);
    setPasswordError(null);
    
    try {
      await authAPI.changePassword(passwordData.current_password, passwordData.new_password);
      setPasswordSuccess('Password changed successfully');
      setChangingPassword(false);
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError(err.response?.data?.detail || 'Failed to change password. Please check your current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Cancel password change
  const handleCancelPassword = () => {
    setPasswordData({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
    setChangingPassword(false);
    setPasswordError(null);
  };

  // Handle notification toggle
  const handleNotificationToggle = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Save notification preferences
  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    
    try {
      await authAPI.updateProfile({ notification_preferences: notifications });
      await refreshUser();
      setEditingNotifications(false);
      setSuccess('Notification preferences saved');
    } catch (err) {
      console.error('Error saving notifications:', err);
      setError('Failed to save notification preferences');
    } finally {
      setSavingNotifications(false);
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return '?';
    const first = user.first_name?.[0] || '';
    const last = user.last_name?.[0] || '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <span className="ml-2 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Dashboard
        </button>
        
        <div className="flex items-center">
          <User className="w-8 h-8 text-green-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-500">Manage your personal information and preferences</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700">{success}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Profile Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-8">
            <div className="flex items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-green-600">{getUserInitials()}</span>
              </div>
              <div className="ml-6 text-white">
                <h2 className="text-2xl font-bold">
                  {user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.email}
                </h2>
                <p className="text-green-100 flex items-center mt-1">
                  <Mail className="w-4 h-4 mr-2" />
                  {user?.email}
                </p>
                {currentCompany && (
                  <p className="text-green-100 flex items-center mt-1">
                    <Building2 className="w-4 h-4 mr-2" />
                    {currentCompany.name} • {currentCompany.role || 'Member'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <User className="w-5 h-5 mr-2 text-green-600" />
              Personal Information
            </h2>
            {!editingProfile && (
              <button
                onClick={() => setEditingProfile(true)}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </button>
            )}
          </div>
          
          <div className="p-6">
            {editingProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={profileData.first_name}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={profileData.last_name}
                      onChange={handleProfileChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Contact support to change your email address</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleProfileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="(555) 555-5555"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCancelProfile}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">First Name</label>
                  <p className="text-gray-900">{user?.first_name || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Last Name</label>
                  <p className="text-gray-900">{user?.last_name || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                  <p className="text-gray-900 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-gray-400" />
                    {user?.email}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone Number</label>
                  <p className="text-gray-900 flex items-center">
                    {user?.phone ? (
                      <>
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        {user.phone}
                      </>
                    ) : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Password & Security */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Lock className="w-5 h-5 mr-2 text-green-600" />
              Password & Security
            </h2>
          </div>
          
          <div className="p-6">
            {passwordSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-green-700">{passwordSuccess}</span>
                </div>
              </div>
            )}
            
            {changingPassword ? (
              <div className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700 text-sm">{passwordError}</span>
                    </div>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      name="current_password"
                      value={passwordData.current_password}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      name="new_password"
                      value={passwordData.new_password}
                      onChange={handlePasswordChange}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Confirm new password"
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleCancelPassword}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePassword}
                    disabled={savingPassword || !passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {savingPassword ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    Change Password
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-900 font-medium">Password</p>
                  <p className="text-sm text-gray-500">Last changed: {formatDate(user?.password_changed_at) || 'Never'}</p>
                </div>
                <button
                  onClick={() => setChangingPassword(true)}
                  className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </button>
              </div>
            )}
            
            {/* Two-Factor Authentication - Future Feature */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-900 font-medium flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-gray-400" />
                    Two-Factor Authentication
                  </p>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-sm rounded-full">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-green-600" />
              Notification Preferences
            </h2>
            {!editingNotifications ? (
              <button
                onClick={() => setEditingNotifications(true)}
                className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingNotifications(false)}
                  className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotifications}
                  disabled={savingNotifications}
                  className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {savingNotifications ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Save
                </button>
              </div>
            )}
          </div>
          
          <div className="p-6">
            <p className="text-sm text-gray-500 mb-4">
              Choose which notifications you'd like to receive via email.
            </p>
            
            <div className="space-y-4">
              {/* PUR Reminders */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-gray-900 font-medium">PUR Submission Reminders</p>
                  <p className="text-sm text-gray-500">Get reminded before monthly PUR deadlines</p>
                </div>
                <button
                  onClick={() => editingNotifications && handleNotificationToggle('email_pur_reminders')}
                  disabled={!editingNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email_pur_reminders ? 'bg-green-600' : 'bg-gray-200'
                  } ${!editingNotifications ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email_pur_reminders ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Water Test Due */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-gray-900 font-medium">Water Test Due Alerts</p>
                  <p className="text-sm text-gray-500">Get notified when water tests are due</p>
                </div>
                <button
                  onClick={() => editingNotifications && handleNotificationToggle('email_water_test_due')}
                  disabled={!editingNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email_water_test_due ? 'bg-green-600' : 'bg-gray-200'
                  } ${!editingNotifications ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email_water_test_due ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* PHI Warnings */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-gray-900 font-medium">PHI Compliance Warnings</p>
                  <p className="text-sm text-gray-500">Get alerted about pre-harvest interval concerns</p>
                </div>
                <button
                  onClick={() => editingNotifications && handleNotificationToggle('email_phi_warnings')}
                  disabled={!editingNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email_phi_warnings ? 'bg-green-600' : 'bg-gray-200'
                  } ${!editingNotifications ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email_phi_warnings ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Weekly Summary */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-gray-900 font-medium">Weekly Summary Email</p>
                  <p className="text-sm text-gray-500">Receive a weekly digest of farm activity</p>
                </div>
                <button
                  onClick={() => editingNotifications && handleNotificationToggle('email_weekly_summary')}
                  disabled={!editingNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email_weekly_summary ? 'bg-green-600' : 'bg-gray-200'
                  } ${!editingNotifications ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email_weekly_summary ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Team Updates */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-gray-900 font-medium">Team Updates</p>
                  <p className="text-sm text-gray-500">Get notified when team members are added or removed</p>
                </div>
                <button
                  onClick={() => editingNotifications && handleNotificationToggle('email_team_updates')}
                  disabled={!editingNotifications}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifications.email_team_updates ? 'bg-green-600' : 'bg-gray-200'
                  } ${!editingNotifications ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      notifications.email_team_updates ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-green-600" />
              Account Information
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Account Created</label>
                <p className="text-gray-900">{formatDate(user?.date_joined)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Last Login</label>
                <p className="text-gray-900">{formatDate(user?.last_login)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Account Status</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                  user?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                <p className="text-gray-900 font-mono text-sm">{user?.id}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;
