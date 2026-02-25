import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// ---------------------------------------------------------------------------
// Contact type definitions
// ---------------------------------------------------------------------------

const CONTACT_TYPES = [
  { value: 'fire_dept',             label: 'Fire Department',           category: 'Emergency Services' },
  { value: 'police',                label: 'Police',                    category: 'Emergency Services' },
  { value: 'ambulance',             label: 'Ambulance / EMS',           category: 'Emergency Services' },
  { value: 'hospital',              label: 'Hospital',                  category: 'Emergency Services' },
  { value: 'poison_control',        label: 'Poison Control',            category: 'Emergency Services' },
  { value: 'county_ag',             label: 'County Ag Department',      category: 'Regulatory Agencies' },
  { value: 'state_ag',              label: 'State Ag Department',       category: 'Regulatory Agencies' },
  { value: 'fda',                   label: 'FDA',                       category: 'Regulatory Agencies' },
  { value: 'cdfa',                  label: 'CDFA',                      category: 'Regulatory Agencies' },
  { value: 'epa',                   label: 'EPA',                       category: 'Regulatory Agencies' },
  { value: 'water_board',           label: 'Water Board',               category: 'Regulatory Agencies' },
  { value: 'pest_control_advisor',  label: 'Pest Control Advisor',      category: 'Farm Resources' },
  { value: 'food_safety_coordinator', label: 'Food Safety Coordinator', category: 'Farm Resources' },
  { value: 'company_management',    label: 'Company Management',        category: 'Farm Resources' },
  { value: 'insurance',             label: 'Insurance',                 category: 'Farm Resources' },
  { value: 'legal',                 label: 'Legal',                     category: 'Farm Resources' },
  { value: 'other',                 label: 'Other',                     category: 'Other' },
];

const TYPE_MAP = Object.fromEntries(CONTACT_TYPES.map((t) => [t.value, t]));

const CATEGORIES = ['Emergency Services', 'Regulatory Agencies', 'Farm Resources', 'Other'];

const CATEGORY_COLORS = {
  'Emergency Services': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Regulatory Agencies': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Farm Resources': 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400',
  'Other': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const EMPTY_FORM = {
  contact_type: 'fire_dept',
  organization_name: '',
  contact_name: '',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  address: '',
  active: true,
  notes: '',
};

// ---------------------------------------------------------------------------
// Contact Modal
// ---------------------------------------------------------------------------

const ContactModal = ({ editContact, onClose, onSave }) => {
  const isEditing = !!editContact;

  const [form, setForm] = useState(() => {
    if (editContact) {
      return {
        contact_type:      editContact.contact_type      || 'fire_dept',
        organization_name: editContact.organization_name || '',
        contact_name:      editContact.contact_name      || '',
        phone_primary:     editContact.phone_primary     || '',
        phone_secondary:   editContact.phone_secondary   || '',
        email:             editContact.email             || '',
        address:           editContact.address           || '',
        active:            editContact.active !== undefined ? editContact.active : true,
        notes:             editContact.notes             || '',
      };
    }
    return { ...EMPTY_FORM };
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    set(name, type === 'checkbox' ? checked : value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form, editContact?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save emergency contact:', err);
      setSaveError(
        err.response?.data?.detail ||
          Object.values(err.response?.data || {})[0] ||
          'Failed to save contact. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {saveError}
            </div>
          )}

          {/* Contact Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contact Type *
            </label>
            <select
              name="contact_type"
              required
              value={form.contact_type}
              onChange={handleChange}
              className={inputCls}
            >
              {CATEGORIES.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {CONTACT_TYPES.filter((t) => t.category === cat).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Organization + Contact Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                name="organization_name"
                required
                value={form.organization_name}
                onChange={handleChange}
                placeholder="e.g. City Fire Station #3"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                placeholder="e.g. John Smith"
                className={inputCls}
              />
            </div>
          </div>

          {/* Phone Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Phone *
              </label>
              <input
                type="tel"
                name="phone_primary"
                required
                value={form.phone_primary}
                onChange={handleChange}
                placeholder="(555) 555-5555"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Secondary Phone <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                name="phone_secondary"
                value={form.phone_secondary}
                onChange={handleChange}
                placeholder="(555) 555-5556"
                className={inputCls}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="contact@example.com"
              className={inputCls}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              rows={2}
              placeholder="Street address, City, State, ZIP"
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Any additional information..."
              className={inputCls}
            />
          </div>

          {/* Active toggle */}
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Active contact
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

const DeleteConfirmModal = ({ contactName, onConfirm, onCancel, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Delete Contact?
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
        This will permanently remove <span className="font-medium text-gray-900 dark:text-white">{contactName}</span> from your emergency contact directory. This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
          Delete
        </button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Contact Card
// ---------------------------------------------------------------------------

const ContactCard = ({ contact, onEdit, onDelete }) => {
  const typeInfo = TYPE_MAP[contact.contact_type] || { label: contact.contact_type, category: 'Other' };
  const categoryColor = CATEGORY_COLORS[typeInfo.category] || CATEGORY_COLORS['Other'];

  return (
    <div className={`bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col gap-3 transition-opacity ${contact.active ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700/50 opacity-60'}`}>
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor}`}>
              {typeInfo.label}
            </span>
            {!contact.active && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                Inactive
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
            {contact.organization_name}
          </h3>
          {contact.contact_name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {contact.contact_name}
            </p>
          )}
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(contact)}
            className="p-1.5 text-primary hover:bg-primary-light dark:hover:bg-green-900/20 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(contact)}
            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Phone Numbers */}
      <div className="space-y-1">
        {contact.phone_primary && (
          <a
            href={`tel:${contact.phone_primary.replace(/\s/g, '')}`}
            className="flex items-center gap-2 text-sm text-primary dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors group"
          >
            <Phone className="w-3.5 h-3.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-medium">{contact.phone_primary}</span>
          </a>
        )}
        {contact.phone_secondary && (
          <a
            href={`tel:${contact.phone_secondary.replace(/\s/g, '')}`}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-hover dark:hover:text-green-400 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{contact.phone_secondary}</span>
          </a>
        )}
      </div>

      {/* Email */}
      {contact.email && (
        <a
          href={`mailto:${contact.email}`}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-hover dark:hover:text-green-400 transition-colors truncate block"
        >
          {contact.email}
        </a>
      )}

      {/* Address */}
      {contact.address && (
        <p className="text-xs text-gray-400 dark:text-gray-500 leading-snug">
          {contact.address}
        </p>
      )}

      {/* Notes */}
      {contact.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-100 dark:border-gray-700 pt-2 leading-snug">
          {contact.notes}
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EmergencyContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [deletingContact, setDeletingContact] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // ---------- Data Fetching ----------

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (!showInactive) params.active = true;
      const res = await primusGFSAPI.getEmergencyContacts(params);
      setContacts(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch emergency contacts:', err);
      setError('Failed to load emergency contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // ---------- CRUD ----------

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateEmergencyContact(id, formData);
    } else {
      await primusGFSAPI.createEmergencyContact(formData);
    }
    fetchContacts();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContact) return;
    setIsDeleting(true);
    try {
      await primusGFSAPI.deleteEmergencyContact(deletingContact.id);
      setDeletingContact(null);
      fetchContacts();
    } catch (err) {
      console.error('Failed to delete contact:', err);
      setError('Failed to delete contact. Please try again.');
      setDeletingContact(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------- Group contacts by category ----------

  const groupedContacts = CATEGORIES.reduce((acc, cat) => {
    const types = CONTACT_TYPES.filter((t) => t.category === cat).map((t) => t.value);
    const filtered = contacts.filter((c) => types.includes(c.contact_type));
    if (filtered.length > 0) acc[cat] = filtered;
    return acc;
  }, {});

  // ---------- Loading State (initial) ----------

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 animate-spin text-primary dark:text-green-400" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading emergency contacts...</span>
      </div>
    );
  }

  // ---------- Error State (initial load only) ----------

  if (error && contacts.length === 0) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
        <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchContacts}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  // ---------- Main Render ----------

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary dark:text-green-400" />
            Emergency Contact Directory
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            CAC Manual Doc 21 &mdash; Key contacts for emergency response
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active / All toggle */}
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400 select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary focus:ring-offset-0"
            />
            Show inactive
          </label>
          <button
            onClick={() => {
              setEditingContact(null);
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Inline error banner (when data already loaded) */}
      {error && contacts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading indicator while refreshing */}
      {loading && contacts.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Empty State */}
      {!loading && contacts.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Phone className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-900 dark:text-white">No emergency contacts yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Build your emergency contact directory with fire, police, regulatory agencies, and farm resources.
          </p>
          <button
            onClick={() => {
              setEditingContact(null);
              setShowModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Contact
          </button>
        </div>
      )}

      {/* Grouped Card Grid */}
      {!loading && contacts.length > 0 && (
        <div className="space-y-6">
          {CATEGORIES.map((cat) => {
            const group = groupedContacts[cat];
            if (!group) return null;
            return (
              <div key={cat}>
                {/* Category heading */}
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    {cat}
                  </h3>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {group.length} contact{group.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Card grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {group.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={(c) => {
                        setEditingContact(c);
                        setShowModal(true);
                      }}
                      onDelete={(c) => setDeletingContact(c)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <ContactModal
          editContact={editingContact}
          onClose={() => {
            setShowModal(false);
            setEditingContact(null);
          }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingContact && (
        <DeleteConfirmModal
          contactName={deletingContact.organization_name || 'this contact'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingContact(null)}
          deleting={isDeleting}
        />
      )}
    </div>
  );
}
