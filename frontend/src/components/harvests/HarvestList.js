import React from 'react';
import { Wheat, ChevronDown, ChevronRight, Calendar, Plus } from 'lucide-react';
import { formatCurrency, formatNumber, getStatusBadge } from './harvestUtils';
import HarvestExpandedRow from './HarvestExpandedRow';

const HarvestList = ({
  harvests,
  loading,
  expandedHarvests,
  toggleExpand,
  openHarvestModal,
  openHarvestLoadModal,
  openHarvestLaborModal,
  handleMarkComplete,
  handleMarkVerified,
  handleDelete
}) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading harvests...</div>
      </div>
    );
  }

  if (harvests.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <Wheat size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p>No harvests found</p>
          <button
            onClick={() => openHarvestModal(null,)}
            className="mt-4 text-orange-600 hover:text-orange-700"
          >
            Record your first harvest
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="divide-y dark:divide-gray-700">
        {harvests.map(harvest => (
          <div key={harvest.id} className="p-4">
            {/* Harvest Header */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleExpand(harvest.id)}
            >
              <div className="flex items-center gap-4">
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  {expandedHarvests[harvest.id] ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium dark:text-gray-200">{harvest.field_name}</span>
                    <span className="text-gray-400 dark:text-gray-500">&bull;</span>
                    <span className="text-gray-600 dark:text-gray-300">{harvest.farm_name}</span>
                    <span className="text-gray-400 dark:text-gray-500">&bull;</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Pick #{harvest.harvest_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(harvest.harvest_date).toLocaleDateString()}
                    </span>
                    <span>{harvest.crop_variety_display}</span>
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                      {harvest.lot_number}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-medium">{formatNumber(harvest.primary_quantity ?? harvest.total_bins)} {(harvest.primary_unit_label || 'bins').toLowerCase()}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{harvest.acres_harvested} acres</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-primary dark:text-green-400">
                    {formatCurrency(harvest.total_revenue)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{harvest.load_count} loads</p>
                </div>
                {getStatusBadge(harvest.status, harvest.phi_compliant)}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedHarvests[harvest.id] && (
              <HarvestExpandedRow
                harvest={harvest}
                openHarvestLoadModal={openHarvestLoadModal}
                openHarvestLaborModal={openHarvestLaborModal}
                openHarvestModal={openHarvestModal}
                handleMarkComplete={handleMarkComplete}
                handleMarkVerified={handleMarkVerified}
                handleDelete={handleDelete}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HarvestList;
