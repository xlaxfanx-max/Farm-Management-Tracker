import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// eslint-disable-next-line no-unused-vars
const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ROLE_CATEGORIES = [
  { value: 'management', label: 'Management' },
  { value: 'food_safety_team', label: 'Food Safety Team' },
  { value: 'field_operations', label: 'Field Operations' },
  { value: 'quality_assurance', label: 'Quality Assurance' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

const categoryLabel = (val) => ROLE_CATEGORIES.find((c) => c.value === val)?.label || val;

const INITIAL_FORM = {
  person_name: '', role_title: '', role_category: 'food_safety_team',
  responsibilities: [], phone: '', email: '', backup_person: '', active: true, notes: '',
};

const RoleModal = ({ role, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (role) {
      return {
        person_name: role.person_name || '', role_title: role.role_title || '',
        role_category: role.role_category || 'food_safety_team',
        responsibilities: role.responsibilities || [], phone: role.phone || '',
        email: role.email || '', backup_person: role.backup_person || '',
        active: role.active !== false, notes: role.notes || '',
      };
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newResp, setNewResp] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const addResponsibility = () => {
    if (newResp.trim()) {
      setFormData((prev) => ({ ...prev, responsibilities: [...prev.responsibilities, newResp.trim()] }));
      setNewResp('');
    }
  };

  const removeResponsibility = (idx) => {
    setFormData((prev) => ({ ...prev, responsibilities: prev.responsibilities.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {role ? 'Edit Role Assignment' : 'New Role Assignment'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">{saveError}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Person Name *</label>
              <input name="person_name" value={formData.person_name} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Title *</label>
              <input name="role_title" value={formData.role_title} onChange={handleChange} required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select name="role_category" value={formData.role_category} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              {ROLE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input name="phone" value={formData.phone} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input name="email" type="email" value={formData.email} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Person</label>
            <input name="backup_person" value={formData.backup_person} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsibilities</label>
            <div className="space-y-2">
              {formData.responsibilities.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 rounded">{r}</span>
                  <button type="button" onClick={() => removeResponsibility(i)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newResp} onChange={(e) => setNewResp(e.target.value)} placeholder="Add responsibility..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addResponsibility(); } }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                <button type="button" onClick={addResponsibility}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Add</button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" name="active" checked={formData.active} onChange={handleChange} className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}{role ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OrgRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await primusGFSAPI.getOrgRoles();
      setRoles(res.data.results || res.data || []);
    } catch (err) {
      setError('Failed to load org roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const handleSave = async (data) => {
    if (editingRole) {
      await primusGFSAPI.updateOrgRole(editingRole.id, data);
    } else {
      await primusGFSAPI.createOrgRole(data);
    }
    loadRoles();
  };

  const handleDelete = async (id) => {
    try {
      setDeleting(id);
      await primusGFSAPI.deleteOrgRole(id);
      loadRoles();
    } catch {
      setError('Failed to delete role.');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-green-600" /> Organization Roles (Doc 02)
        </h2>
        <div className="flex gap-2">
          <button onClick={loadRoles} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => { setEditingRole(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> Add Role
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}

      {roles.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          No role assignments yet. Add your first role to build the org chart.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${!role.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{role.person_name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{role.role_title}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingRole(role); setShowModal(true); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                  <button onClick={() => handleDelete(role.id)} disabled={deleting === role.id} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                    {deleting === role.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-red-500" />}
                  </button>
                </div>
              </div>
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 mb-2">
                {categoryLabel(role.role_category)}
              </span>
              {role.responsibilities && role.responsibilities.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {role.responsibilities.slice(0, 3).map((r, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">&#8226;</span> {r}
                    </li>
                  ))}
                  {role.responsibilities.length > 3 && (
                    <li className="text-xs text-gray-400">+{role.responsibilities.length - 3} more</li>
                  )}
                </ul>
              )}
              {role.backup_person && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Backup: {role.backup_person}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RoleModal
          role={editingRole}
          onClose={() => { setShowModal(false); setEditingRole(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default OrgRoles;
