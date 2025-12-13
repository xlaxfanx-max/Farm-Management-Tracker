import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, AlertCircle, CheckCircle, Clock, FileText } from 'lucide-react';
import { waterTestsAPI } from '../services/api';

function WaterTests({ waterSource, onBack, onNewTest, onEditTest }) {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadTests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await waterTestsAPI.getBySource(waterSource.id);
      setTests(response.data.results || response.data);
    } catch (err) {
      setError('Failed to load water tests');
      console.error('Error loading tests:', err);
    } finally {
      setLoading(false);
    }
  }, [waterSource.id]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { label: 'Pending Results', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      'pass': { label: 'Pass', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      'fail': { label: 'Fail - Action Required', color: 'bg-red-100 text-red-800', icon: AlertCircle },
    };
    return badges[status] || badges['pending'];
  };

  const getTestTypeLabel = (type) => {
    const types = {
      'microbial': 'Microbial',
      'chemical': 'Chemical',
      'both': 'Microbial & Chemical',
    };
    return types[type] || type;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Water Sources
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{waterSource.name}</h2>
            <p className="text-slate-600 mt-1">Water Quality Test Records</p>
          </div>
          <button
            onClick={() => onNewTest(waterSource)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            New Test
          </button>
        </div>
      </div>

      {/* Water Source Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-blue-600 font-medium">Source Type</p>
            <p className="text-slate-800">{waterSource.source_type}</p>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Test Frequency</p>
            <p className="text-slate-800">Every {waterSource.test_frequency_days} days</p>
          </div>
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Tests</p>
            <p className="text-slate-800">{tests.length} recorded</p>
          </div>
        </div>
      </div>

      {/* Tests List */}
      {tests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileText size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Test Records</h3>
          <p className="text-slate-600 mb-6">
            Start tracking water quality by adding your first test result.
          </p>
          <button
            onClick={() => onNewTest(waterSource)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add First Test
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tests.map(test => {
            const statusBadge = getStatusBadge(test.status);
            const StatusIcon = statusBadge.icon;

            return (
              <div
                key={test.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onEditTest(test)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">
                          {formatDate(test.test_date)}
                        </h3>
                        <span className="text-sm text-slate-500">
                          {getTestTypeLabel(test.test_type)}
                        </span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.color}`}>
                        <StatusIcon size={14} />
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Test Results */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    {test.ecoli_result !== null && (
                      <div>
                        <p className="text-xs text-slate-500">E. coli</p>
                        <p className="text-sm font-medium text-slate-900">
                          {test.ecoli_result} CFU/100mL
                        </p>
                      </div>
                    )}
                    {test.total_coliform_result !== null && (
                      <div>
                        <p className="text-xs text-slate-500">Total Coliform</p>
                        <p className="text-sm font-medium text-slate-900">
                          {test.total_coliform_result} CFU/100mL
                        </p>
                      </div>
                    )}
                    {test.ph_level !== null && (
                      <div>
                        <p className="text-xs text-slate-500">pH Level</p>
                        <p className="text-sm font-medium text-slate-900">{test.ph_level}</p>
                      </div>
                    )}
                    {test.nitrate_level !== null && (
                      <div>
                        <p className="text-xs text-slate-500">Nitrate</p>
                        <p className="text-sm font-medium text-slate-900">{test.nitrate_level} mg/L</p>
                      </div>
                    )}
                  </div>

                  {/* Lab Info */}
                  {test.lab_name && (
                    <div className="text-sm text-slate-600 mb-2">
                      <span className="font-medium">Lab:</span> {test.lab_name}
                      {test.lab_certification_number && ` (${test.lab_certification_number})`}
                    </div>
                  )}

                  {/* Corrective Actions */}
                  {test.status === 'fail' && test.corrective_actions && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-sm font-medium text-red-800 mb-1">Corrective Actions:</p>
                      <p className="text-sm text-red-700">{test.corrective_actions}</p>
                      {test.retest_date && (
                        <p className="text-xs text-red-600 mt-2">
                          Retest scheduled: {formatDate(test.retest_date)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {test.notes && (
                    <div className="mt-3 text-sm text-slate-600">
                      <span className="font-medium">Notes:</span> {test.notes}
                    </div>
                  )}

                  {/* Recorded By */}
                  {test.recorded_by && (
                    <div className="mt-3 text-xs text-slate-500">
                      Recorded by {test.recorded_by}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WaterTests;