// frontend/src/components/Reports.js - PUR + Nitrogen/ILRP Reports

import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Filter, Calendar, MapPin, 
  TrendingUp, AlertCircle, CheckCircle, Clock,
  BarChart3, FileSpreadsheet, AlertTriangle, Shield,
  Leaf
} from 'lucide-react';
import { reportsAPI, nitrogenReportsAPI, downloadFile } from '../services/api';

const Reports = ({ farms, fields, applications }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState('pur'); // 'pur' or 'nitrogen'
  
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
  
  // Nitrogen report state
  const [nitrogenSummary, setNitrogenSummary] = useState([]);
  const [nitrogenYear, setNitrogenYear] = useState(new Date().getFullYear());
  const [nitrogenFarm, setNitrogenFarm] = useState('');
  const [nitrogenLoading, setNitrogenLoading] = useState(false);

  // Load PUR statistics when filters change
  useEffect(() => {
    if (activeTab === 'pur') {
      loadStatistics();
    }
  }, [filters.start_date, filters.end_date, filters.farm_id, activeTab]);

  // Load nitrogen data when tab or filters change
  useEffect(() => {
    if (activeTab === 'nitrogen') {
      loadNitrogenSummary();
    }
  }, [activeTab, nitrogenYear, nitrogenFarm]);

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
        alert(`✗ Validation Failed\n\nErrors: ${response.data.errors.length}\nWarnings: ${response.data.warnings.length}`);
      }
    } catch (error) {
      console.error('Error validating:', error);
      alert('Failed to validate applications');
    } finally {
      setValidating(false);
    }
  };

  const handleExport = async () => {
    if (filters.format === 'csv' && validation && !validation.valid) {
      const proceed = window.confirm(
        'Warning: Applications contain validation errors.\n\nWould you like to export anyway using the detailed format?'
      );
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
      alert('Report exported successfully!');
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Compliance</h1>
        <p className="text-gray-600">
          Generate PUR reports for pesticide compliance and nitrogen reports for ILRP
        </p>
      </div>

      {/* Tabs */}
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

      {/* ============================================================ */}
      {/* NITROGEN TAB */}
      {/* ============================================================ */}
      {activeTab === 'nitrogen' && (
        <div className="space-y-6">
          {/* Filters & Export */}
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

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Applications</p>
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
                  <p className="text-sm text-gray-500">Avg N/Acre</p>
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
                  <p className="text-2xl font-bold text-gray-900">{nitrogenTotals.acres.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">Nitrogen Summary by Field - {nitrogenYear}</h3>
              <p className="text-sm text-gray-500">Annual nitrogen totals for ILRP reporting</p>
            </div>
            
            {nitrogenLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : nitrogenSummary.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Leaf className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No nitrogen applications for {nitrogenYear}</p>
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
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Apps</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total N (lbs)</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">N/Acre</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {nitrogenSummary.map((row, idx) => (
                      <tr key={row.field_id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{row.field_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.farm_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{row.acres?.toFixed(1)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{row.total_applications}</td>
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
                      <td colSpan="3" className="px-4 py-3 text-sm font-medium text-gray-900">Totals</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{nitrogenTotals.applications}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                        {nitrogenTotals.nitrogen.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                        {nitrogenTotals.acres > 0 ? (nitrogenTotals.nitrogen / nitrogenTotals.acres).toFixed(1) : '-'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ILRP Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">ILRP Compliance</h4>
                <p className="text-sm text-blue-800 mt-1">
                  California's Irrigated Lands Regulatory Program requires reporting nitrogen applied to agricultural land. 
                  Use this summary for your coalition's annual nitrogen management reporting.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PUR TAB */}
      {/* ============================================================ */}
      {activeTab === 'pur' && (
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
                <select
                  value={filters.farm_id}
                  onChange={(e) => handleFilterChange('farm_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={format.id}
                    checked={filters.format === format.id}
                    onChange={(e) => handleFilterChange('format', e.target.value)}
                    className="mt-1 text-green-600"
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
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
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
      )}
    </div>
  );
};

export default Reports;
