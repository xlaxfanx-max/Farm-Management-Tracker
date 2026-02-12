import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Plus, Filter, X, Edit2, Trash2, CheckCircle, AlertTriangle,
  Loader2, RefreshCw, ChevronDown, ChevronRight, ShieldCheck, XCircle, Clock } from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];
const PASS_OPTIONS = [
  { value: '', label: 'All Results' }, { value: 'true', label: 'Passed' },
  { value: 'false', label: 'Failed' }, { value: 'null', label: 'Pending' },
];
const statusBadgeStyles = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[status] || statusBadgeStyles.scheduled}`}>
    {(status || '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
  </span>
);
const PassBadge = ({ passed }) => {
  if (passed === true) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">PASSED</span>;
  if (passed === false) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">FAILED</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Pending</span>;
};
const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';
const inputSmCls = 'w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500';
const textareaCls = 'w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500';

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between py-1.5 cursor-pointer">
    <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  </label>
);
const SectionHeader = ({ title, isRed, open, onToggle }) => (
  <button type="button" onClick={onToggle}
    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${isRed ? 'bg-red-500' : 'bg-green-500'}`} />
      <span className="text-sm font-medium text-gray-900 dark:text-white">{title}</span>
    </div>
    {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
  </button>
);

const CreateModal = ({ onClose, onSave }) => {
  const [fd, setFd] = useState({ farm: '', field: '', inspection_date: '', planned_harvest_date: '', crop: '', inspector_name: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const ch = (e) => { const { name, value } = e.target; setFd((p) => ({ ...p, [name]: value })); };
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setErr(null);
    try { await onSave(fd); onClose(); }
    catch (error) { setErr(error.response?.data?.detail || 'Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule Inspection</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{err}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farm ID *</label>
              <input type="number" name="farm" required value={fd.farm} onChange={ch} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field ID *</label>
              <input type="number" name="field" required value={fd.field} onChange={ch} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inspection Date *</label>
              <input type="date" name="inspection_date" required value={fd.inspection_date} onChange={ch} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Planned Harvest Date *</label>
              <input type="date" name="planned_harvest_date" required value={fd.planned_harvest_date} onChange={ch} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Crop *</label>
            <input type="text" name="crop" required value={fd.crop} onChange={ch} placeholder="e.g., Avocado" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inspector Name</label>
            <input type="text" name="inspector_name" value={fd.inspector_name} onChange={ch} placeholder="Inspector name" className={inputCls} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Schedule Inspection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ChecklistView = ({ inspection, onClose, onRefresh }) => {
  const [d, setD] = useState({ ...inspection });
  const [sections, setSections] = useState({ bio: true, chem: true, phys: true, field: true, worker: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const tog = (s) => setSections((p) => ({ ...p, [s]: !p[s] }));
  const upd = (k, v) => setD((p) => ({ ...p, [k]: v }));

  const bioRed = d.animal_intrusion || d.animal_droppings_found || d.adjacent_animal_operations || d.water_source_contamination;
  const chemRed = d.phi_respected === false || d.chemical_spill_evidence;
  const physRed = d.foreign_material_found || d.glass_metal_debris;
  const fieldRed = d.field_condition_acceptable === false;
  const workerRed = d.workers_trained === false;
  const likelyPass = d.phi_respected !== false && !d.chemical_spill_evidence && !d.water_source_contamination && d.field_condition_acceptable !== false;

  const save = async () => {
    setSaving(true); setError(null);
    try { await primusGFSAPI.updatePreHarvestInspection(d.id, d); onRefresh(); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to save changes.'); }
    finally { setSaving(false); }
  };
  const complete = async () => {
    setSaving(true); setError(null);
    try { await primusGFSAPI.updatePreHarvestInspection(d.id, d); await primusGFSAPI.completePreHarvestInspection(d.id, {}); onRefresh(); onClose(); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to complete inspection.'); }
    finally { setSaving(false); }
  };
  const approve = async () => {
    setSaving(true); setError(null);
    try { await primusGFSAPI.approvePreHarvestInspection(d.id, {}); onRefresh(); onClose(); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to approve inspection.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Inspection Checklist</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{error}</div>}
          <div>
            <SectionHeader title="Biological Hazards" isRed={bioRed} open={sections.bio} onToggle={() => tog('bio')} />
            {sections.bio && <div className="mt-2 px-4 space-y-1">
              <Toggle label="Animal intrusion observed" checked={!!d.animal_intrusion} onChange={(v) => upd('animal_intrusion', v)} />
              <Toggle label="Animal droppings found" checked={!!d.animal_droppings_found} onChange={(v) => upd('animal_droppings_found', v)} />
              <Toggle label="Adjacent animal operations" checked={!!d.adjacent_animal_operations} onChange={(v) => upd('adjacent_animal_operations', v)} />
              <Toggle label="Water source contamination" checked={!!d.water_source_contamination} onChange={(v) => upd('water_source_contamination', v)} />
              <textarea value={d.biological_hazard_notes || ''} onChange={(e) => upd('biological_hazard_notes', e.target.value)} rows={2} placeholder="Notes..." className={textareaCls} />
            </div>}
          </div>
          <div>
            <SectionHeader title="Chemical Hazards" isRed={chemRed} open={sections.chem} onToggle={() => tog('chem')} />
            {sections.chem && <div className="mt-2 px-4 space-y-1">
              <Toggle label="PHI respected" checked={d.phi_respected !== false} onChange={(v) => upd('phi_respected', v)} />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Last Pesticide Date</label>
                  <input type="date" value={d.last_pesticide_date || ''} onChange={(e) => upd('last_pesticide_date', e.target.value)} className={inputSmCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Last Pesticide Product</label>
                  <input type="text" value={d.last_pesticide_product || ''} onChange={(e) => upd('last_pesticide_product', e.target.value)} placeholder="Product name" className={inputSmCls} />
                </div>
              </div>
              <Toggle label="Drift risk present" checked={!!d.drift_risk} onChange={(v) => upd('drift_risk', v)} />
              <Toggle label="Chemical spill evidence" checked={!!d.chemical_spill_evidence} onChange={(v) => upd('chemical_spill_evidence', v)} />
              <textarea value={d.chemical_hazard_notes || ''} onChange={(e) => upd('chemical_hazard_notes', e.target.value)} rows={2} placeholder="Notes..." className={textareaCls} />
            </div>}
          </div>
          <div>
            <SectionHeader title="Physical Hazards" isRed={physRed} open={sections.phys} onToggle={() => tog('phys')} />
            {sections.phys && <div className="mt-2 px-4 space-y-1">
              <Toggle label="Foreign material found" checked={!!d.foreign_material_found} onChange={(v) => upd('foreign_material_found', v)} />
              <Toggle label="Glass/metal debris found" checked={!!d.glass_metal_debris} onChange={(v) => upd('glass_metal_debris', v)} />
              <Toggle label="Equipment condition OK" checked={d.equipment_condition_ok !== false} onChange={(v) => upd('equipment_condition_ok', v)} />
              <textarea value={d.physical_hazard_notes || ''} onChange={(e) => upd('physical_hazard_notes', e.target.value)} rows={2} placeholder="Notes..." className={textareaCls} />
            </div>}
          </div>
          <div>
            <SectionHeader title="Field Condition" isRed={fieldRed} open={sections.field} onToggle={() => tog('field')} />
            {sections.field && <div className="mt-2 px-4 space-y-1">
              <Toggle label="Field condition acceptable" checked={d.field_condition_acceptable !== false} onChange={(v) => upd('field_condition_acceptable', v)} />
              <Toggle label="Drainage adequate" checked={d.drainage_adequate !== false} onChange={(v) => upd('drainage_adequate', v)} />
              <Toggle label="Sanitation units in place" checked={d.sanitation_units_in_place !== false} onChange={(v) => upd('sanitation_units_in_place', v)} />
              <Toggle label="Hand wash stations available" checked={d.hand_wash_available !== false} onChange={(v) => upd('hand_wash_available', v)} />
              <textarea value={d.field_condition_notes || ''} onChange={(e) => upd('field_condition_notes', e.target.value)} rows={2} placeholder="Notes..." className={textareaCls} />
            </div>}
          </div>
          <div>
            <SectionHeader title="Worker Readiness" isRed={workerRed} open={sections.worker} onToggle={() => tog('worker')} />
            {sections.worker && <div className="mt-2 px-4 space-y-1">
              <Toggle label="Workers trained" checked={d.workers_trained !== false} onChange={(v) => upd('workers_trained', v)} />
              <Toggle label="Harvest containers clean" checked={d.harvest_containers_clean !== false} onChange={(v) => upd('harvest_containers_clean', v)} />
              <Toggle label="Transport vehicles clean" checked={d.transport_vehicles_clean !== false} onChange={(v) => upd('transport_vehicles_clean', v)} />
              <textarea value={d.worker_readiness_notes || ''} onChange={(e) => upd('worker_readiness_notes', e.target.value)} rows={2} placeholder="Notes..." className={textareaCls} />
            </div>}
          </div>
          {/* Pass/Fail Preview */}
          <div className={`rounded-lg p-4 text-center font-medium ${likelyPass
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            {likelyPass ? <span className="flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Likely Pass</span>
              : <span className="flex items-center justify-center gap-2"><XCircle className="w-5 h-5" /> Likely Fail</span>}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={save} disabled={saving}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Draft'}</button>
            {d.status !== 'completed' && d.status !== 'failed' && (
              <button type="button" onClick={complete} disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">Complete Inspection</button>)}
            {d.status === 'completed' && !d.approved_by && (
              <button type="button" onClick={approve} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Approve</span></button>)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function PreHarvestInspection() {
  const [inspections, setInspections] = useState([]);
  const [upcomingHarvests, setUpcomingHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPassed, setFilterPassed] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPassed === 'true') params.passed = 'true';
      else if (filterPassed === 'false') params.passed = 'false';
      else if (filterPassed === 'null') params.passed = 'none';
      const [inspRes, harvestRes] = await Promise.all([
        primusGFSAPI.getPreHarvestInspections(params),
        primusGFSAPI.upcomingHarvests().catch(() => ({ data: [] })),
      ]);
      setInspections(inspRes.data.results || inspRes.data || []);
      setUpcomingHarvests(harvestRes.data.results || harvestRes.data || []);
    } catch (err) {
      console.error('Failed to fetch inspections:', err);
      setError('Failed to load inspections. Please try again.');
    } finally { setLoading(false); }
  }, [filterStatus, filterPassed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (formData) => { await primusGFSAPI.createPreHarvestInspection(formData); fetchData(); };
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inspection?')) return;
    try { await primusGFSAPI.deletePreHarvestInspection(id); fetchData(); }
    catch (err) { console.error('Failed to delete inspection:', err); }
  };
  const handleRowClick = async (insp) => {
    try { const res = await primusGFSAPI.getPreHarvestInspection(insp.id); setSelectedInspection(res.data); }
    catch (err) { console.error('Failed to load inspection detail:', err); }
  };

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  const thisYear = inspections.filter((i) => i.inspection_date >= yearStart);
  const passedCount = thisYear.filter((i) => i.passed === true).length;
  const failedCount = thisYear.filter((i) => i.passed === false).length;
  const upcomingCount = thisYear.filter((i) => i.status === 'scheduled').length;

  return (
    <div className="space-y-4">
      {upcomingHarvests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Upcoming Harvests Needing Inspection</p>
              <ul className="mt-1 text-sm text-amber-700 dark:text-amber-400 space-y-0.5">
                {upcomingHarvests.slice(0, 5).map((h, i) => (
                  <li key={i}>{h.farm_name || 'Farm'} - {h.field_name || 'Field'}: harvest {formatDate(h.planned_harvest_date)}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6" /> Pre-Harvest Inspections
        </h2>
        <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" /> Schedule Inspection
        </button>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'This Year', value: thisYear.length, icon: ClipboardCheck, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Passed', value: passedCount, icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
          { label: 'Failed', value: failedCount, icon: XCircle, color: 'text-red-600 dark:text-red-400' },
          { label: 'Upcoming', value: upcomingCount, icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <select value={filterPassed} onChange={(e) => setFilterPassed(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
            {PASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      )}
      {loading && !error && (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-green-600 animate-spin" /></div>
      )}
      {!loading && !error && inspections.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No inspections found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Schedule your first pre-harvest inspection to get started.</p>
          <button onClick={() => setShowCreateModal(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4" /> Schedule Inspection</button>
        </div>
      )}
      {!loading && !error && inspections.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {['Date','Farm','Field','Crop','Harvest Date','Status','Result'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{h}</th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {inspections.map((insp) => (
                  <tr key={insp.id} onClick={() => handleRowClick(insp)} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{formatDate(insp.inspection_date)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{insp.farm_name || insp.farm}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{insp.field_name || insp.field}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{insp.crop}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(insp.planned_harvest_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={insp.status} /></td>
                    <td className="px-4 py-3"><PassBadge passed={insp.passed} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleRowClick(insp)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(insp.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showCreateModal && <CreateModal onClose={() => setShowCreateModal(false)} onSave={handleCreate} />}
      {selectedInspection && <ChecklistView inspection={selectedInspection} onClose={() => setSelectedInspection(null)} onRefresh={fetchData} />}
    </div>
  );
}
