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
  'active': 'bg-green-100 text-green-800',
  'inactive': 'bg-gray-100 text-gray-800',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-red-100 text-red-800',
  'monitoring': 'bg-blue-100 text-blue-800'
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Wells & SGMA</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage groundwater wells and track SGMA compliance</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Droplets className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Wells</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-6 h-6 text-primary dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Wells</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Calibration Due</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.calibrationDue}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Gauge className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">YTD Extraction</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalYTD.toFixed(1)} AF</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search wells..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* GSA Filter */}
          <div className="min-w-[180px]">
            <select
              value={filterGSA}
              onChange={(e) => setFilterGSA(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Wells List */}
      <div className="space-y-4">
        {filteredWells.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No wells found</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
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
            <div key={well.id} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              {/* Well Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleWellExpanded(well.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {expandedWell === well.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Droplets className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {well.well_name || well.water_source_name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      <p className="text-sm text-gray-500">YTD Extraction</p>
                      <p className="font-semibold text-gray-900">
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
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Add Reading"
                      >
                        <Gauge className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onOpenModal('well', well)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(well.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Well Info */}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Well Information</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">GSA Well ID:</dt>
                          <dd className="text-gray-900">{well.gsa_well_id || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Basin:</dt>
                          <dd className="text-gray-900">{BASIN_NAMES[well.basin] || well.basin}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Meter Units:</dt>
                          <dd className="text-gray-900">{well.flowmeter_units || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Registered:</dt>
                          <dd className="text-gray-900">
                            {well.registered_with_gsa ? (
                              <span className="text-primary">Yes</span>
                            ) : (
                              <span className="text-red-600">No</span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* Calibration Info */}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Calibration Status</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Status:</dt>
                          <dd className={well.meter_calibration_current ? 'text-primary' : 'text-red-600'}>
                            {well.meter_calibration_current ? 'Current' : 'Due/Overdue'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500">Next Due:</dt>
                          <dd className="text-gray-900">
                            {well.next_calibration_due || '-'}
                          </dd>
                        </div>
                      </dl>
                      <button
                        onClick={() => onOpenModal('calibration', { well_id: well.id })}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                      >
                        + Add Calibration Record
                      </button>
                    </div>

                    {/* Recent Readings */}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Readings</h4>
                      {wellReadings[well.id] ? (
                        wellReadings[well.id].length > 0 ? (
                          <div className="space-y-2">
                            {wellReadings[well.id].map(reading => (
                              <div key={reading.id} className="flex justify-between text-sm">
                                <span className="text-gray-500">{reading.reading_date}</span>
                                <span className="text-gray-900">
                                  {reading.extraction_acre_feet?.toFixed(3) || '-'} AF
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No readings recorded</p>
                        )
                      ) : (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => onOpenModal('wellReading', { well_id: well.id, well_name: well.well_name })}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-700"
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
