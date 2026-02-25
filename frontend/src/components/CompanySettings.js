import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { companyAPI } from '../services/api';
import SeasonTemplatesManager from './settings/SeasonTemplatesManager';
import ModuleVisibilitySettings from './settings/ModuleVisibilitySettings';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Users,
  Calendar,
  Save,
  X,
  Edit2,
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  Sprout,
  LayoutGrid
} from 'lucide-react';

const CompanySettings = ({ onBack }) => {
  const { currentCompany, user, refreshUser } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({});
  const [isOwner, setIsOwner] = useState(false);

  // California counties for dropdown
  const californiaCounties = [
    'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa',
    'Del Norte', 'El Dorado', 'Fresno', 'Glenn', 'Humboldt', 'Imperial', 'Inyo',
    'Kern', 'Kings', 'Lake', 'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mariposa',
    'Mendocino', 'Merced', 'Modoc', 'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange',
    'Placer', 'Plumas', 'Riverside', 'Sacramento', 'San Benito', 'San Bernardino',
    'San Diego', 'San Francisco', 'San Joaquin', 'San Luis Obispo', 'San Mateo',
    'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta', 'Sierra', 'Siskiyou',
    'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity', 'Tulare',
    'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
  ];

  // Primary crop options
  const cropOptions = [
    'Citrus - Lemons',
    'Citrus - Oranges',
    'Citrus - Mandarins',
    'Citrus - Grapefruit',
    'Citrus - Mixed',
    'Avocados',
    'Almonds',
    'Walnuts',
    'Pistachios',
    'Grapes - Wine',
    'Grapes - Table',
    'Strawberries',
    'Tomatoes',
    'Lettuce',
    'Other Row Crops',
    'Mixed/Diversified'
  ];

  // Subscription tier display info
  const tierInfo = {
    free: { name: 'Free Trial', color: 'bg-gray-100 text-gray-700', maxFarms: 3, maxUsers: 5 },
    starter: { name: 'Starter', color: 'bg-blue-100 text-blue-700', maxFarms: 5, maxUsers: 10 },
    professional: { name: 'Professional', color: 'bg-green-100 text-primary', maxFarms: 15, maxUsers: 25 },
    enterprise: { name: 'Enterprise', color: 'bg-purple-100 text-purple-700', maxFarms: 'Unlimited', maxUsers: 'Unlimited' }
  };

  useEffect(() => {
    fetchCompanyDetails();
  }, [currentCompany]);

  const fetchCompanyDetails = async () => {
    if (!currentCompany?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await companyAPI.get(currentCompany.id);
      setCompany(response.data);
      setFormData(response.data);
      // Set owner status from API response
      setIsOwner(response.data.is_owner || false);
    } catch (err) {
      console.error('Error fetching company:', err);
      setError('Failed to load company information');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await companyAPI.update(company.id, formData);
      setCompany(response.data);
      setFormData(response.data);
      setEditing(false);
      setSuccess('Company information updated successfully');
      
      // Refresh user context to update company name in header if changed
      if (refreshUser) {
        await refreshUser();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating company:', err);
      setError(err.response?.data?.detail || 'Failed to update company information');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(company);
    setEditing(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading company information...</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">No company information available</span>
          </div>
        </div>
      </div>
    );
  }

  const currentTier = tierInfo[company.subscription_tier] || tierInfo.free;

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
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Building2 className="w-8 h-8 text-primary mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
              <p className="text-gray-500">Manage your company information and settings</p>
            </div>
          </div>
          
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
          
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="mb-4 bg-primary-light border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-primary">{success}</span>
          </div>
        </div>
      )}

      {!isOwner && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <Shield className="w-5 h-5 text-amber-500 mr-2" />
            <span className="text-amber-700">
              Only company owners can edit company information
            </span>
          </div>
        </div>
      )}

      {/* Company Information Sections */}
      <div className="space-y-6">
        
        {/* Basic Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-primary" />
              Basic Information
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name *
              </label>
              {editing ? (
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  required
                />
              ) : (
                <p className="text-gray-900 py-2">{company.name}</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Legal Name
              </label>
              {editing ? (
                <input
                  type="text"
                  name="legal_name"
                  value={formData.legal_name || ''}
                  onChange={handleInputChange}
                  placeholder="Official registered business name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.legal_name || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Crop
              </label>
              {editing ? (
                <select
                  name="primary_crop"
                  value={formData.primary_crop || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select primary crop...</option>
                  {cropOptions.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{company.primary_crop || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Total Acres
              </label>
              {editing ? (
                <input
                  type="number"
                  name="estimated_total_acres"
                  value={formData.estimated_total_acres || ''}
                  onChange={handleInputChange}
                  placeholder="Total farmed acres"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">
                  {company.estimated_total_acres ? `${company.estimated_total_acres.toLocaleString()} acres` : '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-primary" />
              Contact Information
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary Contact Name
              </label>
              {editing ? (
                <input
                  type="text"
                  name="primary_contact_name"
                  value={formData.primary_contact_name || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.primary_contact_name || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              {editing ? (
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleInputChange}
                  placeholder="(555) 555-5555"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2 flex items-center">
                  {company.phone ? (
                    <>
                      <Phone className="w-4 h-4 mr-2 text-gray-400" />
                      {company.phone}
                    </>
                  ) : '—'}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              {editing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleInputChange}
                  placeholder="company@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2 flex items-center">
                  {company.email ? (
                    <>
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      {company.email}
                    </>
                  ) : '—'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-primary" />
              Business Address
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Street Address
              </label>
              {editing ? (
                <input
                  type="text"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  placeholder="123 Farm Road"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.address || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              {editing ? (
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.city || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                County
              </label>
              {editing ? (
                <select
                  name="county"
                  value={formData.county || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="">Select county...</option>
                  {californiaCounties.map(county => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              ) : (
                <p className="text-gray-900 py-2">{company.county || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <p className="text-gray-900 py-2">California</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ZIP Code
              </label>
              {editing ? (
                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code || ''}
                  onChange={handleInputChange}
                  placeholder="93001"
                  maxLength="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.zip_code || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Regulatory & Business IDs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-primary" />
              Regulatory & Business Information
            </h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Operator ID
                <span className="text-gray-500 font-normal ml-1">(for PUR reporting)</span>
              </label>
              {editing ? (
                <input
                  type="text"
                  name="operator_id"
                  value={formData.operator_id || ''}
                  onChange={handleInputChange}
                  placeholder="County Agricultural Commissioner ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.operator_id || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business License Number
              </label>
              {editing ? (
                <input
                  type="text"
                  name="business_license"
                  value={formData.business_license || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.business_license || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pest Control Advisor (PCA) License
              </label>
              {editing ? (
                <input
                  type="text"
                  name="pca_license"
                  value={formData.pca_license || ''}
                  onChange={handleInputChange}
                  placeholder="PCA license number if applicable"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.pca_license || '—'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qualified Applicator License (QAL)
              </label>
              {editing ? (
                <input
                  type="text"
                  name="qal_license"
                  value={formData.qal_license || ''}
                  onChange={handleInputChange}
                  placeholder="QAL number if applicable"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              ) : (
                <p className="text-gray-900 py-2">{company.qal_license || '—'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Information (Read-only) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-primary" />
              Subscription
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Plan
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${currentTier.color}`}>
                  {currentTier.name}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farm Limit
                </label>
                <p className="text-gray-900 py-2 flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                  {company.max_farms} farms
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Limit
                </label>
                <p className="text-gray-900 py-2 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-gray-400" />
                  {company.max_users} users
                </p>
              </div>
            </div>

            {company.subscription_start && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-2" />
                  Subscription started: {new Date(company.subscription_start).toLocaleDateString()}
                  {company.subscription_end && (
                    <span className="ml-4">
                      Renews: {new Date(company.subscription_end).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {company.subscription_tier === 'free' && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Upgrade your plan</strong> to add more farms, users, and unlock advanced features like 
                  direct GSA portal submission and QuickBooks integration.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-primary" />
              Account Status
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Status
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  company.is_active ? 'bg-green-100 text-primary' : 'bg-red-100 text-red-700'
                }`}>
                  {company.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Onboarding Status
                </label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  company.onboarding_completed ? 'bg-green-100 text-primary' : 'bg-amber-100 text-amber-700'
                }`}>
                  {company.onboarding_completed ? 'Complete' : `In Progress (${company.onboarding_step})`}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Created
                </label>
                <p className="text-gray-900 py-2">
                  {new Date(company.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Updated
                </label>
                <p className="text-gray-900 py-2">
                  {new Date(company.updated_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Season Templates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Sprout className="w-5 h-5 mr-2 text-primary" />
              Season Templates
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configure growing seasons for different crop types
            </p>
          </div>
          <div className="p-6">
            <SeasonTemplatesManager isOwner={isOwner} />
          </div>
        </div>

        {/* Module Visibility */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <LayoutGrid className="w-5 h-5 mr-2 text-primary" />
              Sidebar Modules
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Show or hide modules in the sidebar to reduce clutter
            </p>
          </div>
          <div className="p-6">
            <ModuleVisibilitySettings />
          </div>
        </div>

      </div>
    </div>
  );
};

export default CompanySettings;
