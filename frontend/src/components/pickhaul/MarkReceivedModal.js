import React, { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import { pickHaulInvoicesAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import FormField, { inputClasses } from '../ui/FormField';
import { formatCurrency } from './pickhaulUtils';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record when the money actually arrived — the human-keyed 'Date Rec from PH'.
 *
 * Deliberately NOT the same as the charge-back match: the row leaves the chase
 * list only when the matcher finds the house's posted charge. Marking received
 * keeps the row listed, now showing the received date.
 */
export default function MarkReceivedModal({ isOpen, onClose, onSave, invoice }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setDate(invoice?.date_rec_from_ph || today());
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await pickHaulInvoicesAPI.patch(invoice.id, { date_rec_from_ph: date || null });
      toast.success(`Invoice #${invoice.invoice_no} marked received`);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error marking received:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark received"
      subtitle={`${invoice.kind} ${invoice.contractor || ''} #${invoice.invoice_no} · ${formatCurrency(invoice.amount)}`}
      icon={Banknote}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-button border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pickhaul-mark-received-form"
            disabled={saving}
            className="px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="pickhaul-mark-received-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Date the money arrived" htmlFor="ph-mark-received-date">
          <input
            id="ph-mark-received-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClasses}
            autoFocus
          />
        </FormField>
        <p className="text-xs text-gray-500">
          This is your record only. The row stays on the chase list until the
          house's posted charge is matched — those are different events.
        </p>
      </form>
    </Modal>
  );
}
