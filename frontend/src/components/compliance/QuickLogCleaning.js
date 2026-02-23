import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function QuickLogCleaning({ isOpen, onClose, onSuccess }) {
  const toast = useToast();

  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [form, setForm] = useState({
    facility: '',
    cleaned_by: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setFacilitiesLoading(true);
    setForm({ facility: '', cleaned_by: '', notes: '' });
    setErrors({});
    api
      .get('/fsma/facilities/')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data.results || [];
        setFacilities(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, facility: String(list[0].id) }));
        }
      })
      .catch(() => {})
      .finally(() => setFacilitiesLoading(false));
  }, [isOpen]);

  function validate() {
    const errs = {};
    if (!form.facility) errs.facility = 'Please select a facility.';
    if (!form.cleaned_by.trim()) errs.cleaned_by = 'Cleaned by is required.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post('/fsma/cleaning-logs/', {
        facility: Number(form.facility),
        cleaned_by: form.cleaned_by.trim(),
        notes: form.notes.trim() || null,
        cleaning_date: todayISO(),
      });
      toast.success('Cleaning log recorded.');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to save cleaning log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Facility Cleaning">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Facility <span className="text-red-500">*</span>
          </label>
          <select name="facility" value={form.facility} onChange={handleChange}
            disabled={facilitiesLoading} className={`${inputClass} disabled:opacity-60`}>
            <option value="">{facilitiesLoading ? 'Loading facilities...' : 'Select a facility'}</option>
            {facilities.map((f) => (
              <option key={f.id} value={String(f.id)}>{f.name}</option>
            ))}
          </select>
          {errors.facility && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.facility}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Cleaned By <span className="text-red-500">*</span>
          </label>
          <input type="text" name="cleaned_by" value={form.cleaned_by} onChange={handleChange}
            placeholder="Name of person who cleaned" className={inputClass} />
          {errors.cleaned_by && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.cleaned_by}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <textarea name="notes" value={form.notes} onChange={handleChange}
            placeholder="Any notes about the cleaning…" rows={3}
            className={inputClass} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" loading={submitting}>Log Cleaning</Button>
        </div>
      </form>
    </Modal>
  );
}
