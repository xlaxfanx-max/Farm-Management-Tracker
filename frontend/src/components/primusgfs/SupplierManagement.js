import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Ban,
  ClipboardCheck,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import PrefillBanner from './PrefillBanner';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'removed', label: 'Removed' },
];

const MATERIAL_TYPES = [
  { value: 'seed', label: 'Seed' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticide', label: 'Pesticide' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'water_treatment', label: 'Water Treatment' },
  { value: 'cleaning_chemical', label: 'Cleaning Chemical' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'soil_amendment', label: 'Soil Amendment' },
  { value: 'other', label: 'Other' },
];

const materialLabel = (val) => MATERIAL_TYPES.find((m) => m.value === val)?.label || val;

const statusBadgeStyles = {
  pending_approval: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  conditional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  removed: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const statusLabels = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  conditional: 'Conditional',
  suspended: 'Suspended',
  removed: 'Removed',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[status] || statusBadgeStyles.pending_approval}`}>
    {statusLabels[status] || status}
  </span>
);

const INITIAL_SUPPLIER = {
  supplier_name: '', supplier_code: '', contact_name: '', contact_email: '', contact_phone: '',
  address: '', material_types: [], status: 'pending_approval', certifications: [], notes: '',
  next_review_date: '', last_audit_date: '', last_audit_score: '',
};

const INITIAL_VERIFICATION = {
  supplier: '', receipt_date: '', material_type: '', material_description: '', lot_number: '',
  quantity: '', condition_acceptable: true, labeling_correct: true, certificate_verified: true,
  temperature_acceptable: null, accepted: true, rejection_reason: '', verified_by: '', notes: '',
};

const SupplierModal = ({ supplier, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (supplier) {
      return {
        supplier_name: supplier.supplier_name || '', supplier_code: supplier.supplier_code || '',
        contact_name: supplier.contact_name || '', contact_email: supplier.contact_email || '',
        contact_phone: supplier.contact_phone || '', address: supplier.address || '',
        material_types: supplier.material_types || [], certifications: supplier.certifications || [],
        notes: supplier.notes || '', next_review_date: supplier.next_review_date || '',
        last_audit_date: supplier.last_audit_date || '', last_audit_score: supplier.last_audit_score || '',
      };
    }
    return { ...INITIAL_SUPPLIER };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMaterial = (val) => {
    setFormData((prev) => ({
      ...prev,
      material_types: prev.material_types.includes(val)
        ? prev.material_types.filter((m) => m !== val)
        : [...prev.material_types, val],
    }));
  };

  const addCert = () => setFormData((prev) => ({
    ...prev, certifications: [...prev.certifications, { name: '', number: '', expiry: '' }],
  }));

  const updateCert = (idx, field, value) => {
    setFormData((prev) => {
      const certs = [...prev.certifications];
      certs[idx] = { ...certs[idx], [field]: value };
      return { ...prev, certifications: certs };
    });
  };

  const removeCert = (idx) => setFormData((prev) => ({
    ...prev, certifications: prev.certifications.filter((_, i) => i !== idx),
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData, supplier?.id);
      onClose();
    } catch (error) {
      console.error('Failed to save supplier:', error);
      setSaveError(error.response?.data?.detail || 'Failed to save supplier. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {supplier ? 'Edit Supplier' : 'Add Supplier'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Name *</label>
              <input type="text" name="supplier_name" required value={formData.supplier_name} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Code</label>
              <input type="text" name="supplier_code" value={formData.supplier_code} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Name</label>
              <input type="text" name="contact_name" value={formData.contact_name} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Email</label>
              <input type="email" name="contact_email" value={formData.contact_email} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Phone</label>
              <input type="text" name="contact_phone" value={formData.contact_phone} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material Types</label>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_TYPES.map((mt) => (
                <button key={mt.value} type="button" onClick={() => toggleMaterial(mt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${formData.material_types.includes(mt.value) ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'}`}>
                  {mt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Review</label>
              <input type="date" name="next_review_date" value={formData.next_review_date} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Audit Date</label>
              <input type="date" name="last_audit_date" value={formData.last_audit_date} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audit Score</label>
              <input type="number" name="last_audit_score" value={formData.last_audit_score} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          {/* Certifications */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Certifications</label>
              <button type="button" onClick={addCert} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400">+ Add</button>
            </div>
            {formData.certifications.map((cert, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <input type="text" placeholder="Name" value={cert.name} onChange={(e) => updateCert(idx, 'name', e.target.value)} className={`${inputCls} text-sm`} />
                <input type="text" placeholder="Number" value={cert.number} onChange={(e) => updateCert(idx, 'number', e.target.value)} className={`${inputCls} text-sm`} />
                <input type="date" value={cert.expiry} onChange={(e) => updateCert(idx, 'expiry', e.target.value)} className={`${inputCls} text-sm`} />
                <button type="button" onClick={() => removeCert(idx)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputCls} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : supplier ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const VerificationModal = ({ suppliers, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...INITIAL_VERIFICATION });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save verification:', error);
      setSaveError(error.response?.data?.detail || 'Failed to save verification. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';
  const checkCls = 'w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 rounded focus:ring-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Material Verification</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier *</label>
              <select name="supplier" required value={formData.supplier} onChange={handleChange} className={inputCls}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt Date *</label>
              <input type="date" name="receipt_date" required value={formData.receipt_date} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Material Type *</label>
              <select name="material_type" required value={formData.material_type} onChange={handleChange} className={inputCls}>
                <option value="">Select type</option>
                {MATERIAL_TYPES.map((mt) => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lot Number</label>
              <input type="text" name="lot_number" value={formData.lot_number} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input type="text" name="material_description" value={formData.material_description} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <input type="text" name="quantity" value={formData.quantity} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Verification Checks</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'condition_acceptable', label: 'Condition Acceptable' },
                { name: 'labeling_correct', label: 'Labeling Correct' },
                { name: 'certificate_verified', label: 'Certificate Verified' },
                { name: 'temperature_acceptable', label: 'Temperature Acceptable' },
              ].map((chk) => (
                <label key={chk.name} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" name={chk.name} checked={!!formData[chk.name]} onChange={handleChange} className={checkCls} />
                  {chk.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <input type="checkbox" name="accepted" checked={formData.accepted} onChange={handleChange} className={checkCls} />
              Material Accepted
            </label>
          </div>
          {!formData.accepted && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rejection Reason</label>
              <textarea name="rejection_reason" value={formData.rejection_reason} onChange={handleChange} rows={2} className={inputCls} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verified By</label>
              <input type="text" name="verified_by" value={formData.verified_by} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input type="text" name="notes" value={formData.notes} onChange={handleChange} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Create Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function SupplierManagement() {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [suppliers, setSuppliers] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [dueForReview, setDueForReview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;
      const [suppRes, dueRes] = await Promise.all([
        primusGFSAPI.getSuppliers(params),
        primusGFSAPI.suppliersDueForReview(),
      ]);
      setSuppliers(suppRes.data.results || suppRes.data || []);
      setDueForReview(dueRes.data.results || dueRes.data || []);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
      setError('Failed to load suppliers. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterSupplier) params.supplier = filterSupplier;
      const res = await primusGFSAPI.getMaterialVerifications(params);
      setVerifications(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch verifications:', err);
      setError('Failed to load verifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterSupplier]);

  useEffect(() => {
    if (activeTab === 'suppliers') fetchSuppliers();
    else fetchVerifications();
  }, [activeTab, fetchSuppliers, fetchVerifications]);

  const handleSaveSupplier = async (formData, id) => {
    if (id) await primusGFSAPI.updateSupplier(id, formData);
    else await primusGFSAPI.createSupplier(formData);
    fetchSuppliers();
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;
    try { await primusGFSAPI.deleteSupplier(id); fetchSuppliers(); }
    catch (err) { console.error('Failed to delete supplier:', err); }
  };

  const handleApprove = async (id) => {
    try { await primusGFSAPI.approveSupplier(id); fetchSuppliers(); }
    catch (err) { console.error('Failed to approve supplier:', err); }
  };

  const handleSuspend = async (id) => {
    try { await primusGFSAPI.suspendSupplier(id); fetchSuppliers(); }
    catch (err) { console.error('Failed to suspend supplier:', err); }
  };

  const handleSaveVerification = async (formData) => {
    await primusGFSAPI.createMaterialVerification(formData);
    fetchVerifications();
  };

  const handleDeleteVerification = async (id) => {
    if (!window.confirm('Are you sure you want to delete this verification?')) return;
    try { await primusGFSAPI.deleteMaterialVerification(id); fetchVerifications(); }
    catch (err) { console.error('Failed to delete verification:', err); }
  };

  const tabCls = (tab) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-6 h-6" />
          Supplier Management
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab('suppliers')} className={tabCls('suppliers')}>Approved Suppliers</button>
          <button onClick={() => setActiveTab('verifications')} className={tabCls('verifications')}>Material Verifications</button>
        </div>
      </div>

      {/* Prefill from Product Suppliers & Labor Contractors */}
      {activeTab === 'suppliers' && (
        <PrefillBanner
          module="suppliers"
          sourceLabel="Product Suppliers & Labor Contractors"
          onImport={async (items) => {
            let count = 0;
            for (const item of items) {
              try {
                await primusGFSAPI.createSupplier({
                  supplier_name: item.supplier_name,
                  contact_name: item.contact_name || '',
                  contact_phone: item.contact_phone || '',
                  contact_email: item.contact_email || '',
                  material_types: item.material_types || [],
                  status: 'pending_approval',
                  notes: `Imported from ${item.source}.${item.product_count > 0 ? ' ' + item.product_count + ' product(s) on record.' : ''}`,
                });
                count++;
              } catch (err) {
                console.error('Failed to import supplier:', err);
              }
            }
            fetchSuppliers();
            return { count };
          }}
        />
      )}

      {/* Due for Review Alert */}
      {activeTab === 'suppliers' && dueForReview.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="font-medium text-yellow-700 dark:text-yellow-400">{dueForReview.length} supplier(s) due for review</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueForReview.map((s) => (
              <span key={s.id} className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 rounded">
                {s.supplier_name} - Review by {formatDate(s.next_review_date)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {activeTab === 'suppliers' ? (
            <>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search suppliers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <button onClick={() => { setEditingSupplier(null); setShowSupplierModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Plus className="w-4 h-4" /> Add Supplier
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  <option value="">All Suppliers</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                </select>
              </div>
              <button onClick={() => setShowVerificationModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                <Plus className="w-4 h-4" /> Add Verification
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={activeTab === 'suppliers' ? fetchSuppliers : fetchVerifications}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      )}

      {/* Suppliers Table */}
      {!loading && !error && activeTab === 'suppliers' && (
        suppliers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">No suppliers found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your first approved supplier to get started.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Materials</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Approved</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Next Review</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.supplier_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{s.supplier_code || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(s.material_types || []).map((mt) => (
                            <span key={mt} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">{materialLabel(mt)}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(s.approved_date)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(s.next_review_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {(s.status === 'pending_approval' || s.status === 'conditional') && (
                            <button onClick={() => handleApprove(s.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="Approve">
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          {s.status === 'approved' && (
                            <button onClick={() => handleSuspend(s.id)} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors" title="Suspend">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => { setEditingSupplier(s); setShowSupplierModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteSupplier(s.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Verifications Table */}
      {!loading && !error && activeTab === 'verifications' && (
        verifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">No verifications found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record your first incoming material verification.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Date</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Supplier</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Material</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Lot #</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Checks</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Result</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {verifications.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(v.receipt_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{v.supplier_name || v.supplier}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{materialLabel(v.material_type)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{v.lot_number || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {v.condition_acceptable && <CheckCircle className="w-4 h-4 text-green-500" title="Condition OK" />}
                          {v.labeling_correct && <CheckCircle className="w-4 h-4 text-green-500" title="Labels OK" />}
                          {v.certificate_verified && <CheckCircle className="w-4 h-4 text-green-500" title="Cert OK" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.accepted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {v.accepted ? 'Accepted' : 'Rejected'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleDeleteVerification(v.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => { setShowSupplierModal(false); setEditingSupplier(null); }}
          onSave={handleSaveSupplier}
        />
      )}
      {showVerificationModal && (
        <VerificationModal
          suppliers={suppliers}
          onClose={() => setShowVerificationModal(false)}
          onSave={handleSaveVerification}
        />
      )}
    </div>
  );
}
