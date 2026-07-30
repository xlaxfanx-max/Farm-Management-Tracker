import React, { useEffect, useRef, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { pickHaulManualPicksAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from '../ui/FormField';

// The eight legacy sheet labels; free text is allowed for new sources.
const KNOWN_SHEETS = [
  'Limoneira', 'F&P Mission', "JPF Avo's", "FF Avo's", 'Piru Sun Pac',
  'FPCA - JPF', 'FPCA - FF', 'F&P OTR Limoneira',
];

const EMPTY_PICK = {
  sheet: '',
  packinghouse: '',
  entity: '',
  ranch: '',
  block: '',
  varietal: '',
  pick_date: '',
  date_label: '',
  bins: '',
  lbs: '',
  harvester: '',
  hauler: '',
  invoice_no: '',
  cost: '',
  haul_cost: '',
  date_paid: '',
  net_amount: '',
  date_received: '',
  notes: '',
  count_cost: true,
  count_haul: true,
};

const STICKY_FIELDS = ['sheet', 'packinghouse', 'entity'];

/**
 * One tolerant form for all eight hand-keyed sheet layouts — some have lbs,
 * some haul cost, some net amount. Blank stays blank; the table shows dashes.
 */
export default function ManualPickModal({ isOpen, onClose, onSave, pick = null, season, houses, entities, sourceSheets }) {
  const toast = useToast();
  const [formData, setFormData] = useState(EMPTY_PICK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const ranchRef = useRef(null);

  const sheetOptions = Array.from(new Set([...(sourceSheets || []), ...KNOWN_SHEETS]));

  useEffect(() => {
    if (isOpen) {
      setFormData(pick ? { ...EMPTY_PICK, ...pick } : { ...EMPTY_PICK });
      setErrors({});
    }
  }, [isOpen, pick]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.sheet) newErrors.sheet = 'Required';
    if (!formData.packinghouse) newErrors.packinghouse = 'Required';
    if (!formData.entity) newErrors.entity = 'Required';
    if (!formData.pick_date) newErrors.pick_date = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const payload = () => {
    const data = { ...formData, season };
    for (const key of ['bins', 'lbs', 'cost', 'haul_cost', 'net_amount',
                       'pick_date', 'date_paid', 'date_received']) {
      if (data[key] === '') data[key] = null;
    }
    delete data.house_name;
    delete data.house_code;
    delete data.entity_name;
    delete data.entity_code;
    return data;
  };

  const save = async () => {
    if (pick) {
      await pickHaulManualPicksAPI.patch(pick.id, payload());
    } else {
      await pickHaulManualPicksAPI.create(payload());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await save();
      toast.success('Manual pick saved');
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving manual pick:', error);
      if (error.response?.data && typeof error.response.data === 'object') {
        setErrors(error.response.data);
      } else {
        toast.error('Failed to save manual pick');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAddAnother = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await save();
      toast.success('Manual pick saved');
      onSave();
      setFormData((prev) => {
        const next = { ...EMPTY_PICK };
        STICKY_FIELDS.forEach((f) => { next[f] = prev[f]; });
        return next;
      });
      setErrors({});
      ranchRef.current?.focus();
    } catch (error) {
      console.error('Error saving manual pick:', error);
      toast.error('Failed to save manual pick');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      {!pick && (
        <button
          type="button"
          onClick={handleSaveAndAddAnother}
          disabled={saving}
          className="px-4 py-2 rounded-button border border-primary text-primary hover:bg-primary-light disabled:opacity-50"
        >
          Save &amp; add another
        </button>
      )}
      <button
        type="submit"
        form="pickhaul-manual-pick-form"
        disabled={saving}
        className="px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : pick ? 'Update Pick' : 'Add Pick'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pick ? 'Edit Manual Pick' : 'Add Manual Pick'}
      subtitle={`No-portal houses · Season ${season}`}
      icon={ClipboardList}
      size="lg"
      footer={footer}
    >
      <form id="pickhaul-manual-pick-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Source sheet" htmlFor="ph-mp-sheet" required error={errors.sheet}>
            <input
              id="ph-mp-sheet" name="sheet" value={formData.sheet || ''}
              onChange={handleChange} className={inputClasses} list="ph-sheets"
            />
            <datalist id="ph-sheets">
              {sheetOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </FormField>
          <FormField label="House" htmlFor="ph-mp-house" required error={errors.packinghouse}>
            <select
              id="ph-mp-house" name="packinghouse" value={formData.packinghouse}
              onChange={handleChange} className={selectClasses}
            >
              <option value="">Select…</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.short_code || h.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Entity" htmlFor="ph-mp-entity" required error={errors.entity}>
            <select
              id="ph-mp-entity" name="entity" value={formData.entity}
              onChange={handleChange} className={selectClasses}
            >
              <option value="">Select…</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.short_code}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Ranch" htmlFor="ph-mp-ranch">
            <input
              id="ph-mp-ranch" name="ranch" value={formData.ranch || ''}
              onChange={handleChange} className={inputClasses} ref={ranchRef}
            />
          </FormField>
          <FormField label="Block" htmlFor="ph-mp-block">
            <input
              id="ph-mp-block" name="block" value={formData.block || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Varietal" htmlFor="ph-mp-varietal">
            <input
              id="ph-mp-varietal" name="varietal" value={formData.varietal || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <FormField label="Pick date" htmlFor="ph-mp-date" required error={errors.pick_date}>
            <input
              id="ph-mp-date" name="pick_date" type="date"
              value={formData.pick_date || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Date label" htmlFor="ph-mp-datelabel" hint="e.g. 4/13-4/15">
            <input
              id="ph-mp-datelabel" name="date_label" value={formData.date_label || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Bins" htmlFor="ph-mp-bins">
            <input
              id="ph-mp-bins" name="bins" type="number" step="0.1" min="0"
              value={formData.bins || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Lbs" htmlFor="ph-mp-lbs">
            <input
              id="ph-mp-lbs" name="lbs" type="number" step="0.1" min="0"
              value={formData.lbs || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Harvester" htmlFor="ph-mp-harvester">
            <input
              id="ph-mp-harvester" name="harvester" value={formData.harvester || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Hauler" htmlFor="ph-mp-hauler">
            <input
              id="ph-mp-hauler" name="hauler" value={formData.hauler || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Invoice #" htmlFor="ph-mp-invno">
            <input
              id="ph-mp-invno" name="invoice_no" value={formData.invoice_no || ''}
              onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Pick cost" htmlFor="ph-mp-cost">
            <input
              id="ph-mp-cost" name="cost" type="number" step="0.01" min="0"
              value={formData.cost || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Haul cost" htmlFor="ph-mp-haulcost">
            <input
              id="ph-mp-haulcost" name="haul_cost" type="number" step="0.01" min="0"
              value={formData.haul_cost || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Net amount" htmlFor="ph-mp-net">
            <input
              id="ph-mp-net" name="net_amount" type="number" step="0.01"
              value={formData.net_amount || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date paid" htmlFor="ph-mp-paid">
            <input
              id="ph-mp-paid" name="date_paid" type="date"
              value={formData.date_paid || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Date received" htmlFor="ph-mp-received">
            <input
              id="ph-mp-received" name="date_received" type="date"
              value={formData.date_received || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="flex gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                 title="Uncheck when this row repeats the invoice above — summing would double-count it.">
            <input
              type="checkbox" name="count_cost" checked={formData.count_cost}
              onChange={handleChange}
              className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
            />
            Count pick cost in totals
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"
                 title="Uncheck when this row repeats the haul invoice above.">
            <input
              type="checkbox" name="count_haul" checked={formData.count_haul}
              onChange={handleChange}
              className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
            />
            Count haul cost in totals
          </label>
        </div>

        <FormField label="Notes" htmlFor="ph-mp-notes">
          <textarea
            id="ph-mp-notes" name="notes" rows={2}
            value={formData.notes || ''} onChange={handleChange} className={textareaClasses}
          />
        </FormField>
      </form>
    </Modal>
  );
}
