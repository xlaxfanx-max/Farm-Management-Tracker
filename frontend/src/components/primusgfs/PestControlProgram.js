import React, { useState, useEffect, useCallback } from 'react';
import {
  Bug, Plus, X, Edit2, Trash2, AlertTriangle,
  Loader2, RefreshCw, ClipboardList, TrendingUp, Eye, ShieldCheck,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const ACTIVITY_COLORS = {
  none: 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const STATION_TYPES = [
  { value: 'rodent_bait', label: 'Rodent Bait' }, { value: 'snap_trap', label: 'Snap Trap' },
  { value: 'glue_board', label: 'Glue Board' }, { value: 'insect_trap', label: 'Insect Trap' },
  { value: 'fly_light', label: 'Fly Light' },
];
const PEST_TYPES = ['rodent', 'insect', 'bird', 'wildlife', 'other'];
const EMPTY_STATION = { station_id: '', type: 'rodent_bait', location: '', farm: '' };
const EMPTY_PRODUCT = { product_name: '', active_ingredient: '', epa_reg: '', usage_area: '' };
const EMPTY_RESULT = { station_id: '', pest_type: 'rodent', activity: 'none', bait_consumed: false, action_taken: '' };
const EMPTY_TREATMENT = { product: '', amount: '', area: '', epa_reg: '' };

const iCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm';
const lCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ─── Program Modal ─── */
const ProgramModal = ({ program, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    program_year: program?.program_year || new Date().getFullYear(),
    effective_date: program?.effective_date || '', review_date: program?.review_date || '',
    pco_company: program?.pco_company || '', pco_license_number: program?.pco_license_number || '',
    pco_contact_name: program?.pco_contact_name || '', pco_contact_phone: program?.pco_contact_phone || '',
    service_frequency: program?.service_frequency || '',
    monitoring_stations: program?.monitoring_stations || [{ ...EMPTY_STATION }],
    target_pests: program?.target_pests || [],
    products_used: program?.products_used || [{ ...EMPTY_PRODUCT }],
    notes: program?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const updateRow = (f, i, k, v) => { const a = [...form[f]]; a[i] = { ...a[i], [k]: v }; set(f, a); };
  const addRow = (f, t) => set(f, [...form[f], { ...t }]);
  const removeRow = (f, i) => set(f, form[f].filter((_, j) => j !== i));
  const togglePest = (pest) => {
    const c = form.target_pests || [];
    set('target_pests', c.includes(pest) ? c.filter((p) => p !== pest) : [...c, pest]);
  };
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(null);
    try { await onSave({ ...form, total_stations: form.monitoring_stations.length }, program?.id); onClose(); }
    catch (err) { setSaveError(err.response?.data?.detail || 'Failed to save program.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{program ? 'Edit Program' : 'Create Pest Control Program'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={lCls}>Program Year *</label><input type="number" required value={form.program_year} onChange={(e) => set('program_year', parseInt(e.target.value))} className={iCls} /></div>
            <div><label className={lCls}>Effective Date</label><input type="date" value={form.effective_date} onChange={(e) => set('effective_date', e.target.value)} className={iCls} /></div>
            <div><label className={lCls}>Review Date</label><input type="date" value={form.review_date} onChange={(e) => set('review_date', e.target.value)} className={iCls} /></div>
            <div><label className={lCls}>Service Frequency</label><input value={form.service_frequency} onChange={(e) => set('service_frequency', e.target.value)} placeholder="e.g., Monthly" className={iCls} /></div>
          </div>

          <div>
            <label className={lCls}>PCO Information</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-1">
              <input value={form.pco_company} onChange={(e) => set('pco_company', e.target.value)} placeholder="Company" className={iCls} />
              <input value={form.pco_license_number} onChange={(e) => set('pco_license_number', e.target.value)} placeholder="License #" className={iCls} />
              <input value={form.pco_contact_name} onChange={(e) => set('pco_contact_name', e.target.value)} placeholder="Contact Name" className={iCls} />
              <input value={form.pco_contact_phone} onChange={(e) => set('pco_contact_phone', e.target.value)} placeholder="Phone" className={iCls} />
            </div>
          </div>

          {/* Monitoring Stations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lCls}>Monitoring Stations</label>
              <button type="button" onClick={() => addRow('monitoring_stations', EMPTY_STATION)} className="text-xs text-primary hover:text-primary-hover dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                <th className="px-2 py-1 text-left">Station ID</th><th className="px-2 py-1 text-left">Type</th>
                <th className="px-2 py-1 text-left">Location</th><th className="px-2 py-1 text-left">Farm</th><th className="w-8"></th>
              </tr></thead>
              <tbody>{form.monitoring_stations.map((s, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-1 py-1"><input value={s.station_id} onChange={(e) => updateRow('monitoring_stations', i, 'station_id', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><select value={s.type} onChange={(e) => updateRow('monitoring_stations', i, 'type', e.target.value)} className={iCls}>{STATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></td>
                  <td className="px-1 py-1"><input value={s.location} onChange={(e) => updateRow('monitoring_stations', i, 'location', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><input value={s.farm} onChange={(e) => updateRow('monitoring_stations', i, 'farm', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><button type="button" onClick={() => removeRow('monitoring_stations', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          {/* Target Pests */}
          <div>
            <label className={lCls}>Target Pests</label>
            <div className="flex flex-wrap gap-3 mt-1">{PEST_TYPES.map((p) => (
              <label key={p} className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={(form.target_pests || []).includes(p)} onChange={() => togglePest(p)} className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary" />{cap(p)}
              </label>
            ))}</div>
          </div>

          {/* Products Used */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lCls}>Products Used</label>
              <button type="button" onClick={() => addRow('products_used', EMPTY_PRODUCT)} className="text-xs text-primary hover:text-primary-hover dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                <th className="px-2 py-1 text-left">Product Name</th><th className="px-2 py-1 text-left">Active Ingredient</th>
                <th className="px-2 py-1 text-left">EPA Reg #</th><th className="px-2 py-1 text-left">Usage Area</th><th className="w-8"></th>
              </tr></thead>
              <tbody>{form.products_used.map((p, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-1 py-1"><input value={p.product_name} onChange={(e) => updateRow('products_used', i, 'product_name', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><input value={p.active_ingredient} onChange={(e) => updateRow('products_used', i, 'active_ingredient', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><input value={p.epa_reg} onChange={(e) => updateRow('products_used', i, 'epa_reg', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><input value={p.usage_area} onChange={(e) => updateRow('products_used', i, 'usage_area', e.target.value)} className={iCls} /></td>
                  <td className="px-1 py-1"><button type="button" onClick={() => removeRow('products_used', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div><label className={lCls}>Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={iCls} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50">{saving ? 'Saving...' : program ? 'Update' : 'Create Program'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Log Modal ─── */
const LogModal = ({ log, onClose, onSave }) => {
  const [form, setForm] = useState(() => ({
    inspection_date: log?.inspection_date || new Date().toISOString().split('T')[0],
    inspector_name: log?.inspector_name || '', is_pco_visit: log?.is_pco_visit || false,
    farm: log?.farm || '', station_results: log?.station_results || [{ ...EMPTY_RESULT }],
    overall_activity_level: log?.overall_activity_level || 'none',
    pest_types_found: log?.pest_types_found || [], treatments_applied: log?.treatments_applied || [],
    corrective_actions_needed: log?.corrective_actions_needed || false,
    corrective_action_description: log?.corrective_action_description || '', notes: log?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const updateRow = (f, i, k, v) => { const a = [...form[f]]; a[i] = { ...a[i], [k]: v }; set(f, a); };
  const addRow = (f, t) => set(f, [...form[f], { ...t }]);
  const removeRow = (f, i) => set(f, form[f].filter((_, j) => j !== i));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(null);
    try {
      const active = form.station_results.filter((r) => r.activity !== 'none').length;
      await onSave({ ...form, total_stations_checked: form.station_results.length, stations_with_activity: active }, log?.id);
      onClose();
    } catch (err) { setSaveError(err.response?.data?.detail || 'Failed to save log.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{log ? 'Edit Monitoring Log' : 'New Monitoring Log'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={lCls}>Date *</label><input type="date" required value={form.inspection_date} onChange={(e) => set('inspection_date', e.target.value)} className={iCls} /></div>
            <div><label className={lCls}>Inspector *</label><input required value={form.inspector_name} onChange={(e) => set('inspector_name', e.target.value)} className={iCls} /></div>
            <div><label className={lCls}>Farm ID</label><input value={form.farm} onChange={(e) => set('farm', e.target.value)} className={iCls} /></div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={form.is_pco_visit} onChange={(e) => set('is_pco_visit', e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary" />PCO Visit
              </label>
            </div>
          </div>

          {/* Station Results */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lCls}>Station Results</label>
              <button type="button" onClick={() => addRow('station_results', EMPTY_RESULT)} className="text-xs text-primary hover:text-primary-hover dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-2 py-1 text-left">Station</th><th className="px-2 py-1 text-left">Pest Type</th>
                  <th className="px-2 py-1 text-left">Activity</th><th className="px-2 py-1">Bait</th>
                  <th className="px-2 py-1 text-left">Action Taken</th><th className="w-8"></th>
                </tr></thead>
                <tbody>{form.station_results.map((r, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-1 py-1"><input value={r.station_id} onChange={(e) => updateRow('station_results', i, 'station_id', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><select value={r.pest_type} onChange={(e) => updateRow('station_results', i, 'pest_type', e.target.value)} className={iCls}>{PEST_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}</select></td>
                    <td className="px-1 py-1"><select value={r.activity} onChange={(e) => updateRow('station_results', i, 'activity', e.target.value)} className={iCls}><option value="none">None</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></td>
                    <td className="px-1 py-1 text-center"><input type="checkbox" checked={r.bait_consumed} onChange={(e) => updateRow('station_results', i, 'bait_consumed', e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary" /></td>
                    <td className="px-1 py-1"><input value={r.action_taken} onChange={(e) => updateRow('station_results', i, 'action_taken', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><button type="button" onClick={() => removeRow('station_results', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          <div><label className={lCls}>Overall Activity Level</label>
            <select value={form.overall_activity_level} onChange={(e) => set('overall_activity_level', e.target.value)} className={iCls}><option value="none">None</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select>
          </div>

          {/* Treatments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={lCls}>Treatments Applied</label>
              <button type="button" onClick={() => addRow('treatments_applied', EMPTY_TREATMENT)} className="text-xs text-primary hover:text-primary-hover dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            {form.treatments_applied.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                  <th className="px-2 py-1 text-left">Product</th><th className="px-2 py-1 text-left">Amount</th>
                  <th className="px-2 py-1 text-left">Area</th><th className="px-2 py-1 text-left">EPA Reg #</th><th className="w-8"></th>
                </tr></thead>
                <tbody>{form.treatments_applied.map((t, i) => (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-1 py-1"><input value={t.product} onChange={(e) => updateRow('treatments_applied', i, 'product', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><input value={t.amount} onChange={(e) => updateRow('treatments_applied', i, 'amount', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><input value={t.area} onChange={(e) => updateRow('treatments_applied', i, 'area', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><input value={t.epa_reg} onChange={(e) => updateRow('treatments_applied', i, 'epa_reg', e.target.value)} className={iCls} /></td>
                    <td className="px-1 py-1"><button type="button" onClick={() => removeRow('treatments_applied', i)} className="p-1 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>

          {/* Corrective Actions */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.corrective_actions_needed} onChange={(e) => set('corrective_actions_needed', e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary" />Corrective Actions Needed
            </label>
            {form.corrective_actions_needed && <textarea value={form.corrective_action_description} onChange={(e) => set('corrective_action_description', e.target.value)} rows={2} placeholder="Describe corrective actions..." className={iCls} />}
          </div>

          <div><label className={lCls}>Notes</label><textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={iCls} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50">{saving ? 'Saving...' : log ? 'Update Log' : 'Create Log'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
export default function PestControlProgram() {
  const confirm = useConfirm();
  const [tab, setTab] = useState('program');
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [logs, setLogs] = useState([]);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const currentYear = new Date().getFullYear();

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await primusGFSAPI.getPestPrograms();
      const data = res.data.results || res.data || [];
      const sorted = [...data].sort((a, b) => b.program_year - a.program_year);
      setPrograms(sorted);
      if (!selectedProgram && sorted.length > 0) setSelectedProgram(sorted[0]);
    } catch (err) {
      console.error('Failed to fetch pest programs:', err);
      setError('Failed to load programs. Please try again.');
    } finally { setLoading(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const [lr, tr] = await Promise.all([
        primusGFSAPI.getPestLogs(),
        primusGFSAPI.pestTrend().catch(() => ({ data: null })),
      ]);
      setLogs(lr.data.results || lr.data || []);
      setTrend(tr.data);
    } catch (err) {
      console.error('Failed to fetch pest logs:', err);
      setError('Failed to load monitoring logs.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'program') fetchPrograms(); else fetchLogs(); }, [tab, fetchPrograms, fetchLogs]);

  const handleSaveProgram = async (d, id) => {
    if (id) await primusGFSAPI.updatePestProgram(id, d);
    else await primusGFSAPI.createPestProgram(d);
    fetchPrograms();
  };
  const handleDeleteProgram = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Delete this pest control program?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try { await primusGFSAPI.deletePestProgram(id); if (selectedProgram?.id === id) setSelectedProgram(null); fetchPrograms(); }
    catch (e) { console.error('Failed to delete program:', e); }
  };
  const handleApproveProgram = async (id) => {
    try { await primusGFSAPI.approvePestProgram(id); fetchPrograms(); }
    catch (e) { console.error('Failed to approve:', e); }
  };
  const handleSaveLog = async (d, id) => {
    if (id) await primusGFSAPI.updatePestLog(id, d);
    else await primusGFSAPI.createPestLog(d);
    fetchLogs();
  };
  const handleDeleteLog = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Delete this monitoring log?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try { await primusGFSAPI.deletePestLog(id); fetchLogs(); }
    catch (e) { console.error('Failed to delete log:', e); }
  };

  const pcoVisits = logs.filter((l) => l.is_pco_visit).length;
  const withActivity = logs.filter((l) => (l.stations_with_activity || 0) > 0).length;
  const tabCls = (t) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-primary text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`;
  const sp = selectedProgram;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Bug className="w-6 h-6" />Pest Control Program</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button onClick={() => setTab('program')} className={tabCls('program')}>Program</button>
            <button onClick={() => setTab('logs')} className={tabCls('logs')}>Monitoring Logs</button>
          </div>
          {tab === 'program'
            ? <button onClick={() => { setEditingProgram(null); setShowProgramModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"><Plus className="w-4 h-4" />New Program</button>
            : <button onClick={() => { setEditingLog(null); setShowLogModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"><Plus className="w-4 h-4" />New Log</button>}
        </div>
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={tab === 'program' ? fetchPrograms : fetchLogs} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><RefreshCw className="w-4 h-4" />Retry</button>
        </div>
      )}
      {loading && !error && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>}

      {/* ─── Program Tab ─── */}
      {!loading && !error && tab === 'program' && (<>
        {programs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <Bug className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">No pest control programs found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first program to start managing pest control compliance.</p>
            <button onClick={() => { setEditingProgram(null); setShowProgramModal(true); }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"><Plus className="w-4 h-4" />New Program</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Year Selector */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-2">Programs by Year</p>
              {programs.map((p) => (
                <button key={p.id} onClick={() => setSelectedProgram(p)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${sp?.id === p.id ? 'bg-primary-light dark:bg-green-900/20 text-primary dark:text-green-400 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/30'} ${p.program_year === currentYear ? 'ring-1 ring-green-300 dark:ring-green-700' : ''}`}>
                  <span>{p.program_year}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.approved ? 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{p.approved ? 'Approved' : 'Draft'}</span>
                </button>
              ))}
            </div>

            {/* Program Detail */}
            {sp && (<div className="lg:col-span-3 space-y-4">
              {/* Header bar */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{sp.program_year} Pest Control Program</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sp.approved ? 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{sp.approved ? 'Approved' : 'Draft'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Review: {formatDate(sp.review_date)}</span>
                  {!sp.approved && <button onClick={() => handleApproveProgram(sp.id)} className="p-1.5 text-primary hover:bg-primary-light dark:hover:bg-green-900/20 rounded transition-colors" title="Approve"><ShieldCheck className="w-4 h-4" /></button>}
                  <button onClick={() => { setEditingProgram(sp); setShowProgramModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteProgram(sp.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* PCO Info */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">PCO Information</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  {[['Company', sp.pco_company], ['License #', sp.pco_license_number], ['Contact', sp.pco_contact_name], ['Phone', sp.pco_contact_phone], ['Frequency', sp.service_frequency]].map(([l, v]) => (
                    <div key={l}><p className="text-gray-500 dark:text-gray-400">{l}</p><p className="font-medium text-gray-900 dark:text-white">{v || '-'}</p></div>
                  ))}
                </div>
              </div>

              {/* Monitoring Stations */}
              {(sp.monitoring_stations || []).length > 0 && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">Monitoring Stations ({sp.total_stations || sp.monitoring_stations.length})</p>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                      <th className="px-3 py-2 text-left">Station ID</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Location</th><th className="px-3 py-2 text-left">Farm</th>
                    </tr></thead>
                    <tbody>{sp.monitoring_stations.map((s, i) => (
                      <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{s.station_id}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{STATION_TYPES.find((t) => t.value === s.type)?.label || s.type}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{s.location}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{s.farm || '-'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {/* Target Pests & Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Target Pests</p>
                  <div className="flex flex-wrap gap-2">
                    {(sp.target_pests || []).length > 0 ? sp.target_pests.map((p) => (
                      <span key={p} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">{cap(p)}</span>
                    )) : <span className="text-sm text-gray-500 dark:text-gray-400">None specified</span>}
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Products Used</p>
                  {(sp.products_used || []).length > 0 ? sp.products_used.map((p, i) => (
                    <div key={i} className="text-sm py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                      <span className="font-medium text-gray-900 dark:text-white">{p.product_name}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">({p.active_ingredient}) EPA: {p.epa_reg}</span>
                    </div>
                  )) : <span className="text-sm text-gray-500 dark:text-gray-400">None listed</span>}
                </div>
              </div>

              {sp.notes && (
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Notes</p>
                  <p className="text-sm text-gray-900 dark:text-white">{sp.notes}</p>
                </div>
              )}
            </div>)}
          </div>
        )}
      </>)}

      {/* ─── Monitoring Logs Tab ─── */}
      {!loading && !error && tab === 'logs' && (<>
        {/* Summary Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ClipboardList, color: 'text-gray-400', val: logs.length, label: 'Total Inspections' },
            { icon: Eye, color: 'text-blue-500', val: pcoVisits, label: 'PCO Visits' },
            { icon: AlertTriangle, color: 'text-yellow-500', val: withActivity, label: 'With Activity' },
            { icon: TrendingUp, color: 'text-green-500', val: trend?.direction || trend?.trend || '-', label: 'Activity Trend' },
          ].map(({ icon: Icon, color, val, label }) => (
            <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto ${color} mb-1`} />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{val}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Logs Table */}
        {logs.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-900 dark:text-white">No monitoring logs found</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first log to start tracking pest monitoring.</p>
            <button onClick={() => { setEditingLog(null); setShowLogModal(true); }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"><Plus className="w-4 h-4" />New Log</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Inspector</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">PCO</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Stations</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Activity</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300"></th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{formatDate(l.inspection_date)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{l.inspector_name}</td>
                      <td className="px-4 py-3">{l.is_pco_visit ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">PCO</span> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{l.total_stations_checked || 0}</td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{l.stations_with_activity || 0}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTIVITY_COLORS[l.overall_activity_level] || ACTIVITY_COLORS.none}`}>{cap(l.overall_activity_level || 'none')}</span></td>
                      <td className="px-4 py-3">{l.corrective_actions_needed ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Needed</span> : <span className="text-gray-400">-</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingLog(l); setShowLogModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteLog(l.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>)}

      {/* Modals */}
      {showProgramModal && <ProgramModal program={editingProgram} onClose={() => { setShowProgramModal(false); setEditingProgram(null); }} onSave={handleSaveProgram} />}
      {showLogModal && <LogModal log={editingLog} onClose={() => { setShowLogModal(false); setEditingLog(null); }} onSave={handleSaveLog} />}
    </div>
  );
}
