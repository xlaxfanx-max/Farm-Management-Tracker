import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, ChevronRight, CheckCircle2, Clock,
  AlertTriangle, Package, Truck, XCircle,
} from 'lucide-react';
import { traceabilityAPI } from '../../../services/api';

const STATUS_COLORS = {
  harvested: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_transit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  received: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  packout_complete: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  distributed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  recalled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  destroyed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const LotList = ({ onViewLot }) => {
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadLots = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await traceabilityAPI.getLots(params);
      setLots(data.results || data);
    } catch (err) {
      console.error('Failed to load lots:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(loadLots, 300);
    return () => clearTimeout(timer);
  }, [loadLots]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Traceability Lots
      </h2>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search lot number, product, commodity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
        >
          <option value="">All Statuses</option>
          <option value="harvested">Harvested</option>
          <option value="in_transit">In Transit</option>
          <option value="received">Received</option>
          <option value="processing">Processing</option>
          <option value="packout_complete">Packout Complete</option>
          <option value="distributed">Distributed</option>
          <option value="recalled">Recalled</option>
        </select>
      </div>

      {/* Lot Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading lots...</div>
      ) : lots.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium">No traceability lots found</p>
          <p className="text-sm mt-1">Link a harvest record to create your first lot</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Lot Number</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Field</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Qty</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">PHI</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">CTEs</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {lots.map((lot) => (
                  <tr
                    key={lot.id}
                    onClick={() => onViewLot(lot.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900 dark:text-white">
                      {lot.lot_number}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {lot.product_description}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lot.field_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lot.harvest_date}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lot.quantity_bins ? `${lot.quantity_bins} bins` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lot.status] || STATUS_COLORS.harvested}`}>
                        {lot.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lot.phi_compliant === true ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : lot.phi_compliant === false ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {lot.event_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotList;
