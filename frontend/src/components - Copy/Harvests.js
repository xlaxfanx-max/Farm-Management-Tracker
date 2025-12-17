// =============================================================================
// HARVESTS COMPONENT
// Save as: frontend/src/components/Harvests.js
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Wheat,
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  DollarSign,
  Package,
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit,
  Trash2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { harvestsAPI, HARVEST_CONSTANTS } from '../services/api';

const Harvests = ({ 
  fields, 
  farms,
  onNewHarvest, 
  onEditHarvest,
  onAddLoad,
  onAddLabor,
  refreshTrigger 
}) => {
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedHarvests, setExpandedHarvests] = useState({});
  const [statistics, setStatistics] = useState(null);
  const [filters, setFilters] = useState({
    farm: '',
    field: '',
    status: '',
    season: new Date().getFullYear().toString(),
    crop_variety: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchHarvests();
    fetchStatistics();
  }, [refreshTrigger, filters]);

  const fetchHarvests = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.farm) params.farm = filters.farm;
      if (filters.field) params.field = filters.field;
      if (filters.status) params.status = filters.status;
      if (filters.season) params.season = filters.season;
      if (filters.crop_variety) params.crop_variety = filters.crop_variety;
      
      const response = await harvestsAPI.getAll(params);
      setHarvests(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching harvests:', error);
      setHarvests([]);  // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const params = {};
      if (filters.season) params.season = filters.season;
      if (filters.farm) params.farm = filters.farm;
      
      const response = await harvestsAPI.getStatistics(params);
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const toggleExpand = (harvestId) => {
    setExpandedHarvests(prev => ({
      ...prev,
      [harvestId]: !prev[harvestId]
    }));
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this harvest record?')) {
      try {
        await harvestsAPI.delete(id);
        fetchHarvests();
        fetchStatistics();
      } catch (error) {
        console.error('Error deleting harvest:', error);
        alert('Failed to delete harvest');
      }
    }
  };

  const handleMarkComplete = async (id) => {
    try {
      await harvestsAPI.markComplete(id);
      fetchHarvests();
    } catch (error) {
      console.error('Error marking complete:', error);
    }
  };

  const handleMarkVerified = async (id) => {
    try {
      const response = await harvestsAPI.markVerified(id);
      if (response.data.warnings?.length > 0) {
        alert('Verified with warnings:\n' + response.data.warnings.join('\n'));
      }
      fetchHarvests();
    } catch (error) {
      console.error('Error marking verified:', error);
    }
  };

  const getStatusBadge = (status, phiCompliant) => {
    const statusColors = {
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'complete': 'bg-blue-100 text-blue-800',
      'verified': 'bg-green-100 text-green-800'
    };

    return (
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
          {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        {phiCompliant === false && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
            <AlertTriangle size={12} /> PHI Warning
          </span>
        )}
        {phiCompliant === true && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle size={12} /> PHI OK
          </span>
        )}
      </div>
    );
  };

  const formatCurrency = (value) => {
    if (!value) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatNumber = (value) => {
    if (!value) return '0';
    return new Intl.NumberFormat('en-US').format(value);
  };

  const getFilteredFields = () => {
    if (!filters.farm) return fields;
    return fields.filter(f => parseInt(f.farm) === parseInt(filters.farm));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Harvest Tracking</h1>
          <p className="text-gray-600">Record and manage your citrus harvests</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter size={18} />
            Filters
          </button>
          <button
            onClick={() => { fetchHarvests(); fetchStatistics(); }}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => onNewHarvest()}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus size={18} />
            Record Harvest
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
              <select
                value={filters.season}
                onChange={(e) => setFilters({ ...filters, season: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Seasons</option>
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
              <select
                value={filters.farm}
                onChange={(e) => setFilters({ ...filters, farm: e.target.value, field: '' })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Farms</option>
                {farms.map(farm => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field</label>
              <select
                value={filters.field}
                onChange={(e) => setFilters({ ...filters, field: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Fields</option>
                {getFilteredFields().map(field => (
                  <option key={field.id} value={field.id}>{field.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Crop</label>
              <select
                value={filters.crop_variety}
                onChange={(e) => setFilters({ ...filters, crop_variety: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Crops</option>
                {HARVEST_CONSTANTS.CROP_VARIETIES.map(crop => (
                  <option key={crop.value} value={crop.value}>{crop.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">All Statuses</option>
                {HARVEST_CONSTANTS.HARVEST_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Wheat className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Harvests</p>
                <p className="text-xl font-bold">{statistics.total_harvests}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Bins</p>
                <p className="text-xl font-bold">{formatNumber(statistics.total_bins)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(statistics.total_revenue)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Labor Cost</p>
                <p className="text-xl font-bold">{formatCurrency(statistics.total_labor_cost)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Payments</p>
                <p className="text-xl font-bold">{formatCurrency(statistics.pending_payments)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Wheat className="text-emerald-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Yield/Acre</p>
                <p className="text-xl font-bold">{statistics.avg_yield_per_acre?.toFixed(1) || '0'} bins</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Harvests List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading harvests...</div>
        ) : harvests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Wheat size={48} className="mx-auto mb-4 text-gray-300" />
            <p>No harvests found</p>
            <button
              onClick={() => onNewHarvest()}
              className="mt-4 text-orange-600 hover:text-orange-700"
            >
              Record your first harvest
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {harvests.map(harvest => (
              <div key={harvest.id} className="p-4">
                {/* Harvest Header */}
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(harvest.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      {expandedHarvests[harvest.id] ? (
                        <ChevronDown size={20} />
                      ) : (
                        <ChevronRight size={20} />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{harvest.field_name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">{harvest.farm_name}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">
                          Pick #{harvest.harvest_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(harvest.harvest_date).toLocaleDateString()}
                        </span>
                        <span>{harvest.crop_variety_display}</span>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          {harvest.lot_number}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium">{formatNumber(harvest.total_bins)} bins</p>
                      <p className="text-sm text-gray-500">{harvest.acres_harvested} acres</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        {formatCurrency(harvest.total_revenue)}
                      </p>
                      <p className="text-sm text-gray-500">{harvest.load_count} loads</p>
                    </div>
                    {getStatusBadge(harvest.status, harvest.phi_compliant)}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedHarvests[harvest.id] && (
                  <div className="mt-4 ml-10 space-y-4">
                    {/* PHI Warning Banner */}
                    {harvest.phi_compliant === false && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                        <div>
                          <p className="font-medium text-red-800">PHI Compliance Warning</p>
                          <p className="text-sm text-red-600">
                            Only {harvest.days_since_last_application} days since last application 
                            of {harvest.last_application_product}. Required: {harvest.phi_required_days} days.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddLoad(harvest.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        <Truck size={16} /> Add Load
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onAddLabor(harvest.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        <Users size={16} /> Add Labor
                      </button>
                      {harvest.status === 'in_progress' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkComplete(harvest.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                        >
                          <CheckCircle size={16} /> Mark Complete
                        </button>
                      )}
                      {harvest.status === 'complete' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkVerified(harvest.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                        >
                          <CheckCircle size={16} /> Verify (GAP/GHP)
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditHarvest(harvest); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                      >
                        <Edit size={16} /> Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(harvest.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>

                    {/* GAP/GHP Checklist */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">GAP/GHP Compliance</p>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          {harvest.phi_verified ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <Clock size={16} className="text-gray-400" />
                          )}
                          <span>PHI Verified</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {harvest.equipment_cleaned ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <Clock size={16} className="text-gray-400" />
                          )}
                          <span>Equipment Cleaned</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {harvest.no_contamination_observed ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <Clock size={16} className="text-gray-400" />
                          )}
                          <span>No Contamination</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {harvest.supervisor_name ? (
                            <CheckCircle size={16} className="text-green-600" />
                          ) : (
                            <Clock size={16} className="text-gray-400" />
                          )}
                          <span>Supervisor: {harvest.supervisor_name || 'Not set'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Loads Table */}
                    {harvest.loads && harvest.loads.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Loads ({harvest.loads.length})</p>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Buyer</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Bins</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grade</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Payment</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Truck</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {harvest.loads.map(load => (
                                <tr key={load.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm">{load.load_number}</td>
                                  <td className="px-3 py-2 text-sm">{load.buyer_name || 'N/A'}</td>
                                  <td className="px-3 py-2 text-sm">{load.bins}</td>
                                  <td className="px-3 py-2 text-sm">{load.grade_display}</td>
                                  <td className="px-3 py-2 text-sm text-green-600">{formatCurrency(load.total_revenue)}</td>
                                  <td className="px-3 py-2 text-sm">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                      load.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                                      load.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {load.payment_status_display}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-500">{load.truck_id || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Labor Records */}
                    {harvest.labor_records && harvest.labor_records.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Labor Records ({harvest.labor_records.length})</p>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Contractor</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Workers</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Hours</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Bins Picked</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Training</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {harvest.labor_records.map(labor => (
                                <tr key={labor.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm">{labor.contractor_name || labor.crew_name}</td>
                                  <td className="px-3 py-2 text-sm">{labor.worker_count}</td>
                                  <td className="px-3 py-2 text-sm">{labor.total_hours || '-'}</td>
                                  <td className="px-3 py-2 text-sm">{labor.bins_picked || '-'}</td>
                                  <td className="px-3 py-2 text-sm">{formatCurrency(labor.total_labor_cost)}</td>
                                  <td className="px-3 py-2 text-sm">
                                    {labor.training_verified ? (
                                      <CheckCircle size={16} className="text-green-600" />
                                    ) : (
                                      <Clock size={16} className="text-gray-400" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Harvests;
