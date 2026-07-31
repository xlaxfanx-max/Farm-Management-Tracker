import React from 'react';
import { Wheat, Package, DollarSign, Users, Clock } from 'lucide-react';
import { formatCurrency, formatNumber } from './harvestUtils';

const HarvestStatistics = ({ statistics, unitLabel, openDrillDown }) => {
  if (!statistics) return null;

  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('total_harvests')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Wheat className="text-orange-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Total Harvests</p>
            <p className="text-xl font-bold">{statistics.total_harvests}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('total_bins')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Package className="text-link" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Total {unitLabel}</p>
            <p className="text-xl font-bold">{formatNumber(statistics.primary_quantity ?? statistics.total_bins)}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('total_revenue')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="text-primary" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Total Revenue</p>
            <p className="text-xl font-bold">{formatCurrency(statistics.total_revenue)}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('labor_cost')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sand-200 rounded-lg">
            <Users className="text-bark-700" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Labor Cost</p>
            <p className="text-xl font-bold">{formatCurrency(statistics.total_labor_cost)}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('pending_payments')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <Clock className="text-yellow-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Pending Payments</p>
            <p className="text-xl font-bold">{formatCurrency(statistics.pending_payments)}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('yield_per_acre')}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Wheat className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-bark-600">Yield/Acre</p>
            <p className="text-xl font-bold">{statistics.avg_yield_per_acre?.toFixed(1) || '0'} {unitLabel.toLowerCase()}</p>
          </div>
        </div>
        <p className="text-xs text-text-muted mt-2">Click for details</p>
      </div>
    </div>
  );
};

export default HarvestStatistics;
