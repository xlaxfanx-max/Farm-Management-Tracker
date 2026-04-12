// =============================================================================
// WELLS & SGMA TAB
// =============================================================================

import React from 'react';
import {
  Droplets, Plus, Search, AlertTriangle, CheckCircle,
  Clock, ChevronDown, ChevronRight, Gauge, Edit, Trash2,
  RefreshCw, AlertCircle, Zap
} from 'lucide-react';
import { MetricCard, AlertBanner, formatDate, formatNumber } from './SharedComponents';
import { GSA_NAMES, BASIN_NAMES, STATUS_COLORS } from './constants';
import WellUsageChart from './WellUsageChart';

const WellsTab = ({
  filteredWells,
  wells,
  sgmaDashboard,
  searchTerm,
  setSearchTerm,
  filterGSA,
  setFilterGSA,
  loading,
  handleRefresh,
  expandedItems,
  toggleExpanded,
  wellReadings,
  loadingReadings,
  deletingReading,
  setDeletingReading,
  deleteWellReading,
  openWellSourceModal,
  openWellReadingModal,
  openBatchReadingModal,
  toast
}) => (
  <div className="space-y-6">
    {/* SGMA Summary Cards */}
    {sgmaDashboard && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Wells"
          value={sgmaDashboard.total_wells}
          subtitle={`${sgmaDashboard.active_wells} active`}
          icon={Droplets}
          color="blue"
        />
        <MetricCard
          title="YTD Extraction"
          value={`${formatNumber(sgmaDashboard.ytd_extraction_af)} AF`}
          subtitle="Acre-feet this year"
          icon={Gauge}
          color="cyan"
        />
        <MetricCard
          title="Allocation Remaining"
          value={`${formatNumber(sgmaDashboard.allocation_remaining_af)} AF`}
          subtitle={`${formatNumber(100 - sgmaDashboard.percent_allocation_used)}% remaining`}
          icon={Droplets}
          color={sgmaDashboard.percent_allocation_used > 80 ? 'red' : 'green'}
        />
        <MetricCard
          title="Calibration Due"
          value={(sgmaDashboard.calibrations_due_soon || 0) + (sgmaDashboard.calibrations_overdue || 0)}
          subtitle={sgmaDashboard.calibrations_overdue > 0 ? `${sgmaDashboard.calibrations_overdue} overdue` : 'All meters current'}
          icon={AlertTriangle}
          color={(sgmaDashboard.calibrations_overdue || 0) > 0 ? 'red' : 'yellow'}
        />
      </div>
    )}

    {/* Alerts */}
    {sgmaDashboard?.alerts?.length > 0 && (
      <div className="space-y-2">
        {sgmaDashboard.alerts.map((alert, idx) => (
          <AlertBanner
            key={idx}
            type={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
            title={alert.message}
            message={alert.action}
          />
        ))}
      </div>
    )}

    {/* Quick Actions Bar */}
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search wells..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {/* GSA Filter */}
        <select
          value={filterGSA}
          onChange={(e) => setFilterGSA(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-gray-700 dark:text-gray-200"
        >
          <option value="">All GSAs</option>
          {Object.entries(GSA_NAMES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Batch Reading Button */}
        <button
          onClick={() => {
            if (filteredWells.length > 0) openBatchReadingModal(filteredWells);
            else toast.info('No wells available for batch reading');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
        >
          <Gauge className="w-5 h-5" />
          Batch Readings
        </button>

        {/* Refresh */}
        <button onClick={handleRefresh} className="p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
          <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>

    {/* Reading Status Summary */}
    {filteredWells.length > 0 && (() => {
      const now = new Date();
      const wellsNeedingReading = filteredWells.filter(w => {
        if (!w.latest_reading?.date) return true;
        const lastDate = new Date(w.latest_reading.date);
        const daysSince = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
        return daysSince > 30;
      });
      const wellsOverdue = filteredWells.filter(w => {
        if (!w.latest_reading?.date) return true;
        const lastDate = new Date(w.latest_reading.date);
        const daysSince = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
        return daysSince > 90;
      });

      if (wellsNeedingReading.length === 0) return null;

      return (
        <div className={`rounded-xl p-4 flex items-center justify-between ${
          wellsOverdue.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <Clock className={`w-5 h-5 ${wellsOverdue.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`font-medium ${wellsOverdue.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                {wellsOverdue.length > 0
                  ? `${wellsOverdue.length} well${wellsOverdue.length > 1 ? 's' : ''} overdue for reading (90+ days)`
                  : `${wellsNeedingReading.length} well${wellsNeedingReading.length > 1 ? 's' : ''} due for reading (30+ days)`
                }
              </p>
              <p className={`text-sm ${wellsOverdue.length > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                {wellsNeedingReading.map(w => w.well_name || w.name).slice(0, 3).join(', ')}
                {wellsNeedingReading.length > 3 && ` +${wellsNeedingReading.length - 3} more`}
              </p>
            </div>
          </div>
          <button
            onClick={() => openBatchReadingModal(wellsNeedingReading)}
            className={`px-4 py-2 rounded-lg font-medium ${
              wellsOverdue.length > 0
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            Record Readings
          </button>
        </div>
      );
    })()}

    {/* Wells List */}
    {filteredWells.length === 0 ? (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No wells found</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Add a well to track groundwater extraction and SGMA compliance.</p>
        <button
          onClick={() => openWellSourceModal()}
          className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
        >
          <Plus className="w-5 h-5" />
          Add Well
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {filteredWells.map(well => (
          <div key={well.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all">
            {/* Well Header */}
            <div
              className="p-4 cursor-pointer"
              onClick={() => toggleExpanded(well.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${well.calibration_due_soon || !well.meter_calibration_current ? 'bg-amber-100' : 'bg-cyan-100'}`}>
                    <Droplets className={`w-6 h-6 ${well.calibration_due_soon || !well.meter_calibration_current ? 'text-amber-600' : 'text-cyan-600'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{well.well_name || well.water_source_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{well.farm_name} • {GSA_NAMES[well.gsa] || well.gsa}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Reading Status Badge */}
                  {(() => {
                    if (!well.latest_reading?.date) {
                      return (
                        <span className="flex items-center gap-1.5 text-gray-600 text-xs bg-gray-100 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3.5 h-3.5" />
                          No readings
                        </span>
                      );
                    }
                    const lastDate = new Date(well.latest_reading.date);
                    const daysSince = Math.ceil((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                    if (daysSince > 90) {
                      return (
                        <span className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-2.5 py-1 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {daysSince}d ago
                        </span>
                      );
                    }
                    if (daysSince > 30) {
                      return (
                        <span className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          {daysSince}d ago
                        </span>
                      );
                    }
                    return (
                      <span className="flex items-center gap-1.5 text-primary text-xs bg-primary-light px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {daysSince}d ago
                      </span>
                    );
                  })()}

                  {well.calibration_due_soon && (
                    <span className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 px-2.5 py-1 rounded-full">
                      <Zap className="w-3.5 h-3.5" />
                      Cal. Due
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">YTD Extraction</p>
                    <p className="font-semibold text-cyan-600 dark:text-cyan-400">{formatNumber(well.ytd_extraction_af, 2)} AF</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[well.status] || 'bg-gray-100'}`}>
                    {well.status}
                  </span>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openWellReadingModal(well.id, well.well_name)}
                      className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                      title="Add Reading"
                    >
                      <Gauge className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openWellSourceModal(well)}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  </div>
                  {expandedItems[well.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedItems[well.id] && (
              <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Well Info</h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">State Well #:</dt>
                        <dd className="text-gray-900 font-medium text-xs">{well.state_well_number || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Basin:</dt>
                        <dd className="text-gray-900 dark:text-gray-200 font-medium">{BASIN_NAMES[well.basin] || well.basin || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500 dark:text-gray-400">Meter Units:</dt>
                        <dd className="text-gray-900 dark:text-gray-200 font-medium">{well.flowmeter_units || '-'}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Fee Rates</h4>
                    <dl className="space-y-2 text-sm">
                      {well.base_extraction_rate && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Base Rate:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.base_extraction_rate).toFixed(2)}/AF</dd>
                        </div>
                      )}
                      {well.gsp_rate && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">GSP Rate:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.gsp_rate).toFixed(2)}/AF</dd>
                        </div>
                      )}
                      {well.domestic_rate && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Domestic:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.domestic_rate).toFixed(2)}/AF</dd>
                        </div>
                      )}
                      {well.fixed_quarterly_fee && (
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Fixed/Qtr:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.fixed_quarterly_fee).toFixed(2)}</dd>
                        </div>
                      )}
                      {!well.base_extraction_rate && !well.gsp_rate && !well.domestic_rate && (
                        <p className="text-gray-400 italic">No rates configured</p>
                      )}
                    </dl>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">YTD Costs</h4>
                    {well.ytd_extraction_af > 0 && (well.base_extraction_rate || well.gsp_rate) ? (
                      <dl className="space-y-2 text-sm">
                        {well.base_extraction_rate && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Base Fee:</dt>
                            <dd className="text-primary font-medium">
                              ${(parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.base_extraction_rate)).toFixed(2)}
                            </dd>
                          </div>
                        )}
                        {well.gsp_rate && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">GSP Fee:</dt>
                            <dd className="text-primary font-medium">
                              ${(parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.gsp_rate)).toFixed(2)}
                            </dd>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-gray-200">
                          <dt className="text-gray-700 font-medium">Est. Total:</dt>
                          <dd className="text-primary font-bold">
                            ${(
                              (parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.base_extraction_rate || 0)) +
                              (parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.gsp_rate || 0))
                            ).toFixed(2)}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No extraction or rates</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Latest Reading</h4>
                    {well.latest_reading ? (
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Date:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">{formatDate(well.latest_reading.date)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Reading:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">{well.latest_reading.meter_reading}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No readings recorded</p>
                    )}
                  </div>
                </div>

                {/* Extraction History Chart */}
                {!loadingReadings[well.id] && (
                  <WellUsageChart readings={wellReadings[well.id]} />
                )}

                {/* Reading History */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Reading History</h4>
                    <button
                      onClick={() => openWellReadingModal(well.id, well.well_name)}
                      className="flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Reading
                    </button>
                  </div>

                  {loadingReadings[well.id] ? (
                    <div className="flex items-center justify-center py-6 text-gray-400">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                      Loading readings...
                    </div>
                  ) : wellReadings[well.id]?.length > 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">
                            <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Meter Reading</th>
                            <th className="px-4 py-2.5 text-right font-semibold">Extraction (AF)</th>
                            <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                            <th className="px-4 py-2.5 text-left font-semibold">Recorded By</th>
                            <th className="px-4 py-2.5 text-center font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {wellReadings[well.id].map((reading) => (
                            <tr key={reading.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200">{formatDate(reading.reading_date)}</td>
                              <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-gray-200">{Number(reading.meter_reading).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right text-cyan-700 dark:text-cyan-400 font-medium">
                                {reading.extraction_acre_feet != null ? formatNumber(reading.extraction_acre_feet, 4) : '-'}
                              </td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{reading.reading_type_display || reading.reading_type}</td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{reading.recorded_by || '-'}</td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => openWellReadingModal(well.id, well.well_name, reading)}
                                    className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                    title="Edit Reading"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  {deletingReading === reading.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => deleteWellReading(reading.id, well.id)}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setDeletingReading(null)}
                                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingReading(reading.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete Reading"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No readings recorded for this well</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default WellsTab;
