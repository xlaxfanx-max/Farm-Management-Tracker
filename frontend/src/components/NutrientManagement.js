// =============================================================================
// NUTRIENT MANAGEMENT - UNIFIED COMPONENT
// =============================================================================
// src/components/NutrientManagement.js
// Tracks fertilizer applications and nitrogen management for ILRP compliance
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Leaf, Plus, Search, Filter, Calendar, Edit, Trash2,
  Download, RefreshCw, Package, BarChart3, FileText,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalContext';
import {
  fertilizerProductsAPI,
  nutrientApplicationsAPI,
  nutrientPlansAPI,
  nitrogenReportsAPI,
  NUTRIENT_CONSTANTS,
  downloadFile
} from '../services/api';

// =============================================================================
// CONSTANTS
// =============================================================================

const METHOD_LABELS = {
  'broadcast': 'Broadcast',
  'banded': 'Banded',
  'foliar': 'Foliar Spray',
  'fertigation': 'Fertigation',
  'injection': 'Soil Injection',
  'sidedress': 'Sidedress',
  'topdress': 'Topdress',
  'incorporated': 'Pre-plant Incorporated',
  'drip': 'Drip/Micro-irrigation',
  'aerial': 'Aerial Application',
};

const FORM_LABELS = {
  'granular': 'Granular',
  'liquid': 'Liquid',
  'soluble': 'Water Soluble',
  'organic': 'Organic',
  'foliar': 'Foliar',
  'controlled_release': 'Controlled Release',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const NutrientManagement = () => {
  const { farms = [], fields = [], waterSources = [], loadData } = useData();
  const { openNutrientAppModal, openFertilizerProductModal, registerRefreshCallback, unregisterRefreshCallback } = useModal();
  // Active tab state
  const [activeTab, setActiveTab] = useState('applications');
  
  // Data state
  const [applications, setApplications] = useState([]);
  const [products, setProducts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [summary, setSummary] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMethod, setFilterMethod] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  // Stats
  const [stats, setStats] = useState({
    totalApplications: 0,
    totalNitrogen: 0,
    avgNitrogenPerAcre: 0,
    totalCost: null,
  });

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchApplications = useCallback(async () => {
    try {
      const params = { year: filterYear };
      if (filterFarm) params.farm = filterFarm;
      if (filterMethod) params.method = filterMethod;
      
      const response = await nutrientApplicationsAPI.getAll(params);
      const data = response.data.results || response.data || [];
      setApplications(data);
      
      // Calculate stats
      const totalN = data.reduce((sum, app) => sum + (parseFloat(app.total_lbs_nitrogen) || 0), 0);
      const totalAcres = data.reduce((sum, app) => sum + (parseFloat(app.effective_acres) || 0), 0);
      const totalCost = data.reduce((sum, app) => sum + (parseFloat(app.total_cost) || 0), 0);
      
      setStats({
        totalApplications: data.length,
        totalNitrogen: totalN,
        avgNitrogenPerAcre: totalAcres > 0 ? totalN / totalAcres : 0,
        totalCost: totalCost > 0 ? totalCost : null,
      });
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Failed to load applications');
    }
  }, [filterYear, filterFarm, filterMethod]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fertilizerProductsAPI.getAll();
      setProducts(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const params = { year: filterYear };
      if (filterFarm) params.farm = filterFarm;
      const response = await nutrientPlansAPI.getAll(params);
      setPlans(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, [filterYear, filterFarm]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = { year: filterYear };
      if (filterFarm) params.farm = filterFarm;
      const response = await nitrogenReportsAPI.summary(params);
      setSummary(response.data || []);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [filterYear, filterFarm]);

  // Load data based on active tab
  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadTabData = async () => {
      try {
        if (activeTab === 'applications') {
          await Promise.all([fetchApplications(), fetchProducts()]);
        } else if (activeTab === 'products') {
          await fetchProducts();
        } else if (activeTab === 'summary') {
          await fetchSummary();
        } else if (activeTab === 'plans') {
          await fetchPlans();
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadTabData();
  }, [activeTab, fetchApplications, fetchProducts, fetchSummary, fetchPlans]);

  // Register refresh callback with context for modal saves
  const refreshAllData = useCallback(async () => {
    await Promise.all([fetchApplications(), fetchProducts(), fetchSummary(), fetchPlans()]);
  }, [fetchApplications, fetchProducts, fetchSummary, fetchPlans]);

  useEffect(() => {
    registerRefreshCallback('nutrients', refreshAllData);
    return () => unregisterRefreshCallback('nutrients');
  }, [registerRefreshCallback, unregisterRefreshCallback, refreshAllData]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'applications') await fetchApplications();
      else if (activeTab === 'products') await fetchProducts();
      else if (activeTab === 'summary') await fetchSummary();
      else if (activeTab === 'plans') await fetchPlans();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApplication = async (id) => {
    if (!window.confirm('Are you sure you want to delete this application?')) return;
    try {
      await nutrientApplicationsAPI.delete(id);
      handleRefresh();
    } catch (err) {
      alert('Failed to delete application');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await fertilizerProductsAPI.delete(id);
      handleRefresh();
    } catch (err) {
      alert('Failed to delete product. It may be in use by applications.');
    }
  };

  const handleExport = async () => {
    try {
      const response = await nitrogenReportsAPI.export({ year: filterYear, farm: filterFarm || undefined });
      downloadFile(response.data, `nitrogen_report_${filterYear}.xlsx`);
    } catch (err) {
      alert('Failed to export report');
    }
  };

  const handleSeedProducts = async () => {
    if (!window.confirm('This will add common fertilizer products to the database. Continue?')) return;
    try {
      const response = await fertilizerProductsAPI.seedCommon();
      alert(`Added ${response.data.created} new products`);
      fetchProducts();
    } catch (err) {
      alert('Failed to seed products');
    }
  };

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // =============================================================================
  // FILTERED DATA
  // =============================================================================

  const filteredApplications = applications.filter(app => {
    const matchesSearch = !searchTerm || 
      app.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.field_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.farm_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredProducts = products.filter(prod => {
    const matchesSearch = !searchTerm ||
      prod.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // =============================================================================
  // TAB DEFINITIONS
  // =============================================================================

  const tabs = [
    { id: 'applications', label: 'Applications', icon: Leaf, count: stats.totalApplications },
    { id: 'products', label: 'Products', icon: Package, count: products.length },
    { id: 'summary', label: 'N Summary', icon: BarChart3 },
    { id: 'plans', label: 'Plans', icon: FileText, count: plans.length },
  ];

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return '-';
    return Number(num).toLocaleString('en-US', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatCurrency = (num) => {
    if (num === null || num === undefined) return '-';
    return '$' + Number(num).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Year options for filter
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  // =============================================================================
  // RENDER: APPLICATIONS TAB
  // =============================================================================

  const renderApplicationsTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Leaf className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Applications</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalApplications}</p>
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
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalNitrogen, 0)} lbs</p>
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
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.avgNitrogenPerAcre)} lbs</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalCost ? formatCurrency(stats.totalCost) : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          <select
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
          
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Methods</option>
            {NUTRIENT_CONSTANTS.APPLICATION_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">N/Acre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total N</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No applications found. Click "Add Application" to create one.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(app.application_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{app.field_name}</div>
                      <div className="text-xs text-gray-500">{app.farm_name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{app.product_name}</div>
                      <div className="text-xs text-gray-500">{app.product_npk}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(app.rate)} {app.rate_unit?.replace('_', '/')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatNumber(app.lbs_nitrogen_per_acre)} lbs
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(app.total_lbs_nitrogen, 0)} lbs
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {METHOD_LABELS[app.application_method] || app.application_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => openNutrientAppModal( app)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteApplication(app.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // RENDER: PRODUCTS TAB
  // =============================================================================

  const renderProductsTab = () => (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <button
            onClick={handleSeedProducts}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Seed Common Products
          </button>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No products found. Click "Seed Common Products" to add standard fertilizers.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-500">{product.manufacturer || 'No manufacturer'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openFertilizerProductModal( product)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4 mb-3">
                <div className="text-2xl font-bold text-green-600">{product.npk_display}</div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  product.is_organic 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {product.is_organic ? 'Organic' : FORM_LABELS[product.form] || product.form}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="bg-blue-50 rounded p-2">
                  <div className="font-medium text-blue-700">{product.nitrogen_pct}%</div>
                  <div className="text-xs text-blue-600">Nitrogen</div>
                </div>
                <div className="bg-orange-50 rounded p-2">
                  <div className="font-medium text-orange-700">{product.phosphorus_pct}%</div>
                  <div className="text-xs text-orange-600">Phosphate</div>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <div className="font-medium text-purple-700">{product.potassium_pct}%</div>
                  <div className="text-xs text-purple-600">Potash</div>
                </div>
              </div>
              
              {product.omri_listed && (
                <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="w-3 h-3" />
                  OMRI Listed
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  // =============================================================================
  // RENDER: SUMMARY TAB
  // =============================================================================

  const renderSummaryTab = () => (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          
          <select
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">Nitrogen Summary by Field - {filterYear}</h3>
          <p className="text-sm text-gray-500">Annual nitrogen application totals for ILRP reporting</p>
        </div>
        
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">vs Plan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    No data for {filterYear}. Add nutrient applications to see summary.
                  </td>
                </tr>
              ) : (
                summary.map((row, idx) => (
                  <tr key={row.field_id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                      {row.field_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {row.farm_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatNumber(row.acres)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {row.crop}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                      {row.total_applications}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {formatNumber(row.total_lbs_nitrogen, 0)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right">
                      {formatNumber(row.lbs_nitrogen_per_acre)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {row.has_plan ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          row.variance_lbs_acre > 10 
                            ? 'bg-red-100 text-red-800' 
                            : row.variance_lbs_acre < -10 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                        }`}>
                          {row.variance_lbs_acre > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : row.variance_lbs_acre < 0 ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : (
                            <Minus className="w-3 h-3" />
                          )}
                          {row.variance_lbs_acre > 0 ? '+' : ''}{formatNumber(row.variance_lbs_acre)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No plan</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {summary.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan="4" className="px-4 py-3 text-sm font-medium text-gray-900">Totals</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {summary.reduce((sum, r) => sum + r.total_applications, 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                    {formatNumber(summary.reduce((sum, r) => sum + (r.total_lbs_nitrogen || 0), 0), 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                    {formatNumber(
                      summary.reduce((sum, r) => sum + (r.total_lbs_nitrogen || 0), 0) / 
                      Math.max(summary.reduce((sum, r) => sum + (r.acres || 0), 0), 1)
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );

  // =============================================================================
  // RENDER: PLANS TAB
  // =============================================================================

  const renderPlansTab = () => (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        
        <select
          value={filterFarm}
          onChange={(e) => setFilterFarm(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Farms</option>
          {farms.map(farm => (
            <option key={farm.id} value={farm.id}>{farm.name}</option>
          ))}
        </select>
      </div>

      {/* Plans List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Year</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Crop</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Planned N</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actual N</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Applied</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {plans.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                  No nitrogen plans for {filterYear}. Click "Add Plan" to create one.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{plan.field_name}</div>
                    <div className="text-xs text-gray-500">{plan.farm_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{plan.year}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{plan.crop}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatNumber(plan.planned_nitrogen_lbs_acre)} lbs/ac
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                    {formatNumber(plan.actual_nitrogen_applied_per_acre)} lbs/ac
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatNumber(plan.percent_of_plan_applied, 0)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      plan.status === 'active' ? 'bg-green-100 text-green-800' :
                      plan.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {plan.status_display || plan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => console.log('Nutrient plan modal not yet implemented')}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit"
                      disabled
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nutrient Management</h1>
          <p className="text-gray-500">Track fertilizer applications and nitrogen for ILRP compliance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          {activeTab === 'applications' && (
            <button
              onClick={() => openNutrientAppModal( null)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Add Application
            </button>
          )}
          
          {activeTab === 'products' && (
            <button
              onClick={() => openFertilizerProductModal( null)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
          
          {activeTab === 'plans' && (
            <button
              onClick={() => console.log('Nutrient plan modal not yet implemented')}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 opacity-50 cursor-not-allowed"
              disabled
            >
              <Plus className="w-4 h-4" />
              Add Plan
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading && !applications.length && !products.length ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'applications' && renderApplicationsTab()}
          {activeTab === 'products' && renderProductsTab()}
          {activeTab === 'summary' && renderSummaryTab()}
          {activeTab === 'plans' && renderPlansTab()}
        </>
      )}
    </div>
  );
};

export default NutrientManagement;
