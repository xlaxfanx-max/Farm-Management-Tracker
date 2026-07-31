// frontend/src/components/Reports.js - PUR Reports

import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Filter, Calendar, MapPin,
  TrendingUp, AlertCircle, CheckCircle, Clock,
  BarChart3, FileSpreadsheet, AlertTriangle, Shield,
  Leaf
} from 'lucide-react';
import { reportsAPI, downloadFile } from '../services/api';
import { useData } from '../contexts/DataContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

const Reports = () => {
  const { farms, fields, applications } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  // PUR report state
  const [statistics, setStatistics] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    farm_id: '',
    county: '',
    status: '',
    format: 'excel'
  });
  // Load PUR statistics when filters change
  useEffect(() => {
    loadStatistics();
  }, [filters.start_date, filters.end_date, filters.farm_id]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.farm_id) params.farm_id = filters.farm_id;

      const [statsResponse, validationResponse] = await Promise.all([
        reportsAPI.getStatistics(params),
        reportsAPI.validatePUR(params)
      ]);
      setStatistics(statsResponse.data);
      setValidation(validationResponse.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.farm_id) params.farm_id = filters.farm_id;

      const response = await reportsAPI.validatePUR(params);
      setValidation(response.data);
      if (response.data.valid) {
        toast.success(`Validation Passed! ${response.data.applications_count} applications are ready for PUR submission.`);
      } else {
        toast.error(`Validation Failed - Errors: ${response.data.errors.length}, Warnings: ${response.data.warnings.length}`);
      }
    } catch (error) {
      console.error('Error validating:', error);
      toast.error('Failed to validate applications');
    } finally {
      setValidating(false);
    }
  };

  const handleExport = async () => {
    if (filters.format === 'csv' && validation && !validation.valid) {
      const proceed = await confirm({ title: 'Are you sure?', message: 'Applications contain validation errors. Would you like to export anyway using the detailed format?', confirmLabel: 'Export Anyway', variant: 'warning' });
      if (proceed) {
        setFilters(prev => ({ ...prev, format: 'csv_detailed' }));
        return;
      } else {
        return;
      }
    }

    setExporting(true);
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.farm_id) params.farm_id = filters.farm_id;
      if (filters.county) params.county = filters.county;
      if (filters.status) params.status = filters.status;
      params.format = filters.format;

      const response = await reportsAPI.exportPUR(params);
      let extension = filters.format === 'excel' ? 'xlsx' : 'csv';
      const filename = `PUR_Report_${new Date().toISOString().split('T')[0]}.${extension}`;
      downloadFile(response.data, filename);
      toast.success('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      farm_id: '',
      county: '',
      status: '',
      format: 'excel'
    });
  };

  const setQuickDateRange = (range) => {
    const today = new Date();
    let startDate = new Date();
    switch(range) {
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        handleFilterChange('end_date', endOfLastMonth.toISOString().split('T')[0]);
        break;
      case 'thisQuarter':
        const quarter = Math.floor(today.getMonth() / 3);
        startDate = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case 'last90':
        startDate.setDate(today.getDate() - 90);
        break;
      default:
        return;
    }
    handleFilterChange('start_date', startDate.toISOString().split('T')[0]);
    if (range !== 'lastMonth') {
      handleFilterChange('end_date', '');
    }
  };

  // Get unique counties
  const counties = [...new Set(fields.map(f => f.county).filter(Boolean))];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Compliance</h1>
        <p className="text-gray-600">
          Generate PUR reports for pesticide compliance
        </p>
      </div>

      <div className="space-y-6">
          {/* Validation Alert */}
          {validation && !validation.valid && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900">Validation Errors Found</h3>
                  <p className="text-sm text-red-700">
                    {validation.errors.length} error(s) and {validation.warnings.length} warning(s) must be addressed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Report Filters
              </h2>
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700">
                Clear All
              </button>
            </div>

            {/* Quick Date Range */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                  { id: 'thisQuarter', label: 'This Quarter' },
                  { id: 'thisYear', label: 'This Year' },
                  { id: 'last90', label: 'Last 90 Days' },
                ].map(range => (
                  <button
                    key={range.id}
                    onClick={() => setQuickDateRange(range.id)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
                <select
                  value={filters.farm_id}
                  onChange={(e) => handleFilterChange('farm_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Farms</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>{farm.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                <select
                  value={filters.county}
                  onChange={(e) => handleFilterChange('county', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Counties</option>
                  {counties.map(county => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Export Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Options
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {[
                { id: 'excel', label: 'Excel (.xlsx)', desc: 'Full details with formatting' },
                { id: 'csv', label: 'Official PUR CSV', desc: 'DPR submission format' },
                { id: 'csv_detailed', label: 'Detailed CSV', desc: 'All fields for review' },
              ].map(format => (
                <label
                  key={format.id}
                  className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                    filters.format === format.id
                      ? 'border-primary bg-primary-light'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={format.id}
                    checked={filters.format === format.id}
                    onChange={(e) => handleFilterChange('format', e.target.value)}
                    className="mt-1 text-primary"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">{format.label}</div>
                    <div className="text-sm text-gray-500">{format.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {validating ? 'Validating...' : 'Validate'}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export Report'}
              </button>
            </div>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Report Statistics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{statistics.total_applications || 0}</div>
                  <div className="text-sm text-gray-500">Applications</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{statistics.total_fields || 0}</div>
                  <div className="text-sm text-gray-500">Fields</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{statistics.total_acres?.toFixed(1) || 0}</div>
                  <div className="text-sm text-gray-500">Total Acres</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{statistics.total_products || 0}</div>
                  <div className="text-sm text-gray-500">Products Used</div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Details */}
          {validation && validation.errors && validation.errors.length > 0 && (
            <div id="validation-section" className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Validation Details</h2>

              {validation.errors.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium text-red-800 mb-2">Errors ({validation.errors.length})</h3>
                  <ul className="space-y-1">
                    {validation.errors.map((error, idx) => (
                      <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings && validation.warnings.length > 0 && (
                <div>
                  <h3 className="font-medium text-yellow-800 mb-2">Warnings ({validation.warnings.length})</h3>
                  <ul className="space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-yellow-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default Reports;
