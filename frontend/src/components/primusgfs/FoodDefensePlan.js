import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const THREAT_COLORS = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const riskColor = (score) => {
  if (score <= 5) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (score <= 15) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
};

const EMPTY_VULN = { area: '', threat_type: '', likelihood: 1, severity: 1, mitigation: '' };
const EMPTY_MEASURE = { measure: '', responsible_person: '', frequency: '', location: '' };
const EMPTY_CONTACT = { name: '', phone: '', role: '' };

const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left font-medium text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg">
        {title}
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">{children}</div>}
    </div>
  );
};

const PlanModal = ({ plan, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    plan_year: plan?.plan_year || new Date().getFullYear(),
    effective_date: plan?.effective_date || '',
    review_date: plan?.review_date || '',
    overall_threat_level: plan?.overall_threat_level || 'low',
    vulnerability_assessment: plan?.vulnerability_assessment || [{ ...EMPTY_VULN }],
    security_measures: plan?.security_measures || [{ ...EMPTY_MEASURE }],
    perimeter_security: plan?.perimeter_security || '',
    access_points: plan?.access_points || [],
    key_control_procedure: plan?.key_control_procedure || '',
    food_defense_coordinator: plan?.food_defense_coordinator || '',
    emergency_contacts: plan?.emergency_contacts || [{ ...EMPTY_CONTACT }],
    tampering_response_procedure: plan?.tampering_response_procedure || '',
    reporting_procedure: plan?.reporting_procedure || '',
    notes: plan?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newAccessPoint, setNewAccessPoint] = useState('');

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const updateRow = (field, idx, key, value) => {
    const arr = [...form[field]];
    arr[idx] = { ...arr[idx], [key]: value };
    if (field === 'vulnerability_assessment') {
      arr[idx].risk_score = (arr[idx].likelihood || 1) * (arr[idx].severity || 1);
    }
    set(field, arr);
  };
  const addRow = (field, template) => set(field, [...form[field], { ...template }]);
  const removeRow = (field, idx) => set(field, form[field].filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form, plan?.id);
      onClose();
    } catch (error) {
      setSaveError(error.response?.data?.detail || 'Failed to save plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{plan ? 'Edit Plan' : 'Create Food Defense Plan'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}

          {/* Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={labelCls}>Plan Year *</label><input type="number" required value={form.plan_year} onChange={(e) => set('plan_year', parseInt(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Effective Date</label><input type="date" value={form.effective_date} onChange={(e) => set('effective_date', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Review Date</label><input type="date" value={form.review_date} onChange={(e) => set('review_date', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Threat Level</label>
              <select value={form.overall_threat_level} onChange={(e) => set('overall_threat_level', e.target.value)} className={inputCls}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Vulnerability Assessment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Vulnerability Assessment</label>
              <button type="button" onClick={() => addRow('vulnerability_assessment', EMPTY_VULN)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-2 py-1 text-left">Area</th><th className="px-2 py-1 text-left">Threat Type</th><th className="px-2 py-1 w-20">Likelihood</th><th className="px-2 py-1 w-20">Severity</th><th className="px-2 py-1 w-16">Risk</th><th className="px-2 py-1 text-left">Mitigation</th><th className="w-8"></th>
                </tr></thead>
                <tbody>{form.vulnerability_assessment.map((v, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-1 py-1"><input value={v.area} onChange={(e) => updateRow('vulnerability_assessment', i, 'area', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input value={v.threat_type} onChange={(e) => updateRow('vulnerability_assessment', i, 'threat_type', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input type="number" min={1} max={5} value={v.likelihood} onChange={(e) => updateRow('vulnerability_assessment', i, 'likelihood', parseInt(e.target.value) || 1)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input type="number" min={1} max={5} value={v.severity} onChange={(e) => updateRow('vulnerability_assessment', i, 'severity', parseInt(e.target.value) || 1)} className={inputCls} /></td>
                    <td className="px-1 py-1 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColor((v.likelihood || 1) * (v.severity || 1))}`}>{(v.likelihood || 1) * (v.severity || 1)}</span></td>
                    <td className="px-1 py-1"><input value={v.mitigation} onChange={(e) => updateRow('vulnerability_assessment', i, 'mitigation', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><button type="button" onClick={() => removeRow('vulnerability_assessment', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Security Measures */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Security Measures</label>
              <button type="button" onClick={() => addRow('security_measures', EMPTY_MEASURE)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add Row</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-2 py-1 text-left">Measure</th><th className="px-2 py-1 text-left">Responsible Person</th><th className="px-2 py-1 text-left">Frequency</th><th className="px-2 py-1 text-left">Location</th><th className="w-8"></th>
                </tr></thead>
                <tbody>{form.security_measures.map((m, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-1 py-1"><input value={m.measure} onChange={(e) => updateRow('security_measures', i, 'measure', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input value={m.responsible_person} onChange={(e) => updateRow('security_measures', i, 'responsible_person', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input value={m.frequency} onChange={(e) => updateRow('security_measures', i, 'frequency', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><input value={m.location} onChange={(e) => updateRow('security_measures', i, 'location', e.target.value)} className={inputCls} /></td>
                    <td className="px-1 py-1"><button type="button" onClick={() => removeRow('security_measures', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Access Control */}
          <div className="space-y-3">
            <label className={labelCls}>Access Control</label>
            <div><label className="text-xs text-gray-500 dark:text-gray-400">Perimeter Security</label><textarea value={form.perimeter_security} onChange={(e) => set('perimeter_security', e.target.value)} rows={2} className={inputCls} /></div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Access Points</label>
              <div className="flex gap-2 mt-1">
                <input value={newAccessPoint} onChange={(e) => setNewAccessPoint(e.target.value)} placeholder="Add access point..." className={inputCls} />
                <button type="button" onClick={() => { if (newAccessPoint.trim()) { set('access_points', [...form.access_points, newAccessPoint.trim()]); setNewAccessPoint(''); }}} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">{form.access_points.map((ap, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">
                  {ap}<button type="button" onClick={() => set('access_points', form.access_points.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700"><X className="w-3 h-3" /></button>
                </span>
              ))}</div>
            </div>
            <div><label className="text-xs text-gray-500 dark:text-gray-400">Key Control Procedure</label><textarea value={form.key_control_procedure} onChange={(e) => set('key_control_procedure', e.target.value)} rows={2} className={inputCls} /></div>
          </div>

          {/* Personnel */}
          <div className="space-y-3">
            <label className={labelCls}>Personnel</label>
            <div><label className="text-xs text-gray-500 dark:text-gray-400">Food Defense Coordinator</label><input value={form.food_defense_coordinator} onChange={(e) => set('food_defense_coordinator', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center justify-between"><label className="text-xs text-gray-500 dark:text-gray-400">Emergency Contacts</label>
              <button type="button" onClick={() => addRow('emergency_contacts', EMPTY_CONTACT)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            {form.emergency_contacts.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input placeholder="Name" value={c.name} onChange={(e) => updateRow('emergency_contacts', i, 'name', e.target.value)} className={inputCls} />
                <input placeholder="Phone" value={c.phone} onChange={(e) => updateRow('emergency_contacts', i, 'phone', e.target.value)} className={inputCls} />
                <input placeholder="Role" value={c.role} onChange={(e) => updateRow('emergency_contacts', i, 'role', e.target.value)} className={inputCls} />
                <button type="button" onClick={() => removeRow('emergency_contacts', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
          </div>

          {/* Incident Response */}
          <div className="space-y-3">
            <label className={labelCls}>Incident Response</label>
            <div><label className="text-xs text-gray-500 dark:text-gray-400">Tampering Response Procedure</label><textarea value={form.tampering_response_procedure} onChange={(e) => set('tampering_response_procedure', e.target.value)} rows={2} className={inputCls} /></div>
            <div><label className="text-xs text-gray-500 dark:text-gray-400">Reporting Procedure</label><textarea value={form.reporting_procedure} onChange={(e) => set('reporting_procedure', e.target.value)} rows={2} className={inputCls} /></div>
          </div>

          <div><label className={labelCls}>Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} /></div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function FoodDefensePlan() {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const currentYear = new Date().getFullYear();

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getFoodDefensePlans();
      const data = response.data.results || response.data || [];
      const sorted = [...data].sort((a, b) => b.plan_year - a.plan_year);
      setPlans(sorted);
      if (!selectedPlan && sorted.length > 0) setSelectedPlan(sorted[0]);
    } catch (err) {
      console.error('Failed to fetch food defense plans:', err);
      setError('Failed to load plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleSave = async (formData, id) => {
    if (id) { await primusGFSAPI.updateFoodDefensePlan(id, formData); }
    else { await primusGFSAPI.createFoodDefensePlan(formData); }
    fetchPlans();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this food defense plan?')) return;
    try {
      await primusGFSAPI.deleteFoodDefensePlan(id);
      if (selectedPlan?.id === id) setSelectedPlan(null);
      fetchPlans();
    } catch (err) { console.error('Failed to delete plan:', err); }
  };

  const handleApprove = async (id) => {
    try {
      await primusGFSAPI.approveFoodDefensePlan(id);
      fetchPlans();
    } catch (err) { console.error('Failed to approve plan:', err); }
  };

  const handleEdit = (plan) => { setEditingPlan(plan); setShowModal(true); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-6 h-6" />Food Defense Plans
        </h2>
        <button onClick={() => { setEditingPlan(null); setShowModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" />New Plan
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={fetchPlans} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><RefreshCw className="w-4 h-4" />Retry</button>
        </div>
      )}

      {loading && !error && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-green-600 animate-spin" /></div>}

      {!loading && !error && plans.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No food defense plans found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first plan to start managing food defense compliance.</p>
          <button onClick={() => { setEditingPlan(null); setShowModal(true); }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus className="w-4 h-4" />New Plan</button>
        </div>
      )}

      {!loading && !error && plans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Plan Selector */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">Plans by Year</p>
            {plans.map((p) => (
              <button key={p.id} onClick={() => setSelectedPlan(p)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedPlan?.id === p.id ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30'} ${p.plan_year === currentYear ? 'ring-1 ring-green-300 dark:ring-green-700' : ''}`}>
                <span>{p.plan_year}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.approved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {p.approved ? 'Approved' : 'Draft'}
                </span>
              </button>
            ))}
          </div>

          {/* Plan Detail */}
          {selectedPlan && (
            <div className="lg:col-span-3 space-y-4">
              {/* Detail Header */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedPlan.plan_year} Food Defense Plan</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${THREAT_COLORS[selectedPlan.overall_threat_level] || THREAT_COLORS.low}`}>{(selectedPlan.overall_threat_level || 'low').charAt(0).toUpperCase() + (selectedPlan.overall_threat_level || 'low').slice(1)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${selectedPlan.approved ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{selectedPlan.approved ? 'Approved' : 'Draft'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Review: {formatDate(selectedPlan.review_date)}</span>
                  {!selectedPlan.approved && <button onClick={() => handleApprove(selectedPlan.id)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="Approve"><CheckCircle className="w-4 h-4" /></button>}
                  <button onClick={() => handleEdit(selectedPlan)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(selectedPlan.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Vulnerability Assessment */}
              <CollapsibleSection title="Vulnerability Assessment" defaultOpen>
                {(selectedPlan.vulnerability_assessment || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-2">
                      <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                        <th className="px-3 py-2 text-left">Area</th><th className="px-3 py-2 text-left">Threat Type</th><th className="px-3 py-2">Likelihood</th><th className="px-3 py-2">Severity</th><th className="px-3 py-2">Risk</th><th className="px-3 py-2 text-left">Mitigation</th>
                      </tr></thead>
                      <tbody>{(selectedPlan.vulnerability_assessment).map((v, i) => {
                        const score = (v.likelihood || 1) * (v.severity || 1);
                        return (<tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{v.area}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{v.threat_type}</td>
                          <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{v.likelihood}</td>
                          <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400">{v.severity}</td>
                          <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded text-xs font-medium ${riskColor(score)}`}>{score}</span></td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{v.mitigation}</td>
                        </tr>);
                      })}</tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No vulnerability assessments recorded.</p>}
              </CollapsibleSection>

              {/* Security Measures */}
              <CollapsibleSection title="Security Measures">
                {(selectedPlan.security_measures || []).length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm mt-2">
                      <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                        <th className="px-3 py-2 text-left">Measure</th><th className="px-3 py-2 text-left">Responsible</th><th className="px-3 py-2 text-left">Frequency</th><th className="px-3 py-2 text-left">Location</th>
                      </tr></thead>
                      <tbody>{(selectedPlan.security_measures).map((m, i) => (
                        <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{m.measure}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.responsible_person}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.frequency}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.location}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No security measures recorded.</p>}
              </CollapsibleSection>

              {/* Access Control */}
              <CollapsibleSection title="Access Control">
                <div className="space-y-3 mt-2">
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Perimeter Security</p><p className="text-sm text-gray-900 dark:text-white mt-1">{selectedPlan.perimeter_security || 'Not specified'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Access Points</p>
                    <div className="flex flex-wrap gap-2 mt-1">{(selectedPlan.access_points || []).length > 0 ? selectedPlan.access_points.map((ap, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">{ap}</span>
                    )) : <span className="text-sm text-gray-500 dark:text-gray-400">None listed</span>}</div>
                  </div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key Control Procedure</p><p className="text-sm text-gray-900 dark:text-white mt-1">{selectedPlan.key_control_procedure || 'Not specified'}</p></div>
                </div>
              </CollapsibleSection>

              {/* Personnel */}
              <CollapsibleSection title="Personnel">
                <div className="space-y-3 mt-2">
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Food Defense Coordinator</p><p className="text-sm text-gray-900 dark:text-white mt-1">{selectedPlan.food_defense_coordinator || 'Not assigned'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Emergency Contacts</p>
                    {(selectedPlan.emergency_contacts || []).length > 0 ? (
                      <div className="mt-1 space-y-1">{selectedPlan.emergency_contacts.map((c, i) => (
                        <div key={i} className="flex gap-4 text-sm"><span className="font-medium text-gray-900 dark:text-white">{c.name}</span><span className="text-gray-600 dark:text-gray-400">{c.phone}</span><span className="text-gray-500 dark:text-gray-400">{c.role}</span></div>
                      ))}</div>
                    ) : <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No contacts listed</p>}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Incident Response */}
              <CollapsibleSection title="Incident Response">
                <div className="space-y-3 mt-2">
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tampering Response Procedure</p><p className="text-sm text-gray-900 dark:text-white mt-1">{selectedPlan.tampering_response_procedure || 'Not specified'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reporting Procedure</p><p className="text-sm text-gray-900 dark:text-white mt-1">{selectedPlan.reporting_procedure || 'Not specified'}</p></div>
                </div>
              </CollapsibleSection>

              {selectedPlan.notes && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedPlan.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showModal && <PlanModal plan={editingPlan} onClose={() => { setShowModal(false); setEditingPlan(null); }} onSave={handleSave} />}
    </div>
  );
}
