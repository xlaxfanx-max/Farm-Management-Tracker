// =============================================================================
// PACKOUT REPORT MODAL COMPONENT
// Enter packout report data with grade lines
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, FileText, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { packoutReportsAPI, fieldsAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';

const PackoutReportModal = ({ poolId, report, onClose, onSave }) => {
  const [fields, setFields] = useState([]);
  const [formData, setFormData] = useState({
    pool: poolId,
    field: '',
    report_date: new Date().toISOString().split('T')[0],
    period_start: '',
    period_end: '',
    run_numbers: '',
    bins_this_period: '',
    bins_cumulative: '',
    total_packed_percent: '',
    house_avg_packed_percent: '',
    juice_percent: '',
    cull_percent: '',
    quality_notes: '',
  });
  const [gradeLines, setGradeLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchFields();
  }, []);

  useEffect(() => {
    if (report) {
      setFormData({
        pool: report.pool || poolId,
        field: report.field || '',
        report_date: report.report_date || new Date().toISOString().split('T')[0],
        period_start: report.period_start || '',
        period_end: report.period_end || '',
        run_numbers: report.run_numbers || '',
        bins_this_period: report.bins_this_period || '',
        bins_cumulative: report.bins_cumulative || '',
        total_packed_percent: report.total_packed_percent || '',
        house_avg_packed_percent: report.house_avg_packed_percent || '',
        juice_percent: report.juice_percent || '',
        cull_percent: report.cull_percent || '',
        quality_notes: report.quality_notes || '',
      });
      if (report.grade_lines) {
        setGradeLines(report.grade_lines);
      }
    }
  }, [report, poolId]);

  const fetchFields = async () => {
    try {
      const response = await fieldsAPI.getAll();
      setFields(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching fields:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleAddGradeLine = () => {
    setGradeLines(prev => [...prev, {
      grade: '',
      size: '',
      unit_of_measure: 'CARTON',
      quantity_this_period: '',
      percent_this_period: '',
      quantity_cumulative: '',
      percent_cumulative: '',
      house_avg_percent: '',
    }]);
  };

  const handleGradeLineChange = (index, field, value) => {
    setGradeLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveGradeLine = (index) => {
    setGradeLines(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.field) {
      newErrors.field = 'Field is required';
    }
    if (!formData.report_date) {
      newErrors.report_date = 'Report date is required';
    }
    if (!formData.period_start) {
      newErrors.period_start = 'Period start is required';
    }
    if (!formData.period_end) {
      newErrors.period_end = 'Period end is required';
    }
    if (!formData.bins_this_period || parseFloat(formData.bins_this_period) < 0) {
      newErrors.bins_this_period = 'Bins this period is required';
    }
    if (!formData.bins_cumulative || parseFloat(formData.bins_cumulative) < 0) {
      newErrors.bins_cumulative = 'Cumulative bins is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      const data = {
        ...formData,
        bins_this_period: parseFloat(formData.bins_this_period),
        bins_cumulative: parseFloat(formData.bins_cumulative),
        total_packed_percent: formData.total_packed_percent ? parseFloat(formData.total_packed_percent) : null,
        house_avg_packed_percent: formData.house_avg_packed_percent ? parseFloat(formData.house_avg_packed_percent) : null,
        juice_percent: formData.juice_percent ? parseFloat(formData.juice_percent) : null,
        cull_percent: formData.cull_percent ? parseFloat(formData.cull_percent) : null,
        grade_lines: gradeLines.filter(g => g.grade).map(g => ({
          ...g,
          quantity_this_period: parseFloat(g.quantity_this_period) || 0,
          percent_this_period: parseFloat(g.percent_this_period) || 0,
          quantity_cumulative: g.quantity_cumulative ? parseFloat(g.quantity_cumulative) : null,
          percent_cumulative: g.percent_cumulative ? parseFloat(g.percent_cumulative) : null,
          house_avg_percent: g.house_avg_percent ? parseFloat(g.house_avg_percent) : null,
        })),
      };

      if (report) {
        await packoutReportsAPI.update(report.id, data);
      } else {
        await packoutReportsAPI.create(data);
      }
      onSave();
    } catch (error) {
      console.error('Error saving packout report:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        alert('Failed to save packout report');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            {report ? 'Edit Packout Report' : 'Add Packout Report'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Field and Dates */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field/Block *
              </label>
              <select
                name="field"
                value={formData.field}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.field ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Field</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {errors.field && <p className="text-red-500 text-xs mt-1">{errors.field}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Date *
              </label>
              <input
                type="date"
                name="report_date"
                value={formData.report_date}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.report_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period Start *
              </label>
              <input
                type="date"
                name="period_start"
                value={formData.period_start}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.period_start ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period End *
              </label>
              <input
                type="date"
                name="period_end"
                value={formData.period_end}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.period_end ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Run Numbers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Run Numbers
            </label>
            <input
              type="text"
              name="run_numbers"
              value={formData.run_numbers}
              onChange={handleChange}
              placeholder="e.g., 2535499 or 2535579, 2535591"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Bins */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bins This Period *
              </label>
              <input
                type="number"
                name="bins_this_period"
                value={formData.bins_this_period}
                onChange={handleChange}
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.bins_this_period ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cumulative Bins *
              </label>
              <input
                type="number"
                name="bins_cumulative"
                value={formData.bins_cumulative}
                onChange={handleChange}
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.bins_cumulative ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
          </div>

          {/* Pack Percentages */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Packed %
              </label>
              <input
                type="number"
                name="total_packed_percent"
                value={formData.total_packed_percent}
                onChange={handleChange}
                step="0.01"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                House Avg %
              </label>
              <input
                type="number"
                name="house_avg_packed_percent"
                value={formData.house_avg_packed_percent}
                onChange={handleChange}
                step="0.01"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Juice %
              </label>
              <input
                type="number"
                name="juice_percent"
                value={formData.juice_percent}
                onChange={handleChange}
                step="0.01"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cull %
              </label>
              <input
                type="number"
                name="cull_percent"
                value={formData.cull_percent}
                onChange={handleChange}
                step="0.01"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Quality Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quality Notes
            </label>
            <input
              type="text"
              name="quality_notes"
              value={formData.quality_notes}
              onChange={handleChange}
              placeholder="e.g., Wind Scar, Scale"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Grade Lines */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-gray-700">Grade Breakdown</h3>
              <button
                type="button"
                onClick={handleAddGradeLine}
                className="flex items-center text-sm text-green-600 hover:text-green-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Grade
              </button>
            </div>

            {gradeLines.length > 0 && (
              <div className="space-y-2">
                {gradeLines.map((line, index) => (
                  <div key={index} className="grid grid-cols-7 gap-2 items-start bg-gray-50 p-2 rounded-lg">
                    <select
                      value={line.grade}
                      onChange={(e) => handleGradeLineChange(index, 'grade', e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Grade</option>
                      {PACKINGHOUSE_CONSTANTS.gradeTypes.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={line.size}
                      onChange={(e) => handleGradeLineChange(index, 'size', e.target.value)}
                      placeholder="Size"
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={line.quantity_this_period}
                      onChange={(e) => handleGradeLineChange(index, 'quantity_this_period', e.target.value)}
                      placeholder="Qty"
                      step="0.01"
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={line.percent_this_period}
                      onChange={(e) => handleGradeLineChange(index, 'percent_this_period', e.target.value)}
                      placeholder="%"
                      step="0.01"
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={line.quantity_cumulative}
                      onChange={(e) => handleGradeLineChange(index, 'quantity_cumulative', e.target.value)}
                      placeholder="Cum Qty"
                      step="0.01"
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    />
                    <input
                      type="number"
                      value={line.house_avg_percent}
                      onChange={(e) => handleGradeLineChange(index, 'house_avg_percent', e.target.value)}
                      placeholder="House %"
                      step="0.01"
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveGradeLine(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PackoutReportModal;
