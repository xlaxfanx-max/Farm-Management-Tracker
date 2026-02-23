import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const PURPOSE_OPTIONS = [
  { value: 'Inspector', label: 'Inspector' },
  { value: 'Vendor/Supplier', label: 'Vendor / Supplier' },
  { value: 'Worker', label: 'Worker' },
  { value: 'Consultant', label: 'Consultant' },
  { value: 'Other', label: 'Other' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function QuickLogVisitor({ isOpen, onClose, onSuccess }) {
  const toast = useToast();

  const [farms, setFarms] = useState([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [form, setForm] = useState({
    visitor_name: '',
    company: '',
    purpose: 'Inspector',
    farm_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setFarmsLoading(true);
    setForm({ visitor_name: '', company: '', purpose: 'Inspector', farm_id: '' });
    setErrors({});
    api
      .get('/farms/')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data.results || [];
        setFarms(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, farm_id: String(list[0].id) }));
        }
      })
      .catch(() => {})
      .finally(() => setFarmsLoading(false));
  }, [isOpen]);

  function validate() {
    const errs = {};
    if (!form.visitor_name.trim()) errs.visitor_name = 'Visitor name is required.';
    if (!form.farm_id) errs.farm_id = 'Please select a farm.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await api.post('/fsma/visitor-logs/', {
        visitor_name: form.visitor_name.trim(),
        company: form.company.trim() || null,
        purpose: form.purpose,
        farm_id: Number(form.farm_id),
        visit_date: todayISO(),
      });
      toast.success('Visitor logged successfully.');
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to log visitor. Please try again.');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Log Visitor">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Visitor Name <span className="text-red-500">*</span>
          </label>
          <input type="text" name="visitor_name" value={form.visitor_name} onChange={handleChange}
            placeholder="Full name" className={inputClass} />
          {errors.visitor_name && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.visitor_name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Company / Organization <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input type="text" name="company" value={form.company} onChange={handleChange}
            placeholder="Organization name" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose</label>
          <select name="purpose" value={form.purpose} onChange={handleChange} className={inputClass}>
            {PURPOSE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Farm <span className="text-red-500">*</span>
          </label>
          <select name="farm_id" value={form.farm_id} onChange={handleChange}
            disabled={farmsLoading} className={`${inputClass} disabled:opacity-60`}>
            <option value="">{farmsLoading ? 'Loading farms...' : 'Select a farm'}</option>
            {farms.map((farm) => (
              <option key={farm.id} value={String(farm.id)}>{farm.name}</option>
            ))}
          </select>
          {errors.farm_id && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.farm_id}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" loading={submitting}>Log Visitor</Button>
        </div>
      </form>
    </Modal>
  );
}
