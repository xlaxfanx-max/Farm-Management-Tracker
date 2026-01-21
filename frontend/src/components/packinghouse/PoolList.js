// =============================================================================
// POOL LIST COMPONENT
// List and manage pools with filtering
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  Truck,
  FileText,
  DollarSign,
  Eye
} from 'lucide-react';
import { poolsAPI, packinghousesAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';
import PoolModal from './PoolModal';
import PoolDetail from './PoolDetail';

const PoolList = () => {
  const [pools, setPools] = useState([]);
  const [packinghouses, setPackinghouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPool, setEditingPool] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [filters, setFilters] = useState({
    packinghouse: '',
    status: '',
    season: PACKINGHOUSE_CONSTANTS.getCurrentSeason(),
    commodity: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPools();
    fetchPackinghouses();
  }, [filters]);

  const fetchPools = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.packinghouse) params.packinghouse = filters.packinghouse;
      if (filters.status) params.status = filters.status;
      if (filters.season) params.season = filters.season;
      if (filters.commodity) params.commodity = filters.commodity;

      const response = await poolsAPI.getAll(params);
      setPools(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackinghouses = async () => {
    try {
      const response = await packinghousesAPI.getAll({ is_active: true });
      setPackinghouses(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching packinghouses:', error);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete pool "${name}"?`)) {
      try {
        await poolsAPI.delete(id);
        fetchPools();
      } catch (error) {
        console.error('Error deleting pool:', error);
        alert('Failed to delete pool. It may have associated deliveries or reports.');
      }
    }
  };

  const handleEdit = (pool) => {
    setEditingPool(pool);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPool(null);
    setShowModal(true);
  };

  const handleView = (pool) => {
    setSelectedPool(pool);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingPool(null);
  };

  const handleSave = () => {
    fetchPools();
    handleModalClose();
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      closed: 'bg-yellow-100 text-yellow-800',
      settled: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // If viewing a specific pool
  if (selectedPool) {
    return (
      <PoolDetail
        pool={selectedPool}
        onBack={() => setSelectedPool(null)}
        onEdit={() => {
          setEditingPool(selectedPool);
          setShowModal(true);
        }}
        onRefresh={() => {
          fetchPools();
          // Refresh the selected pool data
          poolsAPI.get(selectedPool.id).then(res => setSelectedPool(res.data));
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 border rounded-lg transition-colors ${
              showFilters ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <button
            onClick={fetchPools}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Pool
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Packinghouse
            </label>
            <select
              value={filters.packinghouse}
              onChange={(e) => setFilters(prev => ({ ...prev, packinghouse: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Packinghouses</option>
              {packinghouses.map(ph => (
                <option key={ph.id} value={ph.id}>{ph.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Season
            </label>
            <input
              type="text"
              value={filters.season}
              onChange={(e) => setFilters(prev => ({ ...prev, season: e.target.value }))}
              placeholder="e.g., 2024-2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Statuses</option>
              {PACKINGHOUSE_CONSTANTS.poolStatuses.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commodity
            </label>
            <select
              value={filters.commodity}
              onChange={(e) => setFilters(prev => ({ ...prev, commodity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Commodities</option>
              {PACKINGHOUSE_CONSTANTS.commodities.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* List */}
      {pools.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Boxes className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Pools Found</h3>
          <p className="text-gray-500 mb-4">
            No pools match your current filters.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pool
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pool
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Packinghouse
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commodity
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Season
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bins
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pools.map((pool) => (
                <tr key={pool.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{pool.name}</p>
                      <p className="text-xs text-gray-500">{pool.pool_id}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{pool.packinghouse_name}</p>
                    {pool.packinghouse_short_code && (
                      <span className="text-xs text-gray-500">{pool.packinghouse_short_code}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">{pool.commodity}</p>
                    {pool.variety && (
                      <p className="text-xs text-gray-500">{pool.variety}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {pool.season}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-900">{pool.total_bins || 0}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({pool.delivery_count || 0})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(pool.status)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end space-x-1">
                      <button
                        onClick={() => handleView(pool)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(pool)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(pool.id, pool.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PoolModal
          pool={editingPool}
          packinghouses={packinghouses}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default PoolList;
