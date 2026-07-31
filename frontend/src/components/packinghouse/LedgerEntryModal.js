// =============================================================================
// LEDGER ENTRY MODAL
// Record cash received from a packinghouse: advances during the pool,
// the pool-close check, or other payments. Cash from the house is entered
// as a CREDIT — the pool-close reconciliation sums credits.
// =============================================================================

import React, { useState } from 'react';
import { X, DollarSign, Save, Loader2 } from 'lucide-react';
import { growerLedgerAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const CASH_TYPES = ['advance', 'pool_close', 'payment'];

const LedgerEntryModal = ({ packinghouseId, poolId, entry, onClose, onSave }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    entry_date: entry?.entry_date || new Date().toISOString().split('T')[0],
    entry_type: entry?.entry_type || 'advance',
    amount: entry ? (entry.credit || entry.debit || '') : '',
    reference: entry?.reference || '',
    description: entry?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.entry_date) newErrors.entry_date = 'Required';
    if (!formData.amount || Number(formData.amount) <= 0) newErrors.amount = 'Required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const isCash = CASH_TYPES.includes(formData.entry_type);
    const payload = {
      packinghouse: packinghouseId,
      pool: poolId || null,
      entry_date: formData.entry_date,
      entry_type: formData.entry_type,
      reference: formData.reference,
      description: formData.description,
      // Cash the house pays the grower is a credit; other types keep the
      // sign the accountant intends via the same field for simplicity.
      credit: isCash ? formData.amount : formData.amount,
      debit: 0,
    };

    setSaving(true);
    try {
      if (entry) {
        await growerLedgerAPI.patch(entry.id, payload);
      } else {
        await growerLedgerAPI.create(payload);
      }
      toast.success('Ledger entry saved');
      onSave();
    } catch (error) {
      console.error('Error saving ledger entry:', error);
      const data = error.response?.data;
      if (data && typeof data === 'object') {
        setErrors(data);
        const first = Object.values(data)[0];
        if (first) toast.error(Array.isArray(first) ? first[0] : String(first));
      } else {
        toast.error('Failed to save ledger entry');
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
            <DollarSign className="w-5 h-5 mr-2 text-primary" />
            {entry ? 'Edit Entry' : 'Record Advance / Payment'}
          </h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-bark-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Date received</label>
              <input
                type="date" name="entry_date" value={formData.entry_date}
                onChange={handleChange}
                className="w-full border border-border-strong rounded-card px-3 py-2 text-sm"
              />
              {errors.entry_date && <p className="text-xs text-danger mt-1">{errors.entry_date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Type</label>
              <select
                name="entry_type" value={formData.entry_type} onChange={handleChange}
                className="w-full border border-border-strong rounded-card px-3 py-2 text-sm"
              >
                {PACKINGHOUSE_CONSTANTS.ledgerEntryTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Amount</label>
            <input
              type="number" step="0.01" min="0" name="amount" value={formData.amount}
              onChange={handleChange} placeholder="0.00"
              className="w-full border border-border-strong rounded-card px-3 py-2 text-sm"
            />
            {errors.amount && <p className="text-xs text-danger mt-1">{errors.amount}</p>}
            {errors.credit && <p className="text-xs text-danger mt-1">{errors.credit}</p>}
            <p className="text-xs text-text-secondary mt-1">
              Cash received from the house — recorded as a credit against the pool.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Reference</label>
            <input
              name="reference" value={formData.reference} onChange={handleChange}
              placeholder="Check # or statement reference (e.g. APM-SL-09588)"
              className="w-full border border-border-strong rounded-card px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Description</label>
            <input
              name="description" value={formData.description} onChange={handleChange}
              placeholder="e.g. First advance on 2025-2026 lemon pool"
              className="w-full border border-border-strong rounded-card px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 border border-border-strong rounded-card text-sm hover:bg-cream-50"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {entry ? 'Update' : 'Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LedgerEntryModal;
