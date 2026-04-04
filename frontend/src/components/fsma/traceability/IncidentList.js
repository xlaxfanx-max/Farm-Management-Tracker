import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Plus, ChevronRight, XCircle,
  CheckCircle2, Clock, Shield,
} from 'lucide-react';
import { traceabilityAPI } from '../../../services/api';

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  contained: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const IncidentList = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await traceabilityAPI.getIncidents(params);
      setIncidents(data.results || data);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Contamination Incidents
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="contained">Contained</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Report Incident
          </button>
        </div>
      </div>

      {/* New Incident Form */}
      {showForm && (
        <IncidentForm
          onCreated={() => {
            setShowForm(false);
            loadIncidents();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Incident List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No contamination incidents</p>
          <p className="text-sm mt-1">All lots are clear</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {incident.contamination_type_display}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[incident.status]}`}>
                      {incident.status_display}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {incident.contamination_location_display} &mdash; {incident.incident_date}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {incident.lot_count} lot{incident.lot_count !== 1 ? 's' : ''} affected
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {incident.description?.substring(0, 200)}
                {incident.description?.length > 200 ? '...' : ''}
              </p>

              {incident.recall_initiated && (
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">
                  <XCircle className="w-3 h-3" />
                  Recall initiated {incident.fda_recall_number && `(${incident.fda_recall_number})`}
                </div>
              )}

              {/* Corrective Actions */}
              {incident.corrective_actions?.length > 0 && (
                <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Corrective Actions ({incident.corrective_actions.length})
                  </div>
                  {incident.corrective_actions.map((ca) => (
                    <div key={ca.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-700 dark:text-gray-300">
                        {ca.action_description.substring(0, 80)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ca.status === 'verified' ? 'bg-green-100 text-green-700' :
                        ca.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {ca.status_display}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Inline incident creation form
const IncidentForm = ({ onCreated, onCancel }) => {
  const [form, setForm] = useState({
    incident_date: new Date().toISOString().split('T')[0],
    contamination_type: 'pathogen',
    contamination_location: 'field',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await traceabilityAPI.createIncident(form);
      onCreated();
    } catch (err) {
      setError('Failed to create incident');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-4 space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date</label>
          <input
            type="date"
            required
            value={form.incident_date}
            onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
          <select
            value={form.contamination_type}
            onChange={(e) => setForm({ ...form, contamination_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          >
            <option value="pathogen">Pathogen Detection</option>
            <option value="physical">Physical Hazard</option>
            <option value="chemical">Chemical Contamination</option>
            <option value="allergen">Allergen Cross-Contact</option>
            <option value="environmental">Environmental Hazard</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
          <select
            value={form.contamination_location}
            onChange={(e) => setForm({ ...form, contamination_location: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          >
            <option value="field">In Field</option>
            <option value="during_harvest">During Harvest</option>
            <option value="in_transit">During Transport</option>
            <option value="at_packinghouse">At Packinghouse</option>
            <option value="at_retail">At Retail</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe the contamination event..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Report Incident'}
        </button>
      </div>
    </form>
  );
};

export default IncidentList;
