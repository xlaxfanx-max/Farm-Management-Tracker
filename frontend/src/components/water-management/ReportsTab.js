// =============================================================================
// REPORTS TAB
// =============================================================================

import React from 'react';
import { Calendar, Gauge, BarChart3 } from 'lucide-react';
import { formatDate, formatNumber } from './SharedComponents';
import { GSA_NAMES } from './constants';

const ReportsTab = ({ sgmaDashboard }) => (
  <div className="space-y-6">
    {sgmaDashboard ? (
      <>
        {/* SGMA Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">SGMA Compliance Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Water Year</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sgmaDashboard.water_year}</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Period</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sgmaDashboard.current_period}</p>
            </div>
            <div className="text-center p-4 bg-cyan-50 rounded-xl">
              <p className="text-sm text-cyan-600 mb-1">YTD Extraction</p>
              <p className="text-2xl font-bold text-cyan-700">{formatNumber(sgmaDashboard.ytd_extraction_af, 2)} AF</p>
            </div>
            <div className={`text-center p-4 rounded-xl ${sgmaDashboard.percent_allocation_used > 80 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-sm mb-1 ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-600' : 'text-primary'}`}>Allocation Used</p>
              <p className={`text-2xl font-bold ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-700' : 'text-primary'}`}>
                {formatNumber(sgmaDashboard.percent_allocation_used)}%
              </p>
            </div>
          </div>
        </div>

        {/* Allocation Progress & Cost Estimate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation Progress</h3>
            {/* Monthly Rate Indicator */}
            {sgmaDashboard.ytd_extraction_af > 0 && (() => {
              const now = new Date();
              const waterYearStart = now.getMonth() >= 9
                ? new Date(now.getFullYear(), 9, 1)
                : new Date(now.getFullYear() - 1, 9, 1);
              const monthsElapsed = Math.max(1, Math.ceil((now - waterYearStart) / (1000 * 60 * 60 * 24 * 30)));
              const monthlyRate = sgmaDashboard.ytd_extraction_af / monthsElapsed;

              return (
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Avg</p>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatNumber(monthlyRate, 1)} AF/mo</p>
                </div>
              );
            })()}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatNumber(sgmaDashboard.ytd_extraction_af, 2)} AF used of {formatNumber(sgmaDashboard.total_allocation_af, 2)} AF
              </span>
              <span className={`text-sm font-semibold ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-600' : 'text-primary'}`}>
                {formatNumber(sgmaDashboard.allocation_remaining_af, 2)} AF remaining
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${
                  sgmaDashboard.percent_allocation_used > 95 ? 'bg-red-500' :
                  sgmaDashboard.percent_allocation_used > 80 ? 'bg-amber-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(sgmaDashboard.percent_allocation_used, 100)}%` }}
              />
            </div>

            {/* Projected end-of-year usage indicator */}
            {sgmaDashboard.ytd_extraction_af > 0 && sgmaDashboard.total_allocation_af > 0 && (() => {
              const now = new Date();
              const waterYearStart = now.getMonth() >= 9
                ? new Date(now.getFullYear(), 9, 1)
                : new Date(now.getFullYear() - 1, 9, 1);
              const waterYearEnd = new Date(waterYearStart.getFullYear() + 1, 8, 30);
              const totalDays = (waterYearEnd - waterYearStart) / (1000 * 60 * 60 * 24);
              const daysElapsed = Math.max(1, (now - waterYearStart) / (1000 * 60 * 60 * 24));
              const projectedTotal = (sgmaDashboard.ytd_extraction_af / daysElapsed) * totalDays;
              const projectedPercent = (projectedTotal / sgmaDashboard.total_allocation_af) * 100;

              return (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Projected Year-End Usage:</span>
                    <span className={`font-semibold ${projectedPercent > 100 ? 'text-red-600' : projectedPercent > 90 ? 'text-amber-600' : 'text-primary'}`}>
                      {formatNumber(projectedTotal, 1)} AF ({formatNumber(projectedPercent, 0)}%)
                    </span>
                  </div>
                  {projectedPercent > 100 && (
                    <p className="text-xs text-red-600 mt-1">
                      At current rate, you may exceed allocation by {formatNumber(projectedTotal - sgmaDashboard.total_allocation_af, 1)} AF
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Estimated Fees Summary */}
          {sgmaDashboard.wells_by_gsa?.length > 0 && (() => {
            let totalEstFees = 0;
            const feesByGSA = sgmaDashboard.wells_by_gsa.map(gsa => {
              // Use approximate GSA rates
              const rates = {
                'obgma': { base: 25, gsp: 100 },
                'uwcd': { base: 192.34, gsp: 0 },
                'fpbgsa': { base: 75, gsp: 50 },
                'default': { base: 100, gsp: 0 }
              };
              const gsaRates = rates[gsa.gsa?.toLowerCase()] || rates.default;
              const estFee = gsa.ytd_extraction * (gsaRates.base + gsaRates.gsp);
              totalEstFees += estFee;
              return { gsa: gsa.gsa, extraction: gsa.ytd_extraction, fee: estFee, rates: gsaRates };
            });

            if (totalEstFees === 0) return null;

            return (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Estimated YTD Fees</h4>
                <div className="space-y-2">
                  {feesByGSA.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {GSA_NAMES[item.gsa] || item.gsa} ({formatNumber(item.extraction, 1)} AF)
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-200">${formatNumber(item.fee, 2)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total Estimated</span>
                    <span className="font-bold text-primary">${formatNumber(totalEstFees, 2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  * Estimates based on default GSA rates. Actual fees may vary.
                </p>
              </div>
            );
          })()}
        </div>

        {/* Deadlines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Upcoming Deadlines</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                <Calendar className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-600">Next Report Due</p>
                  <p className="font-semibold text-blue-900">{formatDate(sgmaDashboard.next_report_due)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                <Gauge className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-sm text-amber-600">Next Calibration Due</p>
                  <p className="font-semibold text-amber-900">{formatDate(sgmaDashboard.next_calibration_due)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Wells by GSA */}
          {sgmaDashboard.wells_by_gsa?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Wells by GSA</h3>
              <div className="space-y-3">
                {sgmaDashboard.wells_by_gsa.map((gsa, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{GSA_NAMES[gsa.gsa] || gsa.gsa}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{gsa.active} active of {gsa.count} wells</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-cyan-600 dark:text-cyan-400">{formatNumber(gsa.ytd_extraction, 2)} AF</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">YTD</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No report data available</h3>
        <p className="text-gray-500 dark:text-gray-400">Add wells and meter readings to see SGMA compliance reports.</p>
      </div>
    )}
  </div>
);

export default ReportsTab;
