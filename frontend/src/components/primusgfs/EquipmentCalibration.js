import React, { useState, useEffect, useCallback } from 'react';
import { Wrench, Plus, Search, Filter, X, Edit2, Trash2, CheckCircle,
  AlertTriangle, Loader2, RefreshCw, Clock, Upload, Paperclip, Download } from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';

const STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' }, { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' }, { value: 'overdue', label: 'Overdue' }];

const TYPE_OPTIONS = [{ value: '', label: 'All Types' }, { value: 'scale', label: 'Scale' },
  { value: 'thermometer', label: 'Thermometer' }, { value: 'ph_meter', label: 'pH Meter' },
  { value: 'pressure_gauge', label: 'Pressure Gauge' }, { value: 'flow_meter', label: 'Flow Meter' },
  { value: 'sprayer', label: 'Sprayer' }, { value: 'conductivity_meter', label: 'Conductivity Meter' },
  { value: 'moisture_meter', label: 'Moisture Meter' }, { value: 'other', label: 'Other' }];

const METHOD_OPTIONS = [{ value: 'internal', label: 'Internal' }, { value: 'external_lab', label: 'External Lab' },
  { value: 'manufacturer', label: 'Manufacturer' }, { value: 'third_party', label: 'Third Party' }];

const typeLabels = Object.fromEntries(TYPE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const statusStyles = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  passed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse',
};
const statusLabels = { scheduled: 'Scheduled', in_progress: 'In Progress', passed: 'Passed', failed: 'Failed', overdue: 'Overdue' };
const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.scheduled}`}>{statusLabels[status] || status}</span>
);

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
const dueDateClass = (dateStr) => {
  const d = daysUntil(dateStr);
  if (d === null) return 'text-gray-600 dark:text-gray-400';
  if (d < 7) return 'text-red-600 dark:text-red-400 font-semibold';
  if (d <= 30) return 'text-yellow-600 dark:text-yellow-400 font-medium';
  return 'text-green-600 dark:text-green-400';
};

const INITIAL_FORM = {
  equipment_name: '', equipment_type: 'scale', equipment_id: '', location: '',
  manufacturer: '', model_number: '', calibration_date: '', next_calibration_date: '',
  calibration_method: 'internal', calibrated_by: '', calibration_standard: '',
  reading_before: '', reading_after: '', tolerance: '', within_tolerance: false,
  corrective_action_taken: '', certificate_number: '', notes: '',
};

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx';

const CalibrationModal = ({ record, onClose, onSave, completeMode }) => {
  const [formData, setFormData] = useState(() => {
    if (record) {
      const f = {};
      Object.keys(INITIAL_FORM).forEach((k) => { f[k] = record[k] ?? INITIAL_FORM[k]; });
      return f;
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      let payload;
      if (selectedFile) {
        payload = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            payload.append(key, value);
          }
        });
        payload.append('certificate_file', selectedFile);
      } else {
        payload = formData;
      }
      await onSave(payload, record?.id);
      setSelectedFile(null);
      onClose();
    } catch (error) {
      setSaveError(error.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const title = completeMode ? 'Complete Calibration' : record ? 'Edit Calibration' : 'New Calibration';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">{saveError}</div>}

          {!completeMode && (
            <>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Equipment Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Equipment Name *</label><input type="text" name="equipment_name" required value={formData.equipment_name} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Type *</label><select name="equipment_type" required value={formData.equipment_type} onChange={handleChange} className={inputCls}>{TYPE_OPTIONS.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Serial / ID</label><input type="text" name="equipment_id" value={formData.equipment_id} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Location</label><input type="text" name="location" value={formData.location} onChange={handleChange} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Manufacturer</label><input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Model Number</label><input type="text" name="model_number" value={formData.model_number} onChange={handleChange} className={inputCls} /></div>
              </div>

              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">Calibration Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Calibration Date</label><input type="date" name="calibration_date" value={formData.calibration_date} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Next Calibration Date</label><input type="date" name="next_calibration_date" value={formData.next_calibration_date} onChange={handleChange} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Method</label><select name="calibration_method" value={formData.calibration_method} onChange={handleChange} className={inputCls}>{METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label className={labelCls}>Calibrated By</label><input type="text" name="calibrated_by" value={formData.calibrated_by} onChange={handleChange} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Calibration Standard</label><input type="text" name="calibration_standard" value={formData.calibration_standard} onChange={handleChange} className={inputCls} /></div>
            </>
          )}

          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">Results</h3>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={labelCls}>Reading Before</label><input type="text" name="reading_before" value={formData.reading_before} onChange={handleChange} className={inputCls} /></div>
            <div><label className={labelCls}>Reading After</label><input type="text" name="reading_after" value={formData.reading_after} onChange={handleChange} className={inputCls} /></div>
            <div><label className={labelCls}>Tolerance</label><input type="text" name="tolerance" value={formData.tolerance} onChange={handleChange} className={inputCls} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" name="within_tolerance" checked={formData.within_tolerance} onChange={handleChange} className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500" />
            Within Tolerance
          </label>
          {formData.within_tolerance === false && (
            <div><label className={labelCls}>Corrective Action Taken</label><textarea name="corrective_action_taken" value={formData.corrective_action_taken} onChange={handleChange} rows={3} className={inputCls} /></div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Certificate Number</label><input type="text" name="certificate_number" value={formData.certificate_number} onChange={handleChange} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Notes</label><textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={inputCls} /></div>

          {/* Certificate File Upload */}
          <div>
            <label className={labelCls}>Calibration Certificate</label>
            {record?.certificate_file_name && !selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <Paperclip className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-700 dark:text-green-300 truncate flex-1">{record.certificate_file_name}</span>
                {record.certificate_file_url && (
                  <a href={record.certificate_file_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline flex-shrink-0">
                    <Download className="w-3 h-3" /> View
                  </a>
                )}
                <label className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 cursor-pointer flex-shrink-0">
                  Replace
                  <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleFileSelect} className="hidden" />
                </label>
              </div>
            )}
            {selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-300 truncate flex-1">{selectedFile.name}</span>
                <span className="text-xs text-blue-500 dark:text-blue-400 flex-shrink-0">{formatFileSize(selectedFile.size)}</span>
                <button type="button" onClick={() => setSelectedFile(null)} className="p-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {!selectedFile && !record?.certificate_file_name && (
              <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${dragOver
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-500 bg-gray-50 dark:bg-gray-700/30'}`}
              >
                <input type="file" accept={ACCEPTED_FILE_TYPES} onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-green-600 dark:text-green-400">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF, JPG, PNG, DOC, DOCX</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : completeMode ? 'Complete Calibration' : record ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function EquipmentCalibration() {
  const [calibrations, setCalibrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [completeMode, setCompleteMode] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [overdueList, setOverdueList] = useState([]);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const fetchCalibrations = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.equipment_type = filterType;
      if (searchQuery) params.search = searchQuery;
      const [res, overdueRes, upcomingRes] = await Promise.all([
        primusGFSAPI.getCalibrations(params), primusGFSAPI.overdueCalibrations(), primusGFSAPI.upcomingCalibrations()]);
      setCalibrations(res.data.results || res.data || []);
      setOverdueList(overdueRes.data.results || overdueRes.data || []);
      setUpcomingCount((upcomingRes.data.results || upcomingRes.data || []).length);
    } catch (err) { console.error('Failed to fetch calibrations:', err); setError('Failed to load calibrations. Please try again.'); }
    finally { setLoading(false); }
  }, [filterStatus, filterType, searchQuery]);
  useEffect(() => { fetchCalibrations(); }, [fetchCalibrations]);

  const handleSave = async (formData, id) => {
    if (completeMode && id) await primusGFSAPI.completeCalibration(id, formData);
    else if (id) await primusGFSAPI.updateCalibration(id, formData);
    else await primusGFSAPI.createCalibration(formData);
    fetchCalibrations();
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this calibration record?')) return;
    try { await primusGFSAPI.deleteCalibration(id); fetchCalibrations(); }
    catch (err) { console.error('Failed to delete calibration:', err); }
  };
  const openCreate = () => { setEditingRecord(null); setCompleteMode(false); setShowModal(true); };
  const openEdit = (rec) => { setEditingRecord(rec); setCompleteMode(false); setShowModal(true); };
  const openComplete = (rec) => { setEditingRecord(rec); setCompleteMode(true); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingRecord(null); setCompleteMode(false); };
  const totalCount = calibrations.length;
  const passedCount = calibrations.filter((c) => c.status === 'passed').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-6 h-6" />
          Equipment Calibration
        </h2>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" /> New Calibration
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[{ label: 'Total Equipment', value: totalCount, icon: Wrench, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Current (Passed)', value: passedCount, icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
          { label: 'Overdue', value: overdueList.length, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400' },
          { label: 'Upcoming', value: upcomingCount, icon: Clock, color: 'text-yellow-600 dark:text-yellow-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p><p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p></div>
          </div>))}
      </div>

      {/* Overdue Alert */}
      {overdueList.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div><p className="font-medium text-red-800 dark:text-red-300">{overdueList.length} calibration{overdueList.length > 1 ? 's' : ''} overdue</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{overdueList.map((o) => o.equipment_name).join(', ')}</p></div>
        </div>)}

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search equipment..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500">
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button onClick={fetchCalibrations} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"><RefreshCw className="w-4 h-4" /> Retry</button>
        </div>)}

      {/* Loading */}
      {loading && !error && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-green-600 animate-spin" /></div>}

      {/* Empty */}
      {!loading && !error && calibrations.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No calibration records found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Add your first equipment calibration record to start tracking.</p>
          <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><Plus className="w-4 h-4" /> New Calibration</button>
        </div>)}

      {/* Table */}
      {!loading && !error && calibrations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                {['Equipment','Type','ID / Serial','Location','Last Cal Date','Next Due','Status','Tolerance'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">{h}</th>))}
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {calibrations.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="flex items-center gap-1.5">
                        {rec.equipment_name}
                        {rec.has_certificate && <Paperclip className="w-3.5 h-3.5 text-green-500 dark:text-green-400 flex-shrink-0" title="Certificate attached" />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{typeLabels[rec.equipment_type] || rec.equipment_type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{rec.equipment_id || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rec.location || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(rec.calibration_date)}</td>
                    <td className={`px-4 py-3 ${dueDateClass(rec.next_calibration_date)}`}>{formatDate(rec.next_calibration_date)}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                    <td className="px-4 py-3">
                      {rec.within_tolerance === true && <span className="text-green-600 dark:text-green-400 font-medium">Pass</span>}
                      {rec.within_tolerance === false && rec.status === 'failed' && <span className="text-red-600 dark:text-red-400 font-medium">Fail</span>}
                      {rec.within_tolerance == null && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {rec.certificate_file_url && (
                          <a href={rec.certificate_file_url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="View Certificate">
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {(rec.status === 'scheduled' || rec.status === 'in_progress') && (
                          <button onClick={() => openComplete(rec)} className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="Complete Calibration">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEdit(rec)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rec.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        <CalibrationModal record={editingRecord} onClose={closeModal} onSave={handleSave} completeMode={completeMode} />
      )}
    </div>
  );
}
