// =============================================================================
// WATER TESTS TAB
// =============================================================================

import React from 'react';
import {
  Plus, CheckCircle, Clock, Droplet, ArrowLeft,
  AlertCircle, FileText
} from 'lucide-react';
import { SOURCE_TYPE_LABELS, TEST_STATUS_CONFIG } from './constants';
import { formatDate } from './SharedComponents';

const WaterTestsTab = ({
  waterSources,
  waterTests,
  selectedSource,
  setSelectedSource,
  openWaterTestModal
}) => (
  <div className="space-y-6">
    {/* Source Selector */}
    {selectedSource ? (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSource(null)}
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-blue-600" />
            </button>
            <div>
              <h3 className="font-semibold text-blue-900">{selectedSource.name}</h3>
              <p className="text-sm text-blue-700">
                {SOURCE_TYPE_LABELS[selectedSource.source_type]} • Tests every {selectedSource.test_frequency_days || 365} days
              </p>
            </div>
          </div>
          <button
            onClick={() => openWaterTestModal(null, selectedSource)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Test
          </button>
        </div>
      </div>
    ) : (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Select a water source to view tests</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {waterSources.map(source => (
            <button
              key={source.id}
              onClick={() => setSelectedSource(source)}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
            >
              <div className={`p-2 rounded-lg ${source.source_type === 'well' ? 'bg-cyan-100' : 'bg-blue-100'}`}>
                <Droplet className={`w-4 h-4 ${source.source_type === 'well' ? 'text-cyan-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{SOURCE_TYPE_LABELS[source.source_type]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Tests List */}
    {selectedSource && (
      waterTests.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No test records</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Start tracking water quality by adding your first test result.</p>
          <button
            onClick={() => openWaterTestModal(null, selectedSource)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add First Test
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {waterTests.map(test => {
            const statusConfig = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.pending;
            const StatusIcon = test.status === 'pass' ? CheckCircle : test.status === 'fail' ? AlertCircle : Clock;

            return (
              <div
                key={test.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer overflow-hidden"
                onClick={() => openWaterTestModal(test)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{formatDate(test.test_date)}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {test.test_type === 'microbial' ? 'Microbial' :
                         test.test_type === 'chemical' ? 'Chemical' : 'Microbial & Chemical'}
                      </span>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {test.ecoli_result !== null && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                        <p className="text-gray-500 dark:text-gray-400 text-xs">E. coli</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{test.ecoli_result} CFU/100mL</p>
                      </div>
                    )}
                    {test.ph_level !== null && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                        <p className="text-gray-500 dark:text-gray-400 text-xs">pH Level</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{test.ph_level}</p>
                      </div>
                    )}
                  </div>

                  {test.status === 'fail' && test.corrective_actions && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                      <p className="font-medium text-red-800 text-xs uppercase tracking-wider mb-1">Corrective Actions</p>
                      <p className="text-red-700">{test.corrective_actions}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )
    )}
  </div>
);

export default WaterTestsTab;
