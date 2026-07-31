import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Shield,
  Clock,
  Plus,
  Search,
  Filter,
  X,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  MapPin,
  FileText,
  User,
  Award,
  ClipboardCheck,
} from 'lucide-react';
import { wpsTrainingAPI, postingLocationsAPI, reiPostingsAPI, COMPLIANCE_CONSTANTS } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

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
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// Status badge component
const StatusBadge = ({ daysUntil, expired }) => {
  if (expired || daysUntil <= 0) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-danger-bg text-danger">Expired</span>;
  }
  if (daysUntil <= 30) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-700">Expiring Soon</span>;
  }
  if (daysUntil <= 90) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Due Soon</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-primary">Current</span>;
};

// Training type badge
const TrainingTypeBadge = ({ type }) => {
  const styles = {
    pesticide_safety: 'bg-orange-100 text-orange-700',
    handler: 'bg-sand-200 text-bark-700',
    early_entry: 'bg-green-100 text-green-700',
    respirator: 'bg-yellow-200 text-yellow-700',
  };

  const labels = {
    pesticide_safety: 'Pesticide Safety',
    handler: 'Handler',
    early_entry: 'Early Entry',
    respirator: 'Respirator',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-cream-100 text-bark-700'}`}>
      {labels[type] || type}
    </span>
  );
};

// Training Record Row
const TrainingRow = ({ record, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const daysUntil = getDaysUntil(record.expiration_date);

  return (
    <tr className="hover:bg-cream-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-link" />
          </div>
          <div>
            <p className="font-medium text-heading">{record.trainee_name}</p>
            {record.trainee_employee_id && (
              <p className="text-xs text-text-secondary">ID: {record.trainee_employee_id}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <TrainingTypeBadge type={record.training_type} />
      </td>
      <td className="px-4 py-3 text-sm text-bark-600">
        {formatDate(record.training_date)}
      </td>
      <td className="px-4 py-3 text-sm text-bark-600">
        {formatDate(record.expiration_date)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge daysUntil={daysUntil} />
      </td>
      <td className="px-4 py-3 text-sm text-bark-600">
        {record.trainer_name || '-'}
      </td>
      <td className="px-4 py-3">
        <div className="relative">
          <button aria-label="More actions"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-text-muted hover:text-bark-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-32 bg-surface-raised border border-border rounded-card shadow-lg z-20 py-1">
                <button
                  onClick={() => { onEdit(record); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-bark-700 hover:bg-cream-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => { onDelete(record.id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger-bg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// Training Form Modal
const TrainingModal = ({ record, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    trainee_name: record?.trainee_name || '',
    trainee_employee_id: record?.trainee_employee_id || '',
    training_type: record?.training_type || 'pesticide_safety',
    training_date: record?.training_date || '',
    expiration_date: record?.expiration_date || '',
    trainer_name: record?.trainer_name || '',
    trainer_certification: record?.trainer_certification || '',
    verified: record?.verified || false,
  });
  const [saving, setSaving] = useState(false);

  // Auto-calculate expiration date (1 year from training date)
  useEffect(() => {
    if (formData.training_date && !record) {
      const trainingDate = new Date(formData.training_date);
      const expirationDate = new Date(trainingDate);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      setFormData(prev => ({
        ...prev,
        expiration_date: expirationDate.toISOString().split('T')[0],
      }));
    }
  }, [formData.training_date, record]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData, record?.id);
      onClose();
    } catch (error) {
      console.error('Failed to save training record:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-card shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-raised flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg text-heading">
            {record ? 'Edit Training Record' : 'Add Training Record'}
          </h2>
          <button aria-label="Close" onClick={onClose} className="text-text-muted hover:text-bark-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Employee Name *</label>
            <input
              type="text"
              required
              value={formData.trainee_name}
              onChange={(e) => setFormData({ ...formData, trainee_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              placeholder="Full name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Employee ID</label>
              <input
                type="text"
                value={formData.trainee_employee_id}
                onChange={(e) => setFormData({ ...formData, trainee_employee_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Training Type *</label>
              <select
                required
                value={formData.training_type}
                onChange={(e) => setFormData({ ...formData, training_type: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              >
                {COMPLIANCE_CONSTANTS.WPS_TRAINING_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Training Date *</label>
              <input
                type="date"
                required
                value={formData.training_date}
                onChange={(e) => setFormData({ ...formData, training_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Expiration Date *</label>
              <input
                type="date"
                required
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
              <p className="text-xs text-text-secondary mt-1">WPS training expires annually</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Trainer Name</label>
              <input
                type="text"
                value={formData.trainer_name}
                onChange={(e) => setFormData({ ...formData, trainer_name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Trainer Certification</label>
              <input
                type="text"
                value={formData.trainer_certification}
                onChange={(e) => setFormData({ ...formData, trainer_certification: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verified"
              checked={formData.verified}
              onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
              className="w-4 h-4 text-primary border-border-strong rounded focus:ring-primary"
            />
            <label htmlFor="verified" className="text-sm text-bark-700">
              Training verified/certified
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-bark-700 hover:bg-cream-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : record ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Posting Location Card
const PostingLocationCard = ({ location, onVerify }) => {
  const daysAgo = location.last_verified_date
    ? Math.abs(getDaysUntil(location.last_verified_date))
    : null;

  return (
    <div className="bg-surface-raised border border-border rounded-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className=" text-heading">{location.location_name}</h3>
            <p className="text-sm text-text-secondary">{location.farm_name}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          {location.has_wps_poster ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <X className="w-4 h-4 text-danger" />
          )}
          <span className="text-sm text-bark-600">WPS Poster</span>
        </div>
        <div className="flex items-center gap-2">
          {location.has_emergency_info ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <X className="w-4 h-4 text-danger" />
          )}
          <span className="text-sm text-bark-600">Emergency Information</span>
        </div>
        <div className="flex items-center gap-2">
          {location.has_sds_available ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <X className="w-4 h-4 text-danger" />
          )}
          <span className="text-sm text-bark-600">SDS Available</span>
        </div>
        <div className="flex items-center gap-2">
          {location.has_application_info ? (
            <CheckCircle2 className="w-4 h-4 text-primary" />
          ) : (
            <X className="w-4 h-4 text-danger" />
          )}
          <span className="text-sm text-bark-600">Application Info Posted</span>
        </div>
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between">
        <div className="text-sm text-text-secondary">
          {location.last_verified_date ? (
            <span>Verified {daysAgo} days ago</span>
          ) : (
            <span className="text-yellow-600">Never verified</span>
          )}
        </div>
        <button
          onClick={() => onVerify(location.id)}
          className="text-sm text-primary hover:text-primary-hover font-medium"
        >
          Verify Now
        </button>
      </div>
    </div>
  );
};

// REI Posting Card
const REIPostingCard = ({ posting, onMarkPosted, onMarkRemoved }) => {
  const reiEndDate = new Date(posting.rei_end_datetime);
  const now = new Date();
  const isActive = reiEndDate > now;
  const hoursRemaining = Math.max(0, Math.ceil((reiEndDate - now) / (1000 * 60 * 60)));

  return (
    <div className={`border rounded-lg p-4 ${isActive ? 'bg-yellow-100 border-yellow-200' : 'bg-cream-50 border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isActive ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-700">Active REI</span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cream-100 text-bark-700">REI Ended</span>
            )}
          </div>
          <h3 className=" text-heading">{posting.application_product || 'Pesticide Application'}</h3>
          <p className="text-sm text-text-secondary">{posting.field_name} - {posting.farm_name}</p>
        </div>
        <Clock className={`w-5 h-5 ${isActive ? 'text-yellow-600' : 'text-text-muted'}`} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Application:</span>
          <span className="text-heading">{formatDate(posting.application_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">REI Ends:</span>
          <span className={isActive ? 'text-yellow-700 font-medium' : 'text-heading'}>
            {reiEndDate.toLocaleString()}
          </span>
        </div>
        {isActive && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Time Remaining:</span>
            <span className="text-yellow-700 font-medium">{hoursRemaining} hours</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex gap-2">
        {!posting.posted_at ? (
          <button
            onClick={() => onMarkPosted(posting.id)}
            className="flex-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            Mark as Posted
          </button>
        ) : !posting.removed_at && !isActive ? (
          <button
            onClick={() => onMarkRemoved(posting.id)}
            className="flex-1 px-3 py-1.5 text-sm bg-bark-600 text-white rounded-lg hover:bg-bark-700"
          >
            Mark as Removed
          </button>
        ) : (
          <div className="flex-1 text-center text-sm text-text-secondary">
            {posting.removed_at ? 'Posting complete' : 'Posted - REI active'}
          </div>
        )}
      </div>
    </div>
  );
};

// Main Component
export default function WPSCompliance({ onNavigate }) {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('training');
  const [loading, setLoading] = useState(true);

  // Training state
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [trainingSearch, setTrainingSearch] = useState('');

  // Posting locations state
  const [postingLocations, setPostingLocations] = useState([]);

  // REI postings state
  const [reiPostings, setReiPostings] = useState([]);

  // Fetch training records
  const fetchTrainingRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (trainingFilter !== 'all') {
        if (trainingFilter === 'expiring') {
          params.expiring_within_days = 90;
        } else if (trainingFilter === 'expired') {
          params.expired = true;
        }
      }
      if (trainingSearch) {
        params.search = trainingSearch;
      }
      const response = await wpsTrainingAPI.getAll(params);
      setTrainingRecords(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch training records:', error);
    } finally {
      setLoading(false);
    }
  }, [trainingFilter, trainingSearch]);

  // Fetch posting locations
  const fetchPostingLocations = useCallback(async () => {
    try {
      const response = await postingLocationsAPI.getAll();
      setPostingLocations(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch posting locations:', error);
    }
  }, []);

  // Fetch REI postings
  const fetchREIPostings = useCallback(async () => {
    try {
      const response = await reiPostingsAPI.active();
      setReiPostings(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch REI postings:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'training') {
      fetchTrainingRecords();
    } else if (activeTab === 'posting') {
      fetchPostingLocations();
    } else if (activeTab === 'rei') {
      fetchREIPostings();
    }
  }, [activeTab, fetchTrainingRecords, fetchPostingLocations, fetchREIPostings]);

  // Handle training save
  const handleTrainingSave = async (data, id) => {
    if (id) {
      await wpsTrainingAPI.update(id, data);
    } else {
      await wpsTrainingAPI.create(data);
    }
    fetchTrainingRecords();
  };

  // Handle training delete
  const handleTrainingDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this training record?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    await wpsTrainingAPI.delete(id);
    fetchTrainingRecords();
  };

  // Handle verify posting location
  const handleVerifyLocation = async (id) => {
    await postingLocationsAPI.verify(id);
    fetchPostingLocations();
  };

  // Handle mark REI posted
  const handleMarkPosted = async (id) => {
    await reiPostingsAPI.markPosted(id);
    fetchREIPostings();
  };

  // Handle mark REI removed
  const handleMarkRemoved = async (id) => {
    await reiPostingsAPI.markRemoved(id);
    fetchREIPostings();
  };

  // Training stats
  const trainingStats = {
    total: trainingRecords.length,
    current: trainingRecords.filter(r => getDaysUntil(r.expiration_date) > 90).length,
    expiring: trainingRecords.filter(r => {
      const days = getDaysUntil(r.expiration_date);
      return days > 0 && days <= 90;
    }).length,
    expired: trainingRecords.filter(r => getDaysUntil(r.expiration_date) <= 0).length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <button onClick={() => onNavigate?.('compliance')} className="hover:text-primary">
              Compliance
            </button>
            <span>/</span>
            <span>WPS Compliance</span>
          </div>
        </div>

        {activeTab === 'training' && (
          <button
            onClick={() => { setEditingRecord(null); setShowTrainingModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Training
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('training')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'training'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-bark-700'}`}
          >
            <Users className="w-4 h-4" />
            Training Records
          </button>
          <button
            onClick={() => setActiveTab('posting')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'posting'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-bark-700'}`}
          >
            <MapPin className="w-4 h-4" />
            Central Posting
          </button>
          <button
            onClick={() => setActiveTab('rei')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
              ${activeTab === 'rei'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-bark-700'}`}
          >
            <Clock className="w-4 h-4" />
            REI Tracker
          </button>
        </nav>
      </div>

      {/* Training Tab */}
      {activeTab === 'training' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-surface-raised border border-border rounded-card p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-bark-600" />
                <span className="text-2xl font-bold text-heading">{trainingStats.total}</span>
              </div>
              <p className="text-sm text-bark-600 mt-1">Total Records</p>
            </div>
            <div className="bg-primary-light border border-green-100 rounded-card p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold text-primary">{trainingStats.current}</span>
              </div>
              <p className="text-sm text-primary mt-1">Current</p>
            </div>
            <div className="bg-yellow-100 border border-yellow-200 rounded-card p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-600">{trainingStats.expiring}</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">Expiring Soon</p>
            </div>
            <div className="bg-danger-bg border border-danger/20 rounded-card p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-danger" />
                <span className="text-2xl font-bold text-danger">{trainingStats.expired}</span>
              </div>
              <p className="text-sm text-danger mt-1">Expired</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="bg-surface-raised border border-border rounded-card p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-muted" />
                  <select
                    value={trainingFilter}
                    onChange={(e) => setTrainingFilter(e.target.value)}
                    className="border-0 bg-transparent text-sm font-medium text-bark-700 focus:ring-0 cursor-pointer"
                  >
                    <option value="all">All Records</option>
                    <option value="current">Current</option>
                    <option value="expiring">Expiring Soon</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={trainingSearch}
                  onChange={(e) => setTrainingSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-border-strong rounded-card text-sm focus:ring-2 focus:ring-primary focus:border-primary w-64"
                />
              </div>
            </div>
          </div>

          {/* Training Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
            </div>
          ) : trainingRecords.length > 0 ? (
            <div className="bg-surface-raised border border-border rounded-card overflow-hidden">
              <table className="w-full">
                <thead className="bg-cream-50 border-b border-border bg-surface-sunken">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Training Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Expiration</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Trainer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trainingRecords.map(record => (
                    <TrainingRow
                      key={record.id}
                      record={record}
                      onEdit={(r) => { setEditingRecord(r); setShowTrainingModal(true); }}
                      onDelete={handleTrainingDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-surface-raised border border-border rounded-card p-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-text-muted" />
              <p className="font-medium text-heading">No training records found</p>
              <p className="text-sm text-text-secondary mt-1">Add your first WPS training record</p>
              <button
                onClick={() => { setEditingRecord(null); setShowTrainingModal(true); }}
                className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Add Training
              </button>
            </div>
          )}
        </>
      )}

      {/* Central Posting Tab */}
      {activeTab === 'posting' && (
        <div>
          <div className="bg-orange-50 border border-orange-200 rounded-card p-4 mb-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-link mt-0.5" />
              <div>
                <p className="font-medium text-orange-700">Central Posting Requirements</p>
                <p className="text-sm text-orange-700 mt-1">
                  WPS requires a central posting location at each establishment where workers and handlers can access safety information,
                  including the WPS safety poster, emergency information, SDS sheets, and recent pesticide application information.
                </p>
              </div>
            </div>
          </div>

          {postingLocations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {postingLocations.map(location => (
                <PostingLocationCard
                  key={location.id}
                  location={location}
                  onVerify={handleVerifyLocation}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-raised border border-border rounded-card p-12 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-text-muted" />
              <p className="font-medium text-heading">No posting locations configured</p>
              <p className="text-sm text-text-secondary mt-1">Add central posting locations for your farms</p>
            </div>
          )}
        </div>
      )}

      {/* REI Tracker Tab */}
      {activeTab === 'rei' && (
        <div>
          <div className="bg-yellow-100 border border-yellow-200 rounded-card p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Restricted Entry Interval (REI)</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Track active REIs and ensure proper posting and removal of entry restriction notices.
                  Workers may not enter treated areas until the REI has expired.
                </p>
              </div>
            </div>
          </div>

          {reiPostings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reiPostings.map(posting => (
                <REIPostingCard
                  key={posting.id}
                  posting={posting}
                  onMarkPosted={handleMarkPosted}
                  onMarkRemoved={handleMarkRemoved}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface-raised border border-border rounded-card p-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-text-muted" />
              <p className="font-medium text-heading">No active REI postings</p>
              <p className="text-sm text-text-secondary mt-1">REI records are automatically created from pesticide applications</p>
            </div>
          )}
        </div>
      )}

      {/* Training Modal */}
      {showTrainingModal && (
        <TrainingModal
          record={editingRecord}
          onClose={() => { setShowTrainingModal(false); setEditingRecord(null); }}
          onSave={handleTrainingSave}
        />
      )}
    </div>
  );
}
