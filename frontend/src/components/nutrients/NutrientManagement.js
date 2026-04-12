import React, { useState, useEffect, useCallback } from 'react';
import {
  Leaf, Plus, RefreshCw, Package, BarChart3, FileText, AlertTriangle
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fertilizerProductsAPI,
  nutrientApplicationsAPI,
  nutrientPlansAPI,
  nitrogenReportsAPI,
  downloadFile
} from '../../services/api';

import NutrientApplicationList from './NutrientApplicationList';
import FertilizerProductGrid from './FertilizerProductGrid';
import NitrogenSummaryTab from './NitrogenSummaryTab';
import NutrientPlansTab from './NutrientPlansTab';

const NutrientManagement = () => {
  const { farms = [], fields = [], waterSources = [], loadData } = useData();
  const { openNutrientAppModal, openFertilizerProductModal, registerRefreshCallback, unregisterRefreshCallback } = useModal();
  const confirm = useConfirm();
  const toast = useToast();

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

  // Stats
  const [stats, setStats] = useState({
    totalApplications: 0,
    totalNitrogen: 0,
    avgNitrogenPerAcre: 0,
    totalCost: null,
  });

  // Year options for filter
  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  // ===========================================================================
  // DATA FETCHING
  // ===========================================================================

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

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

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
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this application?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await nutrientApplicationsAPI.delete(id);
      handleRefresh();
    } catch (err) {
      toast.error('Failed to delete application');
    }
  };

  const handleDeleteProduct = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this product?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await fertilizerProductsAPI.delete(id);
      handleRefresh();
    } catch (err) {
      toast.error('Failed to delete product. It may be in use by applications.');
    }
  };

  const handleExport = async () => {
    try {
      const response = await nitrogenReportsAPI.export({ year: filterYear, farm: filterFarm || undefined });
      downloadFile(response.data, `nitrogen_report_${filterYear}.xlsx`);
    } catch (err) {
      toast.error('Failed to export report');
    }
  };

  const handleSeedProducts = async () => {
    const ok = await confirm({ title: 'Are you sure?', message: 'This will add common fertilizer products to the database. Continue?', confirmLabel: 'Continue', variant: 'warning' });
    if (!ok) return;
    try {
      const response = await fertilizerProductsAPI.seedCommon();
      toast.success(`Added ${response.data.created} new products`);
      fetchProducts();
    } catch (err) {
      toast.error('Failed to seed products');
    }
  };

  // ===========================================================================
  // FILTERED DATA
  // ===========================================================================

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

  // ===========================================================================
  // TAB DEFINITIONS
  // ===========================================================================

  const tabs = [
    { id: 'applications', label: 'Applications', icon: Leaf, count: stats.totalApplications },
    { id: 'products', label: 'Products', icon: Package, count: products.length },
    { id: 'summary', label: 'N Summary', icon: BarChart3 },
    { id: 'plans', label: 'Plans', icon: FileText, count: plans.length },
  ];

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nutrient Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Track fertilizer applications and nitrogen for ILRP compliance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {activeTab === 'applications' && (
            <button
              onClick={() => openNutrientAppModal(null)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
            >
              <Plus className="w-4 h-4" />
              Add Application
            </button>
          )}

          {activeTab === 'products' && (
            <button
              onClick={() => openFertilizerProductModal(null)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}

          {activeTab === 'plans' && (
            <button
              onClick={() => console.log('Nutrient plan modal not yet implemented')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover opacity-50 cursor-not-allowed"
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
      <div className="border-b border-gray-200 dark:border-gray-700">
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
                  ? 'border-primary text-primary dark:text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-green-100 text-primary' : 'bg-gray-100 text-gray-600'
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
          {activeTab === 'applications' && (
            <NutrientApplicationList
              stats={stats}
              filteredApplications={filteredApplications}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filterFarm={filterFarm}
              setFilterFarm={setFilterFarm}
              filterMethod={filterMethod}
              setFilterMethod={setFilterMethod}
              yearOptions={yearOptions}
              farms={farms}
              onEdit={(app) => openNutrientAppModal(app)}
              onDelete={handleDeleteApplication}
            />
          )}
          {activeTab === 'products' && (
            <FertilizerProductGrid
              filteredProducts={filteredProducts}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onEdit={(product) => openFertilizerProductModal(product)}
              onDelete={handleDeleteProduct}
              onSeedProducts={handleSeedProducts}
            />
          )}
          {activeTab === 'summary' && (
            <NitrogenSummaryTab
              summary={summary}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filterFarm={filterFarm}
              setFilterFarm={setFilterFarm}
              yearOptions={yearOptions}
              farms={farms}
              onExport={handleExport}
            />
          )}
          {activeTab === 'plans' && (
            <NutrientPlansTab
              plans={plans}
              filterYear={filterYear}
              setFilterYear={setFilterYear}
              filterFarm={filterFarm}
              setFilterFarm={setFilterFarm}
              yearOptions={yearOptions}
              farms={farms}
            />
          )}
        </>
      )}
    </div>
  );
};

export default NutrientManagement;
