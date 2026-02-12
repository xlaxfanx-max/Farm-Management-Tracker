import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets,
  Plus,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  Filter,
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

const todayStr = () => new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
  farm: '', field: '', log_date: todayStr(), worker_count: '',
  units_deployed: '', hand_wash_stations: 0,
  soap_available: false, paper_towels_available: false,
  potable_water_available: false, sanitizer_available: false,
  units_clean: false, service_needed: false, service_requested_date: '',
  deficiency_notes: '', notes: '',
};

const calcRequired = (count) => (count > 0 ? Math.ceil(count / 20) : 0);

const willBeCompliant = (f) => {
  const req = calcRequired(Number(f.worker_count) || 0);
  return (Number(f.units_deployed) || 0) >= req && req > 0
    && f.soap_available && f.paper_towels_available
    && f.potable_water_available && f.units_clean;
};

const ComplianceBadge = ({ compliant }) => compliant ? (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
    <CheckCircle className="w-3 h-3" /> Compliant
  </span>
) : (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
    <XCircle className="w-3 h-3" /> Non-Compliant
  </span>
);

const SanitationModal = ({ log, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (log) {
      return {
        farm: log.farm || '', field: log.field || '',
        log_date: log.log_date || todayStr(), worker_count: log.worker_count || '',
        units_deployed: log.units_deployed || '', hand_wash_stations: log.hand_wash_stations || 0,
        soap_available: !!log.soap_available, paper_towels_available: !!log.paper_towels_available,
        potable_water_available: !!log.potable_water_available, sanitizer_available: !!log.sanitizer_available,
        units_clean: !!log.units_clean, service_needed: !!log.service_needed,
        service_requested_date: log.service_requested_date || '',
        deficiency_notes: log.deficiency_notes || '', notes: log.notes || '',
      };
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...formData, worker_count: Number(formData.worker_count), units_deployed: Number(formData.units_deployed), hand_wash_stations: Number(formData.hand_wash_stations) };
      if (!payload.field) delete payload.field;
      if (!payload.service_requested_date) delete payload.service_requested_date;
      await onSave(payload, log?.id);
      onClose();
    } catch (error) {
      setSaveError(error.response?.data?.detail || 'Failed to save log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const unitsReq = calcRequired(Number(formData.worker_count) || 0);
  const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{log ? 'Edit Sanitation Log' : 'New Sanitation Log'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelCls}>Date *</label><input type="date" name="log_date" required value={formData.log_date} onChange={handleChange} className={inputCls} /></div>
            <div><label className={labelCls}>Farm ID *</label><input type="number" name="farm" required value={formData.farm} onChange={handleChange} placeholder="Farm ID" className={inputCls} /></div>
            <div><label className={labelCls}>Field ID</label><input type="number" name="field" value={formData.field} onChange={handleChange} placeholder="Optional" className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Workers *</label>
              <input type="number" name="worker_count" required min="1" value={formData.worker_count} onChange={handleChange} className={inputCls} />
              {unitsReq > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Units Required: {unitsReq}</p>}
            </div>
            <div><label className={labelCls}>Units Deployed *</label><input type="number" name="units_deployed" required min="0" value={formData.units_deployed} onChange={handleChange} className={inputCls} /></div>
            <div><label className={labelCls}>Hand Wash Stations</label><input type="number" name="hand_wash_stations" min="0" value={formData.hand_wash_stations} onChange={handleChange} className={inputCls} /></div>
          </div>
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">Supply Checklist</legend>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[['soap_available','Soap'],['paper_towels_available','Paper Towels'],['potable_water_available','Potable Water'],['sanitizer_available','Sanitizer']].map(([k,l])=>(
                <label key={k} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" name={k} checked={formData[k]} onChange={handleChange} className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500" />{l}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" name="units_clean" checked={formData.units_clean} onChange={handleChange} className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500" /> Units Clean
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" name="service_needed" checked={formData.service_needed} onChange={handleChange} className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500" /> Service Needed
            </label>
          </div>
          {formData.service_needed && (
            <div><label className={labelCls}>Service Requested Date</label><input type="date" name="service_requested_date" value={formData.service_requested_date} onChange={handleChange} className={inputCls} /></div>
          )}
          <div><label className={labelCls}>Deficiency Notes</label><textarea name="deficiency_notes" value={formData.deficiency_notes} onChange={handleChange} rows={2} className={inputCls} /></div>
          <div><label className={labelCls}>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputCls} /></div>
          {formData.worker_count > 0 && (
            <div className="text-sm">{willBeCompliant(formData)
              ? <span className="text-green-600 dark:text-green-400 font-medium">Will be Compliant</span>
              : <span className="text-red-600 dark:text-red-400 font-medium">Non-Compliant</span>}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">{saving ? 'Saving...' : log ? 'Update Log' : 'Create Log'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function FieldSanitationTracker() {
  const [logs, setLogs] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [farmFilter, setFarmFilter] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (farmFilter) params.farm = farmFilter;
      const [logsRes, todayRes, summaryRes] = await Promise.all([
        primusGFSAPI.getSanitationLogs(params),
        primusGFSAPI.todaySanitationLogs(),
        primusGFSAPI.sanitationComplianceSummary(),
      ]);
      setLogs(logsRes.data.results || logsRes.data || []);
      setTodayLogs(todayRes.data.results || todayRes.data || []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to fetch sanitation data:', err);
      setError('Failed to load sanitation data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, farmFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (formData, id) => {
    if (id) { await primusGFSAPI.updateSanitationLog(id, formData); }
    else { await primusGFSAPI.createSanitationLog(formData); }
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sanitation log?')) return;
    try { await primusGFSAPI.deleteSanitationLog(id); fetchAll(); }
    catch (err) { console.error('Failed to delete sanitation log:', err); }
  };

  const handleEdit = (log) => { setEditingLog(log); setShowModal(true); };
  const complianceRate = summary ? (summary.compliance_rate ?? (summary.total_logs > 0 ? Math.round((summary.compliant_count / summary.total_logs) * 100) : 0)) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Droplets className="w-6 h-6" /> Field Sanitation Tracker
        </h2>
        <button onClick={() => { setEditingLog(null); setShowModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" /> New Log
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4 mb-3">
            {[['Total Logs', summary.total_logs],['Compliant', summary.compliant_count],['Non-Compliant', summary.non_compliant_count],['Rate', `${complianceRate}%`]].map(([label, val])=>(
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{val}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div className="bg-green-500 h-2.5 rounded-full transition-all" style={{ width: `${complianceRate}%` }} />
          </div>
        </div>
      )}

      {/* Today's Logs */}
      {todayLogs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Today</h3>
          <div className="flex flex-wrap gap-2">
            {todayLogs.map((t) => (
              <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-300">
                <span>Farm {t.farm_name || t.farm}</span>
                <ComplianceBadge compliant={t.compliant} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-4 h-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          <input type="text" placeholder="Farm filter..." value={farmFilter} onChange={(e) => setFarmFilter(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500" />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={fetchAll} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-green-600 animate-spin" /></div>
      )}

      {/* Empty */}
      {!loading && !error && logs.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Droplets className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No sanitation logs found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first field sanitation log to start tracking compliance.</p>
          <button onClick={() => { setEditingLog(null); setShowModal(true); }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus className="w-4 h-4" /> New Log</button>
        </div>
      )}

      {/* Log Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {['Date','Farm','Field','Workers','Req.','Deployed','Supplies','Compliant','Actions'].map((h) => (
                    <th key={h} className={`${h === 'Actions' ? 'text-right' : 'text-left'} px-4 py-3 font-medium text-gray-600 dark:text-gray-300`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(log.log_date)}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{log.farm_name || log.farm}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{log.field_name || log.field || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{log.worker_count}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{log.units_required}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{log.units_deployed}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {log.soap_available && <span className="w-2 h-2 rounded-full bg-green-500" title="Soap" />}
                        {log.paper_towels_available && <span className="w-2 h-2 rounded-full bg-blue-500" title="Paper Towels" />}
                        {log.potable_water_available && <span className="w-2 h-2 rounded-full bg-cyan-500" title="Potable Water" />}
                        {log.sanitizer_available && <span className="w-2 h-2 rounded-full bg-purple-500" title="Sanitizer" />}
                      </div>
                    </td>
                    <td className="px-4 py-3"><ComplianceBadge compliant={log.compliant} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(log)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SanitationModal
          log={editingLog}
          onClose={() => { setShowModal(false); setEditingLog(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
