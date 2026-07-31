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
      <div className="bg-cream-100 border border-orange-200 rounded-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSource(null)}
              className="p-2 hover:bg-surface-raised rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-link" />
            </button>
            <div>
              <h3 className=" text-orange-700">{selectedSource.name}</h3>
              <p className="text-sm text-orange-700">
                {SOURCE_TYPE_LABELS[selectedSource.source_type]} • Tests every {selectedSource.test_frequency_days || 365} days
              </p>
            </div>
          </div>
          <button
            onClick={() => openWaterTestModal(null, selectedSource)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            <Plus className="w-5 h-5" />
            Add Test
          </button>
        </div>
      </div>
    ) : (
      <div className="bg-surface-raised rounded-card border border-border p-5">
        <h3 className=" text-bark-700 mb-3">Select a water source to view tests</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {waterSources.map(source => (
            <button
              key={source.id}
              onClick={() => setSelectedSource(source)}
              className="flex items-center gap-3 p-3 border border-border rounded-button hover:border-orange-300 hover:bg-orange-50 transition-all text-left"
            >
              <div className={`p-2 rounded-lg ${source.source_type === 'well' ? 'bg-green-100' : 'bg-orange-100'}`}>
                <Droplet className={`w-4 h-4 ${source.source_type === 'well' ? 'text-green-600' : 'text-link'}`} />
              </div>
              <div>
                <p className="font-medium text-heading">{source.name}</p>
                <p className="text-sm text-text-secondary">{SOURCE_TYPE_LABELS[source.source_type]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Tests List */}
    {selectedSource && (
      waterTests.length === 0 ? (
        <div className="bg-surface-raised rounded-card border border-border p-12 text-center">
          <FileText className="w-12 h-12 text-sand-300 mx-auto mb-4" />
          <h3 className="text-lg text-heading mb-2">No test records</h3>
          <p className="text-text-secondary mb-6">Start tracking water quality by adding your first test result.</p>
          <button
            onClick={() => openWaterTestModal(null, selectedSource)}
            className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover"
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
                className="bg-surface-raised rounded-card border border-border hover:border-border-strong hover:shadow-sm transition-all cursor-pointer overflow-hidden"
                onClick={() => openWaterTestModal(test)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className=" text-heading">{formatDate(test.test_date)}</h3>
                      <span className="text-sm text-text-secondary">
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
                      <div className="bg-cream-50 rounded-lg p-2">
                        <p className="text-text-secondary text-xs">E. coli</p>
                        <p className="font-semibold text-heading">{test.ecoli_result} CFU/100mL</p>
                      </div>
                    )}
                    {test.ph_level !== null && (
                      <div className="bg-cream-50 rounded-lg p-2">
                        <p className="text-text-secondary text-xs">pH Level</p>
                        <p className="font-semibold text-heading">{test.ph_level}</p>
                      </div>
                    )}
                  </div>

                  {test.status === 'fail' && test.corrective_actions && (
                    <div className="mt-3 p-3 bg-danger-bg border border-danger/20 rounded-card text-sm">
                      <p className="font-medium text-danger text-xs uppercase tracking-wider mb-1">Corrective Actions</p>
                      <p className="text-danger">{test.corrective_actions}</p>
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
