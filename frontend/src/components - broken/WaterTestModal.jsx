import React, { useState, useEffect } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';

function WaterTestModal({ test, waterSource, onClose, onSave }) {
  const [formData, setFormData] = useState({
    water_source: '',
    test_date: '',
    test_type: 'microbial',
    lab_name: '',
    lab_certification_number: '',
    ecoli_result: '',
    total_coliform_result: '',
    ph_level: '',
    nitrate_level: '',
    status: 'pending',
    corrective_actions: '',
    retest_date: '',
    notes: '',
    recorded_by: '',
  });

  const [errors, setErrors] = useState({});
  const [autoStatus, setAutoStatus] = useState(null);

  useEffect(() => {
    if (test) {
      setFormData({
        water_source: test.water_source || '',
        test_date: test.test_date || '',
        test_type: test.test_type || 'microbial',
        lab_name: test.lab_name || '',
        lab_certification_number: test.lab_certification_number || '',
        ecoli_result: test.ecoli_result !== null ? test.ecoli_result : '',
        total_coliform_result: test.total_coliform_result !== null ? test.total_coliform_result : '',
        ph_level: test.ph_level !== null ? test.ph_level : '',
        nitrate_level: test.nitrate_level !== null ? test.nitrate_level : '',
        status: test.status || 'pending',
        corrective_actions: test.corrective_actions || '',
        retest_date: test.retest_date || '',
        notes: test.notes || '',
        recorded_by: test.recorded_by || '',
      });
    } else if (waterSource) {
      setFormData(prev => ({
        ...prev,
        water_source: waterSource.id,
      }));
    }
  }, [test, waterSource]);

  // Auto-determine status based on E. coli results
  useEffect(() => {
    if (formData.ecoli_result !== '') {
      const ecoliValue = parseFloat(formData.ecoli_result);
      if (!isNaN(ecoliValue)) {
        if (ecoliValue > 235) {
          setAutoStatus('fail');
        } else if (ecoliValue <= 126) {
          setAutoStatus('pass');
        } else {
          setAutoStatus('pending');
        }
      }
    } else {
      setAutoStatus(null);
    }
  }, [formData.ecoli_result]);

  const validate = () => {
    const newErrors = {};

    if (!formData.test_date) {
      newErrors.test_date = 'Test date is required';
    }

    if (!formData.test_type) {
      newErrors.test_type = 'Test type is required';
    }

    if (formData.test_type === 'microbial' || formData.test_type === 'both') {
      if (formData.ecoli_result === '' && formData.total_coliform_result === '') {
        newErrors.microbial = 'At least one microbial result is required for microbial tests';
      }
    }

    if (formData.test_type === 'chemical' || formData.test_type === 'both') {
      if (formData.ph_level === '' && formData.nitrate_level === '') {
        newErrors.chemical = 'At least one chemical result is required for chemical tests';
      }
    }

    if (formData.status === 'fail' && !formData.corrective_actions.trim()) {
      newErrors.corrective_actions = 'Corrective actions are required when test fails';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Convert empty strings to null for numeric fields
      const dataToSave = {
        ...formData,
        ecoli_result: formData.ecoli_result === '' ? null : parseFloat(formData.ecoli_result),
        total_coliform_result: formData.total_coliform_result === '' ? null : parseFloat(formData.total_coliform_result),
        ph_level: formData.ph_level === '' ? null : parseFloat(formData.ph_level),
        nitrate_level: formData.nitrate_level === '' ? null : parseFloat(formData.nitrate_level),
        retest_date: formData.retest_date || null,
      };
      onSave(dataToSave);
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {test ? 'Edit Test Record' : 'New Water Test'}
              </h2>
              {waterSource && (
                <p className="text-sm text-slate-600">{waterSource.name}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Test Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.test_date}
                  max={getTodayDate()}
                  onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.test_date ? 'border-red-500' : 'border-slate-300'
                  }`}
                />
                {errors.test_date && <p className="mt-1 text-sm text-red-600">{errors.test_date}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.test_type}
                  onChange={(e) => setFormData({ ...formData, test_type: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.test_type ? 'border-red-500' : 'border-slate-300'
                  }`}
                >
                  <option value="microbial">Microbial (E. coli/Coliform)</option>
                  <option value="chemical">Chemical Analysis</option>
                  <option value="both">Microbial & Chemical</option>
                </select>
                {errors.test_type && <p className="mt-1 text-sm text-red-600">{errors.test_type}</p>}
              </div>
            </div>

            {/* Lab Information */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Laboratory Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lab Name
                  </label>
                  <input
                    type="text"
                    value={formData.lab_name}
                    onChange={(e) => setFormData({ ...formData, lab_name: e.target.value })}
                    placeholder="Testing laboratory"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Lab Certification Number
                  </label>
                  <input
                    type="text"
                    value={formData.lab_certification_number}
                    onChange={(e) => setFormData({ ...formData, lab_certification_number: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Microbial Results */}
            {(formData.test_type === 'microbial' || formData.test_type === 'both') && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Microbial Results</h3>
                <p className="text-sm text-slate-600 mb-4">
                  FSMA threshold: E. coli ≤ 126 CFU/100mL (pass), &gt; 235 CFU/100mL (fail)
                </p>
                {errors.microbial && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errors.microbial}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      E. coli (CFU/100mL)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ecoli_result}
                      onChange={(e) => setFormData({ ...formData, ecoli_result: e.target.value })}
                      placeholder="E. coli count"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {autoStatus && formData.ecoli_result && (
                      <p className={`mt-1 text-sm ${
                        autoStatus === 'pass' ? 'text-green-600' : autoStatus === 'fail' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        Auto-status: {autoStatus.toUpperCase()}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Total Coliform (CFU/100mL)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.total_coliform_result}
                      onChange={(e) => setFormData({ ...formData, total_coliform_result: e.target.value })}
                      placeholder="Coliform count"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Chemical Results */}
            {(formData.test_type === 'chemical' || formData.test_type === 'both') && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Chemical Results</h3>
                {errors.chemical && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errors.chemical}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      pH Level
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="14"
                      value={formData.ph_level}
                      onChange={(e) => setFormData({ ...formData, ph_level: e.target.value })}
                      placeholder="0-14"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Nitrate Level (mg/L)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.nitrate_level}
                      onChange={(e) => setFormData({ ...formData, nitrate_level: e.target.value })}
                      placeholder="mg/L"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="border-t border-slate-200 pt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Test Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">Pending Results</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail - Action Required</option>
              </select>
              {autoStatus && (
                <p className="mt-2 text-sm text-blue-600 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Based on E. coli results, suggested status: <strong>{autoStatus.toUpperCase()}</strong>
                </p>
              )}
            </div>

            {/* Corrective Actions (shown if failed) */}
            {formData.status === 'fail' && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Corrective Actions Required</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-2">
                      Actions Taken <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.corrective_actions}
                      onChange={(e) => setFormData({ ...formData, corrective_actions: e.target.value })}
                      placeholder="e.g., Stopped use of water source, initiated treatment, scheduled retest"
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.corrective_actions ? 'border-red-500' : 'border-red-300'
                      }`}
                    />
                    {errors.corrective_actions && (
                      <p className="mt-1 text-sm text-red-600">{errors.corrective_actions}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-red-800 mb-2">
                      Retest Date
                    </label>
                    <input
                      type="date"
                      value={formData.retest_date}
                      onChange={(e) => setFormData({ ...formData, retest_date: e.target.value })}
                      className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional observations or comments"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Recorded By */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Recorded By
              </label>
              <input
                type="text"
                value={formData.recorded_by}
                onChange={(e) => setFormData({ ...formData, recorded_by: e.target.value })}
                placeholder="Person recording this test"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {test ? 'Update' : 'Create'} Test Record
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaterTestModal;
