import React, { useEffect, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';
import { pickHaulInvoicesAPI, pickHaulReceiptsAPI, PICKHAUL_CONSTANTS } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from '../ui/FormField';
import DerivedFieldsPanel from './DerivedFieldsPanel';
import { rows } from './pickhaulUtils';

const EMPTY_INVOICE = {
  packinghouse: '',
  entity: '',
  kind: 'PICK',
  billing: 'direct',
  contractor: '',
  invoice_no: '',
  amount: '',
  block_raw: '',
  date_from: '',
  date_to: '',
  date_paid: '',
  date_emailed: '',
  date_rec_from_ph: '',
  notes: '',
};

// Fields kept when "Save & add another" resets the form — real entry sessions
// are runs of same-house, same-contractor rows.
const STICKY_FIELDS = ['packinghouse', 'entity', 'kind', 'contractor'];

/**
 * One row per invoice, keyed once — the web replacement for the Excel entry
 * workbook. Column order mirrors the old sheet. The derived columns (charged
 * back / AP ref / match) are display-only via DerivedFieldsPanel.
 */
export default function InvoiceModal({ isOpen, onClose, onSave, invoice = null, season, houses, entities }) {
  const toast = useToast();
  const [formData, setFormData] = useState(EMPTY_INVOICE);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [contractors, setContractors] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const firstFieldRef = useRef(null);
  const invoiceNoRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(invoice ? { ...EMPTY_INVOICE, ...invoice } : { ...EMPTY_INVOICE });
      setErrors({});
      pickHaulInvoicesAPI.getContractors()
        .then((res) => setContractors(res.data || []))
        .catch(() => {});
    }
  }, [isOpen, invoice]);

  // Block autocomplete follows the selected house.
  useEffect(() => {
    if (!isOpen || !formData.packinghouse) {
      setBlocks([]);
      return;
    }
    pickHaulReceiptsAPI.getBlocks({ house: formData.packinghouse, season })
      .then((res) => setBlocks(res.data || []))
      .catch(() => {});
  }, [isOpen, formData.packinghouse, season]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.packinghouse) newErrors.packinghouse = 'Required';
    if (!formData.entity) newErrors.entity = 'Required';
    if (!formData.contractor) newErrors.contractor = 'Required';
    if (!formData.invoice_no) newErrors.invoice_no = 'Required';
    if (!formData.amount) newErrors.amount = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const payload = () => {
    const data = { ...formData, season };
    // Empty strings are not dates/decimals to the API.
    for (const key of ['amount', 'date_from', 'date_to', 'date_paid', 'date_emailed', 'date_rec_from_ph']) {
      if (data[key] === '') data[key] = null;
    }
    // Never send the derived fields — the serializer ignores them anyway.
    for (const key of ['charge_posted', 'ap_reference', 'match_method', 'source',
                       'amount_formula', 'conflict_fields', 'matched_charges',
                       'matched_receipts', 'days_outstanding']) {
      delete data[key];
    }
    return data;
  };

  const save = async () => {
    if (invoice) {
      await pickHaulInvoicesAPI.patch(invoice.id, payload());
    } else {
      await pickHaulInvoicesAPI.create(payload());
    }
  };

  const handleError = (error) => {
    console.error('Error saving invoice:', error);
    const data = error.response?.data;
    if (data) {
      if (Array.isArray(data.non_field_errors)) {
        toast.error(data.non_field_errors.join(' '));
      } else if (typeof data === 'object') {
        setErrors(data);
      }
    } else {
      toast.error('Failed to save invoice');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await save();
      toast.success(`Invoice #${formData.invoice_no} saved`);
      onSave();
      onClose();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndAddAnother = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await save();
      toast.success(`Invoice #${formData.invoice_no} saved`);
      onSave();
      setFormData((prev) => {
        const next = { ...EMPTY_INVOICE };
        STICKY_FIELDS.forEach((f) => { next[f] = prev[f]; });
        return next;
      });
      setErrors({});
      invoiceNoRef.current?.focus();
    } catch (error) {
      handleError(error);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      {!invoice && (
        <button
          type="button"
          onClick={handleSaveAndAddAnother}
          disabled={saving}
          title="Ctrl+Enter"
          className="px-4 py-2 rounded-button border border-primary text-primary hover:bg-primary-light disabled:opacity-50"
        >
          Save &amp; add another
        </button>
      )}
      <button
        type="submit"
        form="pickhaul-invoice-form"
        disabled={saving}
        className="px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : invoice ? 'Update Invoice' : 'Add Invoice'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={invoice ? `Edit Invoice #${invoice.invoice_no || ''}` : 'Add Invoice'}
      subtitle={`Season ${season}`}
      icon={Receipt}
      size="lg"
      footer={footer}
    >
      <form
        id="pickhaul-invoice-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey && !invoice) {
            e.preventDefault();
            handleSaveAndAddAnother();
          }
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-4 gap-4">
          <FormField label="House" htmlFor="ph-inv-house" required error={errors.packinghouse}>
            <select
              id="ph-inv-house" name="packinghouse" value={formData.packinghouse}
              onChange={handleChange} className={selectClasses} ref={firstFieldRef} autoFocus
            >
              <option value="">Select…</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.short_code || h.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Entity" htmlFor="ph-inv-entity" required error={errors.entity}>
            <select
              id="ph-inv-entity" name="entity" value={formData.entity}
              onChange={handleChange} className={selectClasses}
            >
              <option value="">Select…</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.short_code}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Kind" htmlFor="ph-inv-kind">
            <select
              id="ph-inv-kind" name="kind" value={formData.kind}
              onChange={handleChange} className={selectClasses}
            >
              {PICKHAUL_CONSTANTS.KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Billing"
            htmlFor="ph-inv-billing"
            hint={PICKHAUL_CONSTANTS.BILLING.find((b) => b.value === (formData.billing || 'direct'))?.explanation}
          >
            <select
              id="ph-inv-billing" name="billing" value={formData.billing || 'direct'}
              onChange={handleChange} className={selectClasses}
            >
              {PICKHAUL_CONSTANTS.BILLING.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Contractor" htmlFor="ph-inv-contractor" required error={errors.contractor}>
            <input
              id="ph-inv-contractor" name="contractor" value={formData.contractor || ''}
              onChange={handleChange} className={inputClasses} list="ph-contractors"
              placeholder="Magana, MCM, Ortiz…"
            />
            <datalist id="ph-contractors">
              {contractors.map((c) => <option key={c} value={c} />)}
            </datalist>
          </FormField>
          <FormField label="Invoice #" htmlFor="ph-inv-no" required error={errors.invoice_no}>
            <input
              id="ph-inv-no" name="invoice_no" value={formData.invoice_no || ''}
              onChange={handleChange} className={inputClasses} ref={invoiceNoRef}
            />
          </FormField>
          <FormField label="Amount" htmlFor="ph-inv-amount" required error={errors.amount}>
            <input
              id="ph-inv-amount" name="amount" type="number" step="0.01" min="0"
              value={formData.amount || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <FormField
          label="Block"
          htmlFor="ph-inv-block"
          hint="As the house prints it. Narrows which receipts this invoice covers."
        >
          <input
            id="ph-inv-block" name="block_raw" value={formData.block_raw || ''}
            onChange={handleChange} className={inputClasses} list="ph-blocks"
          />
          <datalist id="ph-blocks">
            {blocks.map((b) => <option key={b} value={b} />)}
          </datalist>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Covers picks from" htmlFor="ph-inv-from">
            <input
              id="ph-inv-from" name="date_from" type="date"
              value={formData.date_from || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField label="Through" htmlFor="ph-inv-to">
            <input
              id="ph-inv-to" name="date_to" type="date"
              value={formData.date_to || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Date paid" htmlFor="ph-inv-paid">
            <input
              id="ph-inv-paid" name="date_paid" type="date"
              value={formData.date_paid || ''} onChange={handleChange} className={inputClasses}
            />
          </FormField>
          <FormField
            label="Date emailed to house"
            htmlFor="ph-inv-emailed"
            hint={formData.billing === 'house_billed'
              ? 'Not applicable — the house pays the contractor directly.'
              : undefined}
          >
            <input
              id="ph-inv-emailed" name="date_emailed" type="date"
              value={formData.date_emailed || ''} onChange={handleChange}
              className={inputClasses} disabled={formData.billing === 'house_billed'}
            />
          </FormField>
          <FormField
            label="Date rec'd from PH"
            htmlFor="ph-inv-rec"
            hint={formData.billing === 'house_billed'
              ? 'Not applicable — nothing is reimbursed on a house-billed invoice.'
              : "When the money actually arrived — your record, never derived."}
          >
            <input
              id="ph-inv-rec" name="date_rec_from_ph" type="date"
              value={formData.date_rec_from_ph || ''} onChange={handleChange}
              className={inputClasses} disabled={formData.billing === 'house_billed'}
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="ph-inv-notes">
          <textarea
            id="ph-inv-notes" name="notes" rows={2}
            value={formData.notes || ''} onChange={handleChange} className={textareaClasses}
          />
        </FormField>

        {invoice && <DerivedFieldsPanel invoice={invoice} />}
      </form>
    </Modal>
  );
}
