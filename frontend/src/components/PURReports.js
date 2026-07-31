import React, { useState, useEffect } from 'react';
import { FileText, Download, AlertTriangle, CheckCircle, Calendar, FileSpreadsheet } from 'lucide-react';
import { applicationEventsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

/**
 * PUR Report Generator Component
 *
 * Allows users to:
 * - Select date range and farm for PUR reports
 * - Validate applications for PUR compliance
 * - View summary statistics
 * - Export PUR-formatted CSV reports
 */
function PURReports({ farms }) {
  const toast = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedFarm, setSelectedFarm] = useState('');
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Set default date range to current month
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  // Validate applications for PUR compliance
  const handleValidate = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setShowResults(false);

    try {
      const payload = {
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedFarm) {
        payload.farm_id = selectedFarm;
      }

      const response = await applicationEventsAPI.validatePUR(payload);
      setValidation(response.data);

      // Also get summary
      const summaryResponse = await applicationEventsAPI.purSummary(payload);
      setSummary(summaryResponse.data.summary);
      setShowResults(true);
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate applications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Export PUR CSV report
  const handleExport = async () => {
    if (!validation || !validation.valid) {
      toast.error('Please validate applications first and fix any errors before exporting.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        start_date: startDate,
        end_date: endDate,
      };
      if (selectedFarm) {
        payload.farm_id = selectedFarm;
      }

      const response = await applicationEventsAPI.exportPURCSV(payload);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PUR_Report_${startDate}_to_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PUR report downloaded successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report. Please ensure all validations pass.');
    } finally {
      setLoading(false);
    }
  };

  // Quick date range selection
  const setQuickRange = (range) => {
    const now = new Date();
    let start, end;

    switch (range) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-bark-600 mt-1">
            Generate California Pesticide Use Report (PUR) compliant exports
          </p>
        </div>
        <FileText className="w-12 h-12 text-primary" />
      </div>

      {/* Instructions Card */}
      <div className="bg-orange-50 border border-orange-200 rounded-card p-4">
        <h3 className=" text-orange-700 flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          How to Use This Tool
        </h3>
        <ol className="mt-2 text-sm text-orange-700 space-y-1 ml-5 list-decimal">
          <li>Select the date range for your report</li>
          <li>Optionally filter by a specific farm</li>
          <li>Click "Validate for PUR" to check compliance</li>
          <li>Review any errors or warnings</li>
          <li>If validation passes, click "Export CSV" to download</li>
          <li>Submit the CSV file to your County Agricultural Commissioner</li>
        </ol>
      </div>

      {/* Filter Panel */}
      <div className="bg-surface-raised rounded-card shadow-md p-6">
        <h2 className="text-lg text-heading mb-4">Report Parameters</h2>
        {/* Quick Range Buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-bark-700 mb-2">
            Quick Select:
          </label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setQuickRange('thisMonth')}
              className="px-3 py-1 bg-cream-100 hover:bg-sand-200 rounded text-sm"
            >
              This Month
            </button>
            <button
              onClick={() => setQuickRange('lastMonth')}
              className="px-3 py-1 bg-cream-100 hover:bg-sand-200 rounded text-sm"
            >
              Last Month
            </button>
            <button
              onClick={() => setQuickRange('thisQuarter')}
              className="px-3 py-1 bg-cream-100 hover:bg-sand-200 rounded text-sm"
            >
              This Quarter
            </button>
            <button
              onClick={() => setQuickRange('thisYear')}
              className="px-3 py-1 bg-cream-100 hover:bg-sand-200 rounded text-sm"
            >
              This Year
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-2">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              required
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-2">
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              required
            />
          </div>

          {/* Farm Filter */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-2">
              Farm (Optional)
            </label>
            <select
              value={selectedFarm}
              onChange={(e) => setSelectedFarm(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            >
              <option value="">All Farms</option>
              {farms && farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} - {farm.owner_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleValidate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-bark-400"
          >
            <CheckCircle className="w-4 h-4" />
            {loading ? 'Validating...' : 'Validate for PUR'}
          </button>

          <button
            onClick={handleExport}
            disabled={loading || !validation || !validation.valid}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-bark-400"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Validation Results */}
      {showResults && validation && (
        <div className="bg-surface-raised rounded-card shadow-md p-6">
          <h2 className="text-lg text-heading mb-4">Validation Results</h2>
          {/* Status Summary */}
          <div className={`p-4 rounded-lg mb-4 ${
            validation.valid
              ? 'bg-primary-light border border-green-200'
              : 'bg-danger-bg border border-danger/25'
          }`}>
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <>
                  <CheckCircle className="w-6 h-6 text-primary" />
                  <div>
                    <h3 className=" text-green-800">Ready for Export</h3>
                    <p className="text-sm text-primary">
                      {validation.applications_count} application(s) validated successfully
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-6 h-6 text-danger" />
                  <div>
                    <h3 className=" text-danger">Validation Failed</h3>
                    <p className="text-sm text-danger">
                      Please fix errors before exporting
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Errors */}
          {validation.errors && validation.errors.length > 0 && (
            <div className="mb-4">
              <h3 className=" text-danger mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Errors ({validation.errors.length})
              </h3>
              <ul className="space-y-1 text-sm text-danger bg-danger-bg p-3 rounded">
                {validation.errors.map((error, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-danger mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {validation.warnings && validation.warnings.length > 0 && (
            <div>
              <h3 className=" text-yellow-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Warnings ({validation.warnings.length})
              </h3>
              <ul className="space-y-1 text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
                {validation.warnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-yellow-600 mt-0.5">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-600 mt-2">
                Note: Warnings won't prevent export, but completing these fields improves compliance.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Summary Statistics */}
      {showResults && summary && (
        <div className="bg-surface-raised rounded-card shadow-md p-6">
          <h2 className="text-lg text-heading mb-4">Report Summary</h2>
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-700">
                {summary.total_applications}
              </div>
              <div className="text-sm text-orange-700">Total Applications</div>
            </div>
            <div className="bg-primary-light p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-800">
                {summary.total_acres_treated.toFixed(1)}
              </div>
              <div className="text-sm text-primary">Acres Treated</div>
            </div>
            <div className="bg-cream-100 p-4 rounded-lg">
              <div className="text-2xl font-bold text-bark-900">
                {summary.unique_products}
              </div>
              <div className="text-sm text-bark-700">Unique Products</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-900">
                {summary.restricted_use_applications}
              </div>
              <div className="text-sm text-orange-700">Restricted Use</div>
            </div>
          </div>

          {/* By County */}
          {summary.by_county && summary.by_county.length > 0 && (
            <div className="mb-6">
              <h3 className=" text-heading mb-3">Applications by County</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-cream-50 bg-surface-sunken">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">County</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Applications</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Acres</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-raised divide-y divide-border">
                    {summary.by_county.map((county, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-bark-700">{county.county}</td>
                        <td className="px-4 py-2 text-sm text-bark-600">{county.applications}</td>
                        <td className="px-4 py-2 text-sm text-bark-600">{county.acres.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Products */}
          {summary.by_product && summary.by_product.length > 0 && (
            <div>
              <h3 className=" text-heading mb-3">Top Products Used</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-cream-50 bg-surface-sunken">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Product</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">EPA Reg No</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Applications</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface-raised divide-y divide-border">
                    {summary.by_product.map((product, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-bark-700">{product.product_name}</td>
                        <td className="px-4 py-2 text-sm text-bark-600">{product.epa_reg_no}</td>
                        <td className="px-4 py-2 text-sm text-bark-600">{product.applications}</td>
                        <td className="px-4 py-2 text-sm text-bark-600">{product.total_amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PURReports;
