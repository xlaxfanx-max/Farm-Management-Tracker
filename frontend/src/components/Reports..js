// frontend/src/components/Reports.js - UPDATED for integrated PUR system + Nitrogen/ILRP

import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Filter, Calendar, MapPin, 
  TrendingUp, AlertCircle, CheckCircle, Clock,
  BarChart3, FileSpreadsheet, AlertTriangle, Shield,
  Leaf, Droplets
} from 'lucide-react';
import { reportsAPI, nitrogenReportsAPI, downloadFile } from '../services/api';

const Reports = ({ farms, fields, applications }) => {
  const [activeTab, setActiveTab] = useState('pur'); // 'pur' or 'nitrogen'
  const [statistics, setStatistics] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validating, setValidating] = useState(false);
  
  // Nitrogen report state
  const [nitrogenSummary, setNitrogenSummary] = useState([]);
  const [nitrogenYear, setNitrogenYear] = useState(new Date().getFullYear());
  const [nitrogenFarm, setNitrogenFarm] = useState('');
  const [nitrogenLoading, setNitrogenLoading] = useState(false);
  
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    farm_id: '',
    county: '',
    status: '',
    format: 'excel'  // 'csv', 'excel', or 'csv_detailed'
  });

  // Load statistics and validation when filters change
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

      // Load both statistics and validation
      const [statsResponse, validationResponse] = await Promise.all([
        reportsAPI.getStatistics(params),
        reportsAPI.validatePUR(params)
      ]);
      
      setStatistics(statsResponse.data);
      setValidation(validationResponse.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
      alert('Failed to load report statistics');
    } finally {
      setLoading(false);
    }
  };

  // Load nitrogen summary
  const loadNitrogenSummary = async () => {
    setNitrogenLoading(true);
    try {
      const params = { year: nitrogenYear };
      if (nitrogenFarm) params.farm = nitrogenFarm;
      const response = await nitrogenReportsAPI.summary(params);
      setNitrogenSummary(response.data || []);
    } catch (error) {
      console.error('Error loading nitrogen summary:', error);
    } finally {
      setNitrogenLoading(false);
    }
  };

  // Load nitrogen data when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'nitrogen') {
      loadNitrogenSummary();
    }
  }, [activeTab, nitrogenYear, nitrogenFarm]);

  const handleNitrogenExport = async () => {
    try {
      const params = { year: nitrogenYear };
      if (nitrogenFarm) params.farm = nitrogenFarm;
      const response = await nitrogenReportsAPI.export(params);
      downloadFile(response.data, `nitrogen_report_${nitrogenYear}.xlsx`);
    } catch (error) {
      console.error('Error exporting nitrogen report:', error);
      alert('Failed to export nitrogen report');
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
        alert(`✓ Validation Passed!\n\n${response.data.applications_count} applications are ready for PUR submission.`);
      } else {
        const errorMsg = `✗ Validation Failed\n\nErrors: ${response.data.errors.length}\nWarnings: ${response.data.warnings.length}\n\nPlease review the validation section below.`;
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Error validating:', error);
      alert('Failed to validate applications');
    } finally {
      setValidating(false);
    }
  };

  const handleExport = async () => {
    // Validate before exporting official format
    if (filters.format === 'csv' && validation && !validation.valid) {
      const proceed = window.confirm(
        'Warning: Applications contain validation errors.\n\n' +
        'Official PUR format requires valid data.\n\n' +
        'Would you like to export anyway using the detailed format instead?'
      );
      
      if (proceed) {
        // Switch to detailed format
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
      
      // Generate filename
      let extension = 'xlsx';
      let formatName = 'Excel';
      
      if (filters.format === 'csv') {
        extension = 'csv';
        formatName = 'Official_PUR';
      } else if (filters.format === 'csv_detailed') {
        extension = 'csv';
        formatName = 'Detailed';
      }
      
      const dateRange = filters.start_date && filters.end_date 
        ? `_${filters.start_date}_to_${filters.end_date}`
        : '';
      const filename = `PUR_${formatName}${dateRange}_${new Date().toISOString().split('T')[0]}.${extension}`;
      
      downloadFile(response.data, filename);
      
      alert('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting report:', error);
      if (error.response?.data?.validation) {
        alert(`Export failed due to validation errors:\n\n${error.response.data.validation.errors.join('\n')}`);
      } else {
        alert('Failed to export report. Please try again.');
      }
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

  // Get unique counties
  const counties = [...new Set(fields.map(f => f.county).filter(Boolean))];

  // Quick date range buttons
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

  // Year options for nitrogen filter
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  // Calculate nitrogen totals
  const nitrogenTotals = nitrogenSummary.reduce((acc, row) => ({
    applications: acc.applications + (row.total_applications || 0),
    nitrogen: acc.nitrogen + (row.total_lbs_nitrogen || 0),
    acres: acc.acres + (row.acres || 0),
  }), { applications: 0, nitrogen: 0, acres: 0 });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reports & Compliance
        </h1>
        <p className="text-gray-600">
          Generate PUR reports for pesticide compliance and nitrogen reports for ILRP
        </p>
      </div>

      {/* Report Type Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('pur')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pur'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4" />
            PUR (Pesticide Use Reports)
          </button>
          <button
            onClick={() => setActiveTab('nitrogen')}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'nitrogen'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Leaf className="w-4 h-4" />
            Nitrogen / ILRP
          </button>
        </nav>
      </div>

      {/* Nitrogen Tab Content */}
      {activeTab === 'nitrogen' && (
        <div className="space-y-6">
          {/* Nitrogen Filters & Export */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={nitrogenYear}
                    onChange={(e) => setNitrogenYear(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
                  <select
                    value={nitrogenFarm}
                    onChange={(e) => setNitrogenFarm(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Farms</option>
                    {farms.map(farm => (
                      <option key={farm.id} value={farm.id}>{farm.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleNitrogenExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>

          {/* Nitrogen Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">{nitrogenTotals.applications}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total N Applied</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {nitrogenTotals.nitrogen.toLocaleString(undefined, {maximumFractionDigits: 0})} lbs
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg N per Acre</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {nitrogenTotals.acres > 0 
                      ? (nitrogenTotals.nitrogen / nitrogenTotals.acres).toFixed(1) 
                      : '0'} lbs
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Acres</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {nitrogenTotals.acres.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Nitrogen Summary Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">Nitrogen Summary by Field - {nitrogenYear}</h3>
              <p className="text-sm text-gray-500">Annual nitrogen application totals for ILRP reporting</p>
            </div>
            
            {nitrogenLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : nitrogenSummary.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Leaf className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No nitrogen applications recorded for {nitrogenYear}</p>
                <p className="text-sm mt-1">Add applications in the Nutrients section</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Farm</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acres</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crop</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Apps</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total N (lbs)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">N/Acre</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nitrogenSummary.map((row, idx) => (
                      <tr key={row.field_id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          {row.field_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {row.farm_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {row.acres?.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {row.crop || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {row.total_applications}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          {row.total_lbs_nitrogen?.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                          {row.lbs_nitrogen_per_acre?.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-sm font-medium text-gray-900">Totals</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {nitrogenTotals.applications}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {nitrogenTotals.nitrogen.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                        {nitrogenTotals.acres > 0 
                          ? (nitrogenTotals.nitrogen / nitrogenTotals.acres).toFixed(1) 
                          : '-'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ILRP Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">ILRP Compliance Note</h4>
                <p className="text-sm text-blue-800 mt-1">
                  California's Irrigated Lands Regulatory Program (ILRP) requires reporting of nitrogen 
                  applied to agricultural land. This summary can be used for your coalition's annual 
                  nitrogen management reporting requirements.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUR Tab Content */}
      {activeTab === 'pur' && (
        <>
        {/* Filters Section */}
        <p className="text-gray-600">
          Generate California DPR-compliant Pesticide Use Reports with validation
        </p>
      </div>

      {/* Validation Alert */}
      {validation && !validation.valid && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Validation Errors Found
              </h3>
              <p className="text-sm text-red-700 mb-2">
                {validation.errors.length} error(s) and {validation.warnings.length} warning(s) 
                must be addressed before submitting official PUR reports.
              </p>
              <button
                onClick={() => document.getElementById('validation-section').scrollIntoView({ behavior: 'smooth' })}
                className="text-sm font-medium text-red-800 hover:text-red-900 underline"
              >
                View Validation Details →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Filter className="w-5 h-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Report Filters</h2>
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear All
          </button>
        </div>

        {/* Quick Date Ranges */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'This Month', value: 'thisMonth' },
              { label: 'Last Month', value: 'lastMonth' },
              { label: 'This Quarter', value: 'thisQuarter' },
              { label: 'This Year', value: 'thisYear' },
              { label: 'Last 90 Days', value: 'last90' }
            ].map(range => (
              <button
                key={range.value}
                onClick={() => setQuickDateRange(range.value)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Farm Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Farm
            </label>
            <select
              value={filters.farm_id}
              onChange={(e) => handleFilterChange('farm_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Farms</option>
              {farms.map(farm => (
                <option key={farm.id} value={farm.id}>
                  {farm.name} {farm.farm_number ? `(#${farm.farm_number})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* County Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              County
            </label>
            <select
              value={filters.county}
              onChange={(e) => handleFilterChange('county', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Counties</option>
              {counties.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending_signature">Pending Signature</option>
              <option value="complete">Complete</option>
              <option value="submitted">Submitted to PUR</option>
            </select>
          </div>

          {/* Export Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileSpreadsheet className="w-4 h-4 inline mr-1" />
              Export Format
            </label>
            <select
              value={filters.format}
              onChange={(e) => handleFilterChange('format', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="excel">Excel (with validation)</option>
              <option value="csv">Official CA PUR Format (CSV)</option>
              <option value="csv_detailed">Detailed CSV (all fields)</option>
            </select>
          </div>
        </div>

        {/* Format Info */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            {filters.format === 'csv' && (
              <><Shield className="w-4 h-4 inline mr-1" />
              <strong>Official CA PUR Format:</strong> Ready for county submission (requires validation)</>
            )}
            {filters.format === 'excel' && (
              <><FileSpreadsheet className="w-4 h-4 inline mr-1" />
              <strong>Excel Format:</strong> Includes official PUR sheet, detailed data, and validation summary</>
            )}
            {filters.format === 'csv_detailed' && (
              <><FileText className="w-4 h-4 inline mr-1" />
              <strong>Detailed CSV:</strong> All available fields for comprehensive records</>
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {validating ? 'Validating...' : 'Validate for PUR'}
          </button>
          
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            {exporting ? 'Generating Report...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* Statistics Section */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      ) : statistics ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Applications</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statistics.total_applications}
                  </p>
                </div>
                <FileText className="w-12 h-12 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Acres Treated</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statistics.total_acres.toFixed(1)}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Submitted to PUR</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statistics.submitted_to_pur}
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Pending Signature</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {statistics.pending_signature}
                  </p>
                </div>
                <Clock className="w-12 h-12 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Validation Results */}
          {validation && (
            <div id="validation-section" className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                {validation.valid ? (
                  <CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
                )}
                PUR Validation {validation.valid ? 'Passed' : 'Failed'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className={`p-4 rounded-lg ${validation.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <p className={`text-2xl font-bold ${validation.valid ? 'text-green-900' : 'text-red-900'}`}>
                    {validation.valid ? 'READY' : 'NOT READY'}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-gray-700">Errors</p>
                  <p className="text-2xl font-bold text-red-900">
                    {validation.errors.length}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                  <p className="text-sm font-medium text-gray-700">Warnings</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {validation.warnings.length}
                  </p>
                </div>
              </div>

              {validation.errors.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-md font-semibold text-red-900 mb-2">
                    Errors (Must Fix):
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, idx) => (
                      <li key={idx} className="text-sm text-red-700">{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-orange-900 mb-2">
                    Warnings (Recommended):
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm text-orange-700">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Additional Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Status Breakdown */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Status Breakdown
              </h3>
              <div className="space-y-3">
                {Object.entries(statistics.status_breakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-gray-700 capitalize">
                      {status.replace('_', ' ')}
                    </span>
                    <div className="flex items-center">
                      <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${(count / statistics.total_applications) * 100}%`
                          }}
                        ></div>
                      </div>
                      <span className="font-semibold text-gray-900 w-12 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By County */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Top Counties
              </h3>
              <div className="space-y-3">
                {Object.entries(statistics.by_county).slice(0, 5).map(([county, data]) => (
                  <div key={county} className="flex items-center justify-between">
                    <span className="text-gray-700">{county}</span>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {data.applications} apps
                      </div>
                      <div className="text-sm text-gray-500">
                        {data.acres.toFixed(1)} acres
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(statistics.by_county).length === 0 && (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">
                    Restricted Use Products
                  </h4>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {statistics.restricted_use_count}
                  </p>
                  <p className="text-sm text-blue-700 mt-1">applications</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-green-900">
                    Unique Farms
                  </h4>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {statistics.unique_farms}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {statistics.unique_fields} fields
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-purple-900">
                    Unique Products Used
                  </h4>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {statistics.unique_products}
                  </p>
                  <p className="text-sm text-purple-700 mt-1">different products</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Statistics Available
          </h3>
          <p className="text-gray-600">
            Select date range and filters to view report statistics
          </p>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default Reports;
