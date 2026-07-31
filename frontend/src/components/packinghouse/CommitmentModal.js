// =============================================================================
// COMMITMENT MODAL — add/edit one packer commitment for the season plan
// =============================================================================

import React, { useState } from 'react';
import { X, Building2, Save, Loader2 } from 'lucide-react';
import { packerCommitmentsAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';

const CommitmentModal = ({ season, houses, commitment, onClose, onSave }) => {
  const toast = useToast();
  const { fields } = useData();
  const [formData, setFormData] = useState({
    commodity: commitment?.commodity || 'LEMONS',
    packinghouse: commitment?.packinghouse || '',
    field: commitment?.field || '',
    flex: commitment?.flex || false,
    notes: commitment?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.packinghouse) newErrors.packinghouse = 'Required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payload = {
      season,
      commodity: formData.commodity,
      packinghouse: formData.packinghouse,
      field: formData.field || null,
      flex: formData.flex,
      notes: formData.notes,
    };

    setSaving(true);
    try {
      if (commitment) {
        await packerCommitmentsAPI.patch(commitment.id, payload);
      } else {
        await packerCommitmentsAPI.create(payload);
      }
      toast.success('Commitment saved');
      onSave();
    } catch (error) {
      console.error('Error saving commitment:', error);
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        setErrors(data);
        const first = Object.values(data)[0];
        if (first) toast.error(Array.isArray(first) ? first[0] : String(first));
      } else {
        toast.error('Failed to save commitment');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised rounded-card shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg text-heading flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-primary" />
            {commitment ? 'Edit Commitment' : 'Add Commitment'}
          </h3>
          <button aria-label="Close" onClick={onClose} className="p-1 text-text-muted hover:text-bark-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Commodity</label>
              <select
                name="commodity" value={formData.commodity} onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              >
                {PACKINGHOUSE_CONSTANTS.commodities.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.commodity && <p className="text-xs text-danger mt-1">{errors.commodity}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Packinghouse</label>
              <select
                name="packinghouse" value={formData.packinghouse} onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              >
                <option value="">Select…</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>{h.short_code || h.name}</option>
                ))}
              </select>
              {errors.packinghouse && <p className="text-xs text-danger mt-1">{errors.packinghouse}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Block (optional)</label>
            <select
              name="field" value={formData.field} onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              <option value="">Whole commodity (default)</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>{f.farm_name ? `${f.farm_name} · ` : ''}{f.name}</option>
              ))}
            </select>
            <p className="text-xs text-text-secondary mt-1">
              Leave blank for the commodity default; pick a block to override it.
            </p>
            {errors.field && <p className="text-xs text-danger mt-1">{errors.field}</p>}
          </div>

          <label className="flex items-start gap-2 text-sm text-bark-700">
            <input
              type="checkbox" name="flex" checked={formData.flex} onChange={handleChange}
              className="mt-0.5 rounded border-border-strong text-primary focus:ring-primary"
            />
            <span>
              <span className="font-medium">Flex</span> — destination decided pick
              by pick (e.g. avocados); other houses on receipts won't be flagged.
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Notes</label>
            <input
              name="notes" value={formData.notes} onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 border border-border-strong rounded-button text-sm hover:bg-cream-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {commitment ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CommitmentModal;
