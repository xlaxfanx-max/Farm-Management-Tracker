import React, { useState, useEffect, useCallback } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  X,
  Upload,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  Download,
  Eye,
  User,
  Building,
} from 'lucide-react';
import { licensesAPI, COMPLIANCE_CONSTANTS } from '../../services/api';

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Get days until expiration
const getDaysUntil = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateString);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
};

// Status badge component
const StatusBadge = ({ status, expirationDate }) => {
  const daysUntil = getDaysUntil(expirationDate);

  let displayStatus = status;
  if (status === 'active' && daysUntil <= 90) {
    displayStatus = 'expiring_soon';
  }
  if (status === 'active' && daysUntil <= 0) {
    displayStatus = 'expired';
  }

  const styles = {
    active: 'bg-green-100 text-green-700',
    expiring_soon: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700',
    suspended: 'bg-gray-100 text-gray-700',
    revoked: 'bg-red-100 text-red-700',
  };

  const labels = {
    active: 'Active',
    expiring_soon: 'Expiring Soon',
    expired: 'Expired',
    suspended: 'Suspended',
    revoked: 'Revoked',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[displayStatus] || styles.active}`}>
      {labels[displayStatus] || displayStatus}
    </span>
  );
};

// License type badge
const LicenseTypeBadge = ({ type }) => {
  const styles = {
    applicator: 'bg-blue-100 text-blue-700',
    pca: 'bg-purple-100 text-purple-700',
    organic_handler: 'bg-green-100 text-green-700',
    food_safety: 'bg-cyan-100 text-cyan-700',
    wps_trainer: 'bg-amber-100 text-amber-700',
    other: 'bg-gray-100 text-gray-700',
  };

  const labels = {
    applicator: 'Applicator',
    pca: 'PCA',
    organic_handler: 'Organic Handler',
    food_safety: 'Food Safety',
    wps_trainer: 'WPS Trainer',
    other: 'Other',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || styles.other}`}>
      {labels[type] || type}
    </span>
  );
};

// License Card Component
const LicenseCard = ({ license, onEdit, onDelete, onView }) => {
  const [showMenu, setShowMenu] = useState(false);
  const daysUntil = getDaysUntil(license.expiration_date);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center
            ${daysUntil <= 0 ? 'bg-red-100' : daysUntil <= 90 ? 'bg-amber-100' : 'bg-green-100'}`}>
            <Award className={`w-5 h-5 ${daysUntil <= 0 ? 'text-red-600' : daysUntil <= 90 ? 'text-amber-600' : 'text-green-600'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <LicenseTypeBadge type={license.license_type} />
              <StatusBadge status={license.status} expirationDate={license.expiration_date} />
            </div>
            <h3 className="font-medium text-gray-900 mt-1">
              {license.license_type_display || license.license_type}
            </h3>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                {license.document && (
                  <button
                    onClick={() => { onView(license); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" /> View Document
                  </button>
                )}
                <button
                  onClick={() => { onEdit(license); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { onDelete(license.id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <span className="font-medium">License #:</span>
          <span>{license.license_number}</span>
        </div>

        {license.user_name && (
          <div className="flex items-center gap-2 text-gray-600">
            <User className="w-4 h-4 text-gray-400" />
            <span>{license.user_name}</span>
          </div>
        )}

        {license.issuing_authority && (
          <div className="flex items-center gap-2 text-gray-600">
            <Building className="w-4 h-4 text-gray-400" />
            <span>{license.issuing_authority}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>Expires: {formatDate(license.expiration_date)}</span>
        </div>
      </div>

      {daysUntil <= 90 && daysUntil > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-amber-600 text-sm">
            <Clock className="w-4 h-4" />
            <span>Expires in {daysUntil} days</span>
          </div>
        </div>
      )}

      {daysUntil <= 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>Expired {Math.abs(daysUntil)} days ago</span>
          </div>
        </div>
      )}
    </div>
  );
};

// License Form Modal
const LicenseModal = ({ license, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    license_type: license?.license_type || 'applicator',
    license_number: license?.license_number || '',
    issuing_authority: license?.issuing_authority || '',
    issue_date: license?.issue_date || '',
    expiration_date: license?.expiration_date || '',
    status: license?.status || 'active',
    categories: license?.categories || [],
    renewal_reminder_days: license?.renewal_reminder_days || 90,
  });
  const [saving, setSaving] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'categories') {
          data.append(key, JSON.stringify(formData[key]));
        } else {
          data.append(key, formData[key]);
        }
      });
      if (documentFile) {
        data.append('document', documentFile);
      }
      await onSave(data, license?.id);
      onClose();
    } catch (error) {
      console.error('Failed to save license:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {license ? 'Edit License' : 'Add License'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Type *</label>
              <select
                required
                value={formData.license_type}
                onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {COMPLIANCE_CONSTANTS.LICENSE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {COMPLIANCE_CONSTANTS.LICENSE_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
            <input
              type="text"
              required
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., QAL-12345"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
            <input
              type="text"
              value={formData.issuing_authority}
              onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., California DPR"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
              <input
                type="date"
                required
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date *</label>
              <input
                type="date"
                required
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reminder Days Before Expiration</label>
            <input
              type="number"
              min={1}
              max={365}
              value={formData.renewal_reminder_days}
              onChange={(e) => setFormData({ ...formData, renewal_reminder_days: parseInt(e.target.value) || 90 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">You'll receive reminders this many days before expiration</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Document</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocumentFile(e.target.files[0])}
                className="hidden"
                id="license-document"
              />
              <label htmlFor="license-document" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {documentFile ? documentFile.name : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG up to 10MB</p>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : license ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
export default function LicenseManagement({ onNavigate }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch licenses
  const fetchLicenses = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      if (typeFilter !== 'all') {
        params.license_type = typeFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await licensesAPI.getAll(params);
      setLicenses(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  // Handle save
  const handleSave = async (data, id) => {
    if (id) {
      await licensesAPI.update(id, data);
    } else {
      await licensesAPI.create(data);
    }
    fetchLicenses();
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this license?')) {
      try {
        await licensesAPI.delete(id);
        fetchLicenses();
      } catch (error) {
        console.error('Failed to delete license:', error);
      }
    }
  };

  // Handle edit
  const handleEdit = (license) => {
    setEditingLicense(license);
    setShowModal(true);
  };

  // Handle view document
  const handleViewDocument = (license) => {
    if (license.document) {
      window.open(license.document, '_blank');
    }
  };

  // Stats
  const stats = {
    total: licenses.length,
    active: licenses.filter(l => l.status === 'active' && getDaysUntil(l.expiration_date) > 90).length,
    expiring: licenses.filter(l => {
      const days = getDaysUntil(l.expiration_date);
      return l.status === 'active' && days > 0 && days <= 90;
    }).length,
    expired: licenses.filter(l => getDaysUntil(l.expiration_date) <= 0).length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => onNavigate?.('compliance')} className="hover:text-green-600">
              Compliance
            </button>
            <span>/</span>
            <span>Licenses</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Licenses & Certifications</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLicenses}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setEditingLicense(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add License
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">Total Licenses</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">{stats.active}</span>
          </div>
          <p className="text-sm text-green-700 mt-1">Active</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-2xl font-bold text-amber-600">{stats.expiring}</span>
          </div>
          <p className="text-sm text-amber-700 mt-1">Expiring Soon</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-2xl font-bold text-red-600">{stats.expired}</span>
          </div>
          <p className="text-sm text-red-700 mt-1">Expired</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Types</option>
              {COMPLIANCE_CONSTANTS.LICENSE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search licenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 w-64"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : licenses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {licenses.map(license => (
            <LicenseCard
              key={license.id}
              license={license}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onView={handleViewDocument}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <Award className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900">No licenses found</p>
          <p className="text-sm text-gray-500 mt-1">Add your first license or certification to get started</p>
          <button
            onClick={() => { setEditingLicense(null); setShowModal(true); }}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Add License
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <LicenseModal
          license={editingLicense}
          onClose={() => { setShowModal(false); setEditingLicense(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
