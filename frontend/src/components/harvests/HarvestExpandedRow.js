import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Truck,
  Users,
  Edit,
  Trash2
} from 'lucide-react';
import { formatCurrency } from './harvestUtils';

const HarvestExpandedRow = ({
  harvest,
  openHarvestLoadModal,
  openHarvestLaborModal,
  openHarvestModal,
  handleMarkComplete,
  handleMarkVerified,
  handleDelete
}) => {
  return (
    <div className="mt-4 ml-10 space-y-4">
      {/* PHI Warning Banner */}
      {harvest.phi_compliant === false && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-3">
          <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">PHI Compliance Warning</p>
            <p className="text-sm text-red-600 dark:text-red-300">
              Only {harvest.days_since_last_application} days since last application
              of {harvest.last_application_product}. Required: {harvest.phi_required_days} days.
            </p>
          </div>
        </div>
      )}

      {/* Bins Reconciliation Widget */}
      {harvest.bins_reconciliation_status && (
        <BinsReconciliation harvest={harvest} />
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); openHarvestLoadModal(harvest.id); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
        >
          <Truck size={16} /> Add Load
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); openHarvestLaborModal(harvest.id); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
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
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-light text-primary rounded-lg hover:bg-green-100"
          >
            <CheckCircle size={16} /> Verify (GAP/GHP)
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); openHarvestModal(harvest); }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
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
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">GAP/GHP Compliance</p>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            {harvest.phi_verified ? (
              <CheckCircle size={16} className="text-primary" />
            ) : (
              <Clock size={16} className="text-gray-400" />
            )}
            <span>PHI Verified</span>
          </div>
          <div className="flex items-center gap-2">
            {harvest.equipment_cleaned ? (
              <CheckCircle size={16} className="text-primary" />
            ) : (
              <Clock size={16} className="text-gray-400" />
            )}
            <span>Equipment Cleaned</span>
          </div>
          <div className="flex items-center gap-2">
            {harvest.no_contamination_observed ? (
              <CheckCircle size={16} className="text-primary" />
            ) : (
              <Clock size={16} className="text-gray-400" />
            )}
            <span>No Contamination</span>
          </div>
          <div className="flex items-center gap-2">
            {harvest.supervisor_name ? (
              <CheckCircle size={16} className="text-primary" />
            ) : (
              <Clock size={16} className="text-gray-400" />
            )}
            <span>Supervisor: {harvest.supervisor_name || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Loads Table */}
      {harvest.loads && harvest.loads.length > 0 && (
        <LoadsTable harvest={harvest} openHarvestLoadModal={openHarvestLoadModal} />
      )}

      {/* Labor Records */}
      {harvest.labor_records && harvest.labor_records.length > 0 && (
        <LaborTable harvest={harvest} openHarvestLaborModal={openHarvestLaborModal} />
      )}
    </div>
  );
};

const BinsReconciliation = ({ harvest }) => {
  const recon = harvest.bins_reconciliation_status;
  const totalHarvestBins = recon.total_harvest_bins;
  const unitLabelLocal = harvest.primary_unit_label || 'bins';

  const getStatusBadge = (status) => {
    if (status === 'match') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">&#10003; Complete</span>;
    if (status === 'under') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Partial</span>;
    if (status === 'over') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Over</span>;
    return null;
  };

  const getBarColor = (status) => {
    if (status === 'match') return 'bg-green-500';
    if (status === 'over') return 'bg-red-500';
    return 'bg-yellow-500';
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
      <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">{harvest.primary_unit_label || 'Bin'} Tracking</p>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Total Harvest</p>
          <p className="text-lg font-semibold text-gray-900">
            {harvest.primary_quantity ?? totalHarvestBins} {unitLabelLocal.toLowerCase()}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-600">In Loads</p>
            {getStatusBadge(recon.loads_status)}
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {recon.total_load_bins} {unitLabelLocal.toLowerCase()}
          </p>
          {recon.loads_message && (
            <p className="text-xs text-gray-500 mt-1">{recon.loads_message}</p>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-gray-600">In Labor</p>
            {getStatusBadge(recon.labor_status)}
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {recon.total_labor_bins} {unitLabelLocal.toLowerCase()}
          </p>
          {recon.labor_message && (
            <p className="text-xs text-gray-500 mt-1">{recon.labor_message}</p>
          )}
        </div>
      </div>

      {/* Progress Bars */}
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Loads Progress</span>
            <span>{Math.round((recon.total_load_bins / totalHarvestBins) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getBarColor(recon.loads_status)}`}
              style={{ width: `${Math.min((recon.total_load_bins / totalHarvestBins) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Labor Progress</span>
            <span>{Math.round((recon.total_labor_bins / totalHarvestBins) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${getBarColor(recon.labor_status)}`}
              style={{ width: `${Math.min((recon.total_labor_bins / totalHarvestBins) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadsTable = ({ harvest, openHarvestLoadModal }) => (
  <div>
    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Loads ({harvest.loads.length})</p>
    <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">#</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Buyer</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Bins</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Grade</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Payment</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Truck</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {harvest.loads.map(load => (
            <tr key={load.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-3 py-2 text-sm">{load.load_number}</td>
              <td className="px-3 py-2 text-sm">{load.buyer_name || 'N/A'}</td>
              <td className="px-3 py-2 text-sm">{load.bins}</td>
              <td className="px-3 py-2 text-sm">{load.grade_display}</td>
              <td className="px-3 py-2 text-sm text-primary">{formatCurrency(load.total_revenue)}</td>
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
              <td className="px-3 py-2 text-sm">
                <button
                  onClick={() => openHarvestLoadModal(harvest.id, load)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit load"
                >
                  <Edit size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const LaborTable = ({ harvest, openHarvestLaborModal }) => (
  <div>
    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Labor Records ({harvest.labor_records.length})</p>
    <div className="border dark:border-gray-600 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Contractor</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Workers</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Hours</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Bins Picked</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Training</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {harvest.labor_records.map(labor => (
            <tr key={labor.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="px-3 py-2 text-sm">{labor.contractor_name || labor.crew_name}</td>
              <td className="px-3 py-2 text-sm">{labor.worker_count}</td>
              <td className="px-3 py-2 text-sm">{labor.total_hours || '-'}</td>
              <td className="px-3 py-2 text-sm">{labor.bins_picked || '-'}</td>
              <td className="px-3 py-2 text-sm">{formatCurrency(labor.total_labor_cost)}</td>
              <td className="px-3 py-2 text-sm">
                {labor.training_verified ? (
                  <CheckCircle size={16} className="text-primary" />
                ) : (
                  <Clock size={16} className="text-gray-400" />
                )}
              </td>
              <td className="px-3 py-2 text-sm">
                <button
                  onClick={() => openHarvestLaborModal(harvest.id, labor)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit labor record"
                >
                  <Edit size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default HarvestExpandedRow;
