// =============================================================================
// WELLS MANAGEMENT COMPONENT
// =============================================================================
// src/components/Wells.js
// Main component for managing groundwater wells and SGMA compliance
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Droplets, Plus, Search, Filter, AlertTriangle, CheckCircle,
  Clock, ChevronDown, ChevronRight, MapPin, Gauge, Calendar,
  Edit, Trash2, Eye, FileText, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

// GSA Display names
const GSA_NAMES = {
  'obgma': 'Ojai Basin GMA',
  'fpbgsa': 'Fillmore & Piru Basins GSA',
  'uvrga': 'Upper Ventura River GA',
  'fcgma': 'Fox Canyon GMA',
  'other': 'Other',
  'none': 'None'
};

// Basin display names
const BASIN_NAMES = {
  'ojai_valley': 'Ojai Valley',
  'fillmore': 'Fillmore',
  'piru': 'Piru',
  'upper_ventura_river': 'Upper Ventura River',
  'lower_ventura_river': 'Lower Ventura River',
  'santa_paula': 'Santa Paula',
  'oxnard': 'Oxnard',
  'pleasant_valley': 'Pleasant Valley',
  'las_posas': 'Las Posas Valley',
  'mound': 'Mound',
  'other': 'Other'
};

// Status badge colors
const STATUS_COLORS = {
  'active': 'bg-green-100 text-green-700',
  'inactive': 'bg-cream-100 text-text',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-danger-bg text-danger',
  'monitoring': 'bg-orange-100 text-orange-700'
};

const Wells = ({ onOpenModal }) => {
  const confirm = useConfirm();
  const toast = useToast();
  const [wells, setWells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGSA, setFilterGSA] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedWell, setExpandedWell] = useState(null);
  const [wellReadings, setWellReadings] = useState({});

  // Fetch wells on component mount
  useEffect(() => {
    fetchWells();
  }, [filterGSA, filterStatus]);

  const fetchWells = async () => {
    try {
      setLoading(true);
      const params = { source_type: 'well' };
      if (filterGSA) params.gsa = filterGSA;
      if (filterStatus) params.status = filterStatus;
      const response = await api.get('/water-sources/', { params });
      setWells(response.data.results || response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load wells');
      console.error('Error fetching wells:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch readings for expanded well
  const fetchWellReadings = async (wellId) => {
    try {
      const response = await api.get(`/well-readings/?water_source=${wellId}`);
      setWellReadings(prev => ({
        ...prev,
        [wellId]: response.data.slice(0, 5) // Last 5 readings
      }));
    } catch (err) {
      console.error('Error fetching readings:', err);
    }
  };

  const toggleWellExpanded = (wellId) => {
    if (expandedWell === wellId) {
      setExpandedWell(null);
    } else {
      setExpandedWell(wellId);
      if (!wellReadings[wellId]) {
        fetchWellReadings(wellId);
      }
    }
  };

  const handleDelete = async (wellId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this well?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/water-sources/${wellId}/`);
      fetchWells();
    } catch (err) {
      toast.error('Failed to delete well');
      console.error('Error deleting well:', err);
    }
  };

  // Filter wells by search term
  const filteredWells = wells.filter(well => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (well.well_name || '').toLowerCase().includes(searchLower) ||
      (well.water_source_name || '').toLowerCase().includes(searchLower) ||
      (well.farm_name || '').toLowerCase().includes(searchLower) ||
      (well.gsa_well_id || '').toLowerCase().includes(searchLower)
    );
  });

  // Calculate summary stats
  const stats = {
    total: wells.length,
    active: wells.filter(w => w.status === 'active').length,
    calibrationDue: wells.filter(w => w.calibration_due_soon).length,
    totalYTD: wells.reduce((sum, w) => sum + (w.ytd_extraction_af || 0), 0)
  };

  if (loading && wells.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl text-heading">Wells & SGMA</h2>
          <p className="text-bark-600">Manage groundwater wells and track SGMA compliance</p>
        </div>
        <button
          onClick={() => onOpenModal('well', null)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Well
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-surface-raised rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Droplets className="w-6 h-6 text-link" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Wells</p>
              <p className="text-2xl font-bold text-heading">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Active Wells</p>
              <p className="text-2xl font-bold text-heading">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Calibration Due</p>
              <p className="text-2xl font-bold text-heading">{stats.calibrationDue}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Gauge className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">YTD Extraction</p>
              <p className="text-2xl font-bold text-heading">{stats.totalYTD.toFixed(1)} AF</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-raised rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-5 h-5" />
              <input
                type="text"
                placeholder="Search wells..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border-strong rounded-card bg-surface-raised focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* GSA Filter */}
          <div className="min-w-[180px]">
            <select
              value={filterGSA}
              onChange={(e) => setFilterGSA(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              <option value="">All GSAs</option>
              <option value="obgma">Ojai Basin GMA</option>
              <option value="fpbgsa">Fillmore & Piru Basins GSA</option>
              <option value="uvrga">Upper Ventura River GA</option>
              <option value="fcgma">Fox Canyon GMA</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="standby">Standby</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchWells}
            className="px-4 py-2 border border-border-strong rounded-button hover:bg-cream-50 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-bark-600" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-danger-bg border border-danger/25 rounded-card p-4 text-danger">
          {error}
        </div>
      )}

      {/* Wells List */}
      <div className="space-y-4">
        {filteredWells.length === 0 ? (
          <div className="bg-surface-raised rounded-lg shadow p-8 text-center">
            <Droplets className="w-12 h-12 text-sand-300 mx-auto mb-4" />
            <h3 className="text-lg text-heading mb-2">No wells found</h3>
            <p className="text-text-secondary mb-4">
              {searchTerm || filterGSA || filterStatus
                ? 'Try adjusting your filters'
                : 'Get started by adding your first well'}
            </p>
            {!searchTerm && !filterGSA && !filterStatus && (
              <button
                onClick={() => onOpenModal('well', null)}
                className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
              >
                <Plus className="w-5 h-5" />
                Add Well
              </button>
            )}
          </div>
        ) : (
          filteredWells.map(well => (
            <div key={well.id} className="bg-surface-raised rounded-lg shadow overflow-hidden">
              {/* Well Header */}
              <div
                className="p-4 cursor-pointer hover:bg-cream-50 transition-colors"
                onClick={() => toggleWellExpanded(well.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {expandedWell === well.id ? (
                      <ChevronDown className="w-5 h-5 text-text-muted" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-text-muted" />
                    )}
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Droplets className="w-6 h-6 text-link" />
                    </div>
                    <div>
                      <h3 className=" text-heading">
                        {well.well_name || well.water_source_name}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {well.farm_name} • {GSA_NAMES[well.gsa] || well.gsa}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Calibration Status */}
                    {well.calibration_due_soon && (
                      <span className="flex items-center gap-1 text-yellow-600 text-sm">
                        <Clock className="w-4 h-4" />
                        Calibration Due
                      </span>
                    )}
                    {/* YTD Extraction */}
                    <div className="text-right">
                      <p className="text-sm text-text-secondary">YTD Extraction</p>
                      <p className="font-semibold text-heading">
                        {(well.ytd_extraction_af || 0).toFixed(2)} AF
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[well.status]}`}>
                      {well.status_display || well.status}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onOpenModal('wellReading', { well_id: well.id, well_name: well.well_name })}
                        className="p-2 text-link hover:bg-orange-50 rounded-lg"
                        title="Add Reading"
                      >
                        <Gauge className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onOpenModal('well', well)}
                        className="p-2 text-bark-600 hover:bg-cream-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(well.id)}
                        className="p-2 text-danger hover:bg-danger-bg rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedWell === well.id && (
                <div className="border-t border-border bg-cream-50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Well Info */}
                    <div>
                      <h4 className=" text-heading mb-3">Well Information</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">GSA Well ID:</dt>
                          <dd className="text-heading">{well.gsa_well_id || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">Basin:</dt>
                          <dd className="text-heading">{BASIN_NAMES[well.basin] || well.basin}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">Meter Units:</dt>
                          <dd className="text-heading">{well.flowmeter_units || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">Registered:</dt>
                          <dd className="text-heading">
                            {well.registered_with_gsa ? (
                              <span className="text-primary">Yes</span>
                            ) : (
                              <span className="text-danger">No</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Calibration Info */}
                    <div>
                      <h4 className=" text-heading mb-3">Calibration Status</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">Status:</dt>
                          <dd className={well.meter_calibration_current ? 'text-primary' : 'text-danger'}>
                            {well.meter_calibration_current ? 'Current' : 'Due/Overdue'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-text-secondary">Next Due:</dt>
                          <dd className="text-heading">
                            {well.next_calibration_due || '-'}
                          </dd>
                        </div>
                      </dl>
                      <button
                        onClick={() => onOpenModal('calibration', { well_id: well.id })}
                        className="mt-3 text-sm text-link hover:text-orange-700"
                      >
                        + Add Calibration Record
                      </button>
                    </div>

                    {/* Recent Readings */}
                    <div>
                      <h4 className=" text-heading mb-3">Recent Readings</h4>
                      {wellReadings[well.id] ? (
                        wellReadings[well.id].length > 0 ? (
                          <div className="space-y-2">
                            {wellReadings[well.id].map(reading => (
                              <div key={reading.id} className="flex justify-between text-sm">
                                <span className="text-text-secondary">{reading.reading_date}</span>
                                <span className="text-heading">
                                  {reading.extraction_acre_feet?.toFixed(3) || '-'} AF
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-text-secondary">No readings recorded</p>
                        )
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-text-muted" />
                        </div>
                      )}
                      <button
                        onClick={() => onOpenModal('wellReading', { well_id: well.id, well_name: well.well_name })}
                        className="mt-3 text-sm text-link hover:text-orange-700"
                      >
                        + Add Reading
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Wells;
