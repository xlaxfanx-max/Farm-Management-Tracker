import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Search, Filter, X, Edit2, Trash2, CheckCircle, XCircle,
  AlertTriangle, Loader2, RefreshCw, Play, Square, Award, Tag } from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const formatDuration = (m) => {
  if (!m && m !== 0) return '-';
  const h = Math.floor(m / 60); const mn = Math.round(m % 60);
  return h > 0 ? `${h}h ${mn}m` : `${mn}m`;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' }, { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];
const statusBadgeStyles = {
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 animate-pulse',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const statusLabels = { planned: 'Planned', in_progress: 'In Progress', completed: 'Completed', failed: 'Failed' };
const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[status] || statusBadgeStyles.planned}`}>
    {statusLabels[status] || status}
  </span>
);
const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';

const INITIAL_FORM = {
  recall_number: '', exercise_date: '', scenario_description: '', trigger_reason: '',
  target_product: '', target_lot_numbers: [], led_by: '', participants: [], notes: '',
};

const RecallModal = ({ recall, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => recall ? {
    recall_number: recall.recall_number || '', exercise_date: recall.exercise_date || '',
    scenario_description: recall.scenario_description || '', trigger_reason: recall.trigger_reason || '',
    target_product: recall.target_product || '', target_lot_numbers: recall.target_lot_numbers || [],
    led_by: recall.led_by || '', participants: recall.participants || [], notes: recall.notes || '',
  } : { ...INITIAL_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [lotInput, setLotInput] = useState('');
  const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));
  const addLot = () => {
    const t = lotInput.trim();
    if (t && !formData.target_lot_numbers.includes(t)) {
      setFormData((p) => ({ ...p, target_lot_numbers: [...p.target_lot_numbers, t] }));
      setLotInput('');
    }
  };
  const removeLot = (lot) => setFormData((p) => ({ ...p, target_lot_numbers: p.target_lot_numbers.filter((l) => l !== lot) }));
  const addParticipant = () => setFormData((p) => ({ ...p, participants: [...p.participants, { name: '', role: '' }] }));
  const updateParticipant = (i, field, val) => setFormData((p) => {
    const u = [...p.participants]; u[i] = { ...u[i], [field]: val }; return { ...p, participants: u };
  });
  const removeParticipant = (i) => setFormData((p) => ({ ...p, participants: p.participants.filter((_, j) => j !== i) }));
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setSaveError(null);
    try { await onSave(formData, recall?.id); onClose(); }
    catch (err) { setSaveError(err.response?.data?.detail || 'Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{recall ? 'Edit Mock Recall' : 'Create Mock Recall'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recall Number *</label>
              <input type="text" name="recall_number" required value={formData.recall_number} onChange={handleChange} placeholder="e.g., MR-2026-001" className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exercise Date</label>
              <input type="date" name="exercise_date" value={formData.exercise_date} onChange={handleChange} className={inputCls} /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scenario Description</label>
            <textarea name="scenario_description" value={formData.scenario_description} onChange={handleChange} rows={2} placeholder="Describe the recall scenario..." className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trigger Reason</label>
              <input type="text" name="trigger_reason" value={formData.trigger_reason} onChange={handleChange} placeholder="e.g., Allergen contamination" className={inputCls} /></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Product</label>
              <input type="text" name="target_product" value={formData.target_product} onChange={handleChange} placeholder="e.g., Organic Avocados" className={inputCls} /></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Lot Numbers</label>
            <div className="flex gap-2">
              <input type="text" value={lotInput} onChange={(e) => setLotInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLot(); } }} placeholder="Add lot number" className={`flex-1 ${inputCls}`} />
              <button type="button" onClick={addLot} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            {formData.target_lot_numbers.length > 0 && <div className="flex flex-wrap gap-2 mt-2">
              {formData.target_lot_numbers.map((lot) => (
                <span key={lot} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full">
                  <Tag className="w-3 h-3" />{lot}<button type="button" onClick={() => removeLot(lot)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>))}
            </div>}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Led By</label>
            <input type="text" name="led_by" value={formData.led_by} onChange={handleChange} placeholder="Name of exercise leader" className={inputCls} /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Participants</label>
              <button type="button" onClick={addParticipant} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
            </div>
            {formData.participants.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" value={p.name} onChange={(e) => updateParticipant(i, 'name', e.target.value)} placeholder="Name" className={`flex-1 text-sm ${inputCls}`} />
                <input type="text" value={p.role} onChange={(e) => updateParticipant(i, 'role', e.target.value)} placeholder="Role" className={`flex-1 text-sm ${inputCls}`} />
                <button type="button" onClick={() => removeParticipant(i)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X className="w-4 h-4" /></button>
              </div>))}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} placeholder="Additional notes..." className={inputCls} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : recall ? 'Update Recall' : 'Create Recall'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const LiveExerciseView = ({ recall, onRefresh }) => {
  const [elapsed, setElapsed] = useState(0);
  const [forward, setForward] = useState({ buyer: '', destination: '' });
  const [backward, setBackward] = useState({ supplier: '', field: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!recall.trace_start_time) return;
    const start = new Date(recall.trace_start_time).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [recall.trace_start_time]);
  const hrs = Math.floor(elapsed / 3600), mins = Math.floor((elapsed % 3600) / 60), secs = elapsed % 60;
  const timerColor = hrs >= 4 ? 'text-red-600 dark:text-red-400' : hrs >= 2 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
  const handleStart = async () => {
    try { setSaving(true); await primusGFSAPI.startMockRecall(recall.id, {}); onRefresh(); }
    catch (err) { console.error('Failed to start trace:', err); } finally { setSaving(false); }
  };
  const handleComplete = async () => {
    try { setSaving(true); await primusGFSAPI.completeMockRecall(recall.id, {
      lots_traced_forward: recall.lots_traced_forward || [], lots_traced_backward: recall.lots_traced_backward || [],
    }); onRefresh(); } catch (err) { console.error('Failed to complete trace:', err); } finally { setSaving(false); }
  };
  const addForwardEntry = async () => {
    if (!forward.buyer.trim()) return;
    try { await primusGFSAPI.updateMockRecall(recall.id, { lots_traced_forward: [...(recall.lots_traced_forward || []), { ...forward }] });
      setForward({ buyer: '', destination: '' }); onRefresh();
    } catch (err) { console.error('Failed to add forward trace:', err); }
  };
  const addBackwardEntry = async () => {
    if (!backward.supplier.trim()) return;
    try { await primusGFSAPI.updateMockRecall(recall.id, { lots_traced_backward: [...(recall.lots_traced_backward || []), { ...backward }] });
      setBackward({ supplier: '', field: '' }); onRefresh();
    } catch (err) { console.error('Failed to add backward trace:', err); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Play className="w-5 h-5" />Live Exercise: {recall.recall_number}</h3>
        <StatusBadge status={recall.status} />
      </div>
      <div className="text-center py-4">
        {recall.trace_start_time ? (
          <div className={`text-5xl font-mono font-bold ${timerColor}`}>{String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</div>
        ) : (
          <button onClick={handleStart} disabled={saving} className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2 text-lg font-medium">
            <Play className="w-5 h-5" />{saving ? 'Starting...' : 'Start Trace'}</button>
        )}
      </div>
      {recall.trace_start_time && (<>
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Forward Trace (Buyer/Destination)</h4>
          {(recall.lots_traced_forward || []).map((e, i) => (<div key={i} className="text-sm text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium">{e.buyer}</span> &rarr; {e.destination}</div>))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={forward.buyer} onChange={(e) => setForward((p) => ({ ...p, buyer: e.target.value }))} placeholder="Buyer" className={`flex-1 text-sm ${inputCls}`} />
            <input type="text" value={forward.destination} onChange={(e) => setForward((p) => ({ ...p, destination: e.target.value }))} placeholder="Destination" className={`flex-1 text-sm ${inputCls}`} />
            <button type="button" onClick={addForwardEntry} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">Add</button>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Backward Trace (Supplier/Field)</h4>
          {(recall.lots_traced_backward || []).map((e, i) => (<div key={i} className="text-sm text-gray-600 dark:text-gray-400 mb-1"><span className="font-medium">{e.supplier}</span> &larr; {e.field}</div>))}
          <div className="flex gap-2 mt-2">
            <input type="text" value={backward.supplier} onChange={(e) => setBackward((p) => ({ ...p, supplier: e.target.value }))} placeholder="Supplier" className={`flex-1 text-sm ${inputCls}`} />
            <input type="text" value={backward.field} onChange={(e) => setBackward((p) => ({ ...p, field: e.target.value }))} placeholder="Field/Source" className={`flex-1 text-sm ${inputCls}`} />
            <button type="button" onClick={addBackwardEntry} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">Add</button>
          </div>
        </div>
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleComplete} disabled={saving} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
            <Square className="w-4 h-4" />{saving ? 'Completing...' : 'Complete Trace'}</button>
        </div>
      </>)}
    </div>
  );
};

const ResultsView = ({ recall, onRefresh }) => {
  const [scoring, setScoring] = useState(false);
  const passed = recall.passed || (recall.effectiveness_score >= 80 && recall.trace_duration_minutes < 240 && recall.product_accounted_percent >= 100);
  const handleScore = async () => {
    try { setScoring(true); await primusGFSAPI.scoreMockRecall(recall.id, {}); onRefresh(); }
    catch (err) { console.error('Failed to score exercise:', err); } finally { setScoring(false); }
  };
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Award className="w-5 h-5" />Results: {recall.recall_number}</h3>
        <StatusBadge status={recall.status} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{recall.effectiveness_score ?? '-'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Score / 100</div></div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className={`text-lg font-bold ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {passed ? <CheckCircle className="w-8 h-8 mx-auto" /> : <XCircle className="w-8 h-8 mx-auto" />}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{passed ? 'PASSED' : 'FAILED'}</div></div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatDuration(recall.trace_duration_minutes)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Duration</div></div>
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{recall.product_accounted_percent ?? '-'}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Traced</div></div>
      </div>
      {recall.effectiveness_score == null && <div className="flex justify-end">
        <button onClick={handleScore} disabled={scoring} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2">
          <Award className="w-4 h-4" />{scoring ? 'Scoring...' : 'Score Exercise'}</button>
      </div>}
    </div>
  );
};

export default function MockRecallExercise() {
  const [recalls, setRecalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRecall, setEditingRecall] = useState(null);
  const [activeRecall, setActiveRecall] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecalls = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;
      const response = await primusGFSAPI.getMockRecalls(params);
      setRecalls(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to fetch mock recalls:', err);
      setError('Failed to load mock recalls. Please try again.');
    } finally { setLoading(false); }
  }, [filterStatus, searchQuery]);

  useEffect(() => { fetchRecalls(); }, [fetchRecalls]);

  const handleSave = async (formData, id) => {
    if (id) await primusGFSAPI.updateMockRecall(id, formData);
    else await primusGFSAPI.createMockRecall(formData);
    fetchRecalls();
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mock recall?')) return;
    try { await primusGFSAPI.deleteMockRecall(id); if (activeRecall?.id === id) setActiveRecall(null); fetchRecalls(); }
    catch (err) { console.error('Failed to delete mock recall:', err); }
  };
  const handleEdit = (recall) => { setEditingRecall(recall); setShowCreateModal(true); };
  const handleRowClick = (recall) => setActiveRecall(activeRecall?.id === recall.id ? null : recall);
  const handleRefresh = () => {
    fetchRecalls().then(() => {
      if (activeRecall) primusGFSAPI.getMockRecall(activeRecall.id).then((res) => setActiveRecall(res.data)).catch(() => {});
    });
  };

  const totalExercises = recalls.length;
  const passedCount = recalls.filter((r) => r.passed).length;
  const scored = recalls.filter((r) => r.effectiveness_score != null);
  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.effectiveness_score, 0) / scored.length) : 0;
  const lastDate = recalls.length > 0 ? formatDate(recalls.reduce((l, r) => (!l || (r.exercise_date && r.exercise_date > l) ? r.exercise_date : l), null)) : '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-6 h-6" />Mock Recall Exercises</h2>
        <button onClick={() => { setEditingRecall(null); setShowCreateModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" />New Exercise</button>
      </div>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[{ label: 'Total Exercises', value: totalExercises, color: 'text-gray-900 dark:text-white' },
          { label: 'Passed', value: passedCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'Avg Score', value: avgScore, color: 'text-gray-900 dark:text-white' },
          { label: 'Last Exercise', value: lastDate, color: 'text-gray-900 dark:text-white' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
          </div>))}
      </div>
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search recalls..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>
      {/* Active Exercise Detail */}
      {activeRecall && activeRecall.status === 'in_progress' && <LiveExerciseView recall={activeRecall} onRefresh={handleRefresh} />}
      {activeRecall && (activeRecall.status === 'completed' || activeRecall.status === 'failed') && <ResultsView recall={activeRecall} onRefresh={handleRefresh} />}
      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={fetchRecalls} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><RefreshCw className="w-4 h-4" />Retry</button>
        </div>)}
      {/* Loading */}
      {loading && !error && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-green-600 animate-spin" /></div>}
      {/* Empty */}
      {!loading && !error && recalls.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No mock recall exercises found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Create your first mock recall exercise to test traceability readiness.</p>
          <button onClick={() => { setEditingRecall(null); setShowCreateModal(true); }} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus className="w-4 h-4" />New Exercise</button>
        </div>)}
      {/* Table */}
      {!loading && !error && recalls.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                {['Recall #', 'Date', 'Scenario', 'Status', 'Duration', 'Score', 'Result'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{h}</th>))}
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recalls.map((r) => (
                  <tr key={r.id} onClick={() => handleRowClick(r)} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${activeRecall?.id === r.id ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{r.recall_number}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(r.exercise_date)}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white max-w-[200px] truncate">{r.scenario_description || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDuration(r.trace_duration_minutes)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.effectiveness_score ?? '-'}</td>
                    <td className="px-4 py-3">
                      {r.status === 'completed' || r.status === 'failed' ? (r.passed
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Pass</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Fail</span>
                      ) : <span className="text-gray-400">-</span>}</td>
                    <td className="px-4 py-3"><div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div></td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
      {showCreateModal && <RecallModal recall={editingRecall} onClose={() => { setShowCreateModal(false); setEditingRecall(null); }} onSave={handleSave} />}
    </div>
  );
}
