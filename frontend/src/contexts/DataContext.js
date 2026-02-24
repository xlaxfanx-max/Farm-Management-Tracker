import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  farmsAPI,
  fieldsAPI,
  applicationsAPI,
  productsAPI,
  waterSourcesAPI,
  waterTestsAPI,
  cropsAPI,
  rootstocksAPI,
  applicationEventsAPI,
  unifiedProductsAPI,
  applicatorsAPI,
} from '../services/api';

// Create context
const DataContext = createContext(null);

// Helper to extract results from paginated or plain responses
const extractResults = (res) => res.data.results || res.data || [];

// =============================================================================
// DATA PROVIDER COMPONENT
// =============================================================================

export function DataProvider({ children }) {
  const { isAuthenticated, currentCompany } = useAuth();

  // ============================================================================
  // STATE
  // ============================================================================
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [applications, setApplications] = useState([]);
  const [products, setProducts] = useState([]);
  const [waterSources, setWaterSources] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  const [crops, setCrops] = useState([]);
  const [rootstocks, setRootstocks] = useState([]);

  // New PUR / Tank Mix system
  const [applicationEvents, setApplicationEvents] = useState([]);
  const [unifiedProducts, setUnifiedProducts] = useState([]);
  const [applicators, setApplicators] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================================================
  // TARGETED REFRESH FUNCTIONS
  // ============================================================================
  const refreshFarms = useCallback(async () => {
    const res = await farmsAPI.getAll();
    setFarms(extractResults(res));
  }, []);

  const refreshFields = useCallback(async () => {
    const res = await fieldsAPI.getAll();
    setFields(extractResults(res));
  }, []);

  const refreshApplications = useCallback(async () => {
    const res = await applicationsAPI.getAll();
    setApplications(extractResults(res));
  }, []);

  const refreshWaterSources = useCallback(async () => {
    const res = await waterSourcesAPI.getAll();
    setWaterSources(extractResults(res));
  }, []);

  const refreshWaterTests = useCallback(async () => {
    const res = await waterTestsAPI.getAll();
    setWaterTests(extractResults(res));
  }, []);

  const refreshApplicationEvents = useCallback(async () => {
    const res = await applicationEventsAPI.getAll();
    setApplicationEvents(extractResults(res));
  }, []);

  const refreshUnifiedProducts = useCallback(async () => {
    const res = await unifiedProductsAPI.getAll();
    setUnifiedProducts(extractResults(res));
  }, []);

  const refreshApplicators = useCallback(async () => {
    const res = await applicatorsAPI.getAll();
    setApplicators(extractResults(res));
  }, []);

  // ============================================================================
  // LOAD ALL DATA (initial load + company switch)
  // ============================================================================
  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [farmsRes, fieldsRes, appsRes, productsRes, waterSourcesRes, waterTestsRes, cropsRes, rootstocksRes, appEventsRes, unifiedProdsRes, applicatorsRes] = await Promise.all([
        farmsAPI.getAll(),
        fieldsAPI.getAll(),
        applicationsAPI.getAll(),
        productsAPI.getAll(),
        waterSourcesAPI.getAll(),
        waterTestsAPI.getAll(),
        cropsAPI.getAll(),
        rootstocksAPI.getAll(),
        applicationEventsAPI.getAll(),
        unifiedProductsAPI.getAll(),
        applicatorsAPI.getAll(),
      ]);

      setFarms(extractResults(farmsRes));
      setFields(extractResults(fieldsRes));
      setApplications(extractResults(appsRes));
      setProducts(extractResults(productsRes));
      setWaterSources(extractResults(waterSourcesRes));
      setWaterTests(extractResults(waterTestsRes));
      setCrops(extractResults(cropsRes));
      setRootstocks(extractResults(rootstocksRes));
      setApplicationEvents(extractResults(appEventsRes));
      setUnifiedProducts(extractResults(unifiedProdsRes));
      setApplicators(extractResults(applicatorsRes));
    } catch (err) {
      setError('Failed to load data. Please check your connection.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load data when authenticated or company changes
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      loadData();
    }
  }, [isAuthenticated, currentCompany, loadData]);

  // ============================================================================
  // FARM CRUD OPERATIONS
  // ============================================================================
  const saveFarm = useCallback(async (farmData, isEdit = false) => {
    try {
      let response;
      if (isEdit) {
        response = await farmsAPI.update(farmData.id, farmData);
      } else {
        response = await farmsAPI.create(farmData);
      }
      await refreshFarms();
      return { success: true, data: response.data };
    } catch (err) {
      console.error('Error saving farm:', err);
      return { success: false, error: 'Failed to save farm' };
    }
  }, [refreshFarms]);

  const updateFarm = useCallback(async (farmId, farmData) => {
    try {
      await farmsAPI.update(farmId, farmData);
      await refreshFarms();
      return { success: true };
    } catch (err) {
      console.error('Error updating farm:', err);
      return { success: false, error: 'Failed to update farm' };
    }
  }, [refreshFarms]);

  // Partial update for farms (uses PATCH instead of PUT)
  const patchFarm = useCallback(async (farmId, partialData) => {
    try {
      await farmsAPI.patch(farmId, partialData);
      await refreshFarms();
      return { success: true };
    } catch (err) {
      console.error('Error patching farm:', err);
      return { success: false, error: 'Failed to update farm' };
    }
  }, [refreshFarms]);

  const deleteFarm = useCallback(async (farmId) => {
    try {
      await farmsAPI.delete(farmId);
      // Deleting a farm may cascade to fields, so refresh both
      await Promise.all([refreshFarms(), refreshFields()]);
      return { success: true };
    } catch (err) {
      console.error('Error deleting farm:', err);
      return { success: false, error: 'Failed to delete farm' };
    }
  }, [refreshFarms, refreshFields]);

  // ============================================================================
  // FIELD CRUD OPERATIONS
  // ============================================================================
  const saveField = useCallback(async (fieldData, isEdit = false) => {
    try {
      if (isEdit) {
        await fieldsAPI.update(fieldData.id, fieldData);
      } else {
        await fieldsAPI.create(fieldData);
      }
      await refreshFields();
      return { success: true };
    } catch (err) {
      console.error('Error saving field:', err);
      // Extract actual error message from backend response
      let errorMessage = 'Failed to save field';
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error) {
          errorMessage = data.error;
        } else {
          // Handle field-level validation errors
          const fieldErrors = Object.entries(data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
          if (fieldErrors) {
            errorMessage = fieldErrors;
          }
        }
      }
      return { success: false, error: errorMessage };
    }
  }, [refreshFields]);

  const deleteField = useCallback(async (fieldId) => {
    try {
      await fieldsAPI.delete(fieldId);
      await refreshFields();
      return { success: true };
    } catch (err) {
      console.error('Error deleting field:', err);
      return { success: false, error: 'Failed to delete field' };
    }
  }, [refreshFields]);

  // ============================================================================
  // APPLICATION CRUD OPERATIONS
  // ============================================================================
  const saveApplication = useCallback(async (appData, isEdit = false) => {
    try {
      // Ensure numeric fields are properly typed
      const cleanedData = {
        ...appData,
        field: appData.field ? parseInt(appData.field) : null,
        product: appData.product ? parseInt(appData.product) : null,
        acres_treated: appData.acres_treated ? parseFloat(appData.acres_treated) : null,
        amount_used: appData.amount_used ? parseFloat(appData.amount_used) : null,
        temperature: appData.temperature ? parseFloat(appData.temperature) : null,
        wind_speed: appData.wind_speed ? parseFloat(appData.wind_speed) : null,
      };

      if (isEdit) {
        await applicationsAPI.update(appData.id, cleanedData);
      } else {
        await applicationsAPI.create(cleanedData);
      }
      await refreshApplications();
      return { success: true };
    } catch (err) {
      console.error('Error saving application:', err);
      console.error('Error response:', err.response?.data);
      return {
        success: false,
        error: err.response?.data?.detail || err.message || 'Failed to save application'
      };
    }
  }, [refreshApplications]);

  const deleteApplication = useCallback(async (appId) => {
    try {
      await applicationsAPI.delete(appId);
      await refreshApplications();
      return { success: true };
    } catch (err) {
      console.error('Error deleting application:', err);
      return { success: false, error: 'Failed to delete application' };
    }
  }, [refreshApplications]);

  // ============================================================================
  // APPLICATION EVENT CRUD OPERATIONS (New PUR/Tank Mix system)
  // ============================================================================
  const saveApplicationEvent = useCallback(async (eventData, isEdit = false) => {
    try {
      if (isEdit) {
        await applicationEventsAPI.update(eventData.id, eventData);
      } else {
        await applicationEventsAPI.create(eventData);
      }
      await refreshApplicationEvents();
      return { success: true };
    } catch (err) {
      console.error('Error saving application event:', err);
      return {
        success: false,
        error: err.response?.data?.detail || err.message || 'Failed to save application event'
      };
    }
  }, [refreshApplicationEvents]);

  const deleteApplicationEvent = useCallback(async (eventId) => {
    try {
      await applicationEventsAPI.delete(eventId);
      await refreshApplicationEvents();
      return { success: true };
    } catch (err) {
      console.error('Error deleting application event:', err);
      return { success: false, error: 'Failed to delete application event' };
    }
  }, [refreshApplicationEvents]);

  // ============================================================================
  // WATER SOURCE CRUD OPERATIONS
  // ============================================================================
  const saveWaterSource = useCallback(async (waterSourceData, isEdit = false) => {
    try {
      if (isEdit) {
        await waterSourcesAPI.update(waterSourceData.id, waterSourceData);
      } else {
        await waterSourcesAPI.create(waterSourceData);
      }
      await refreshWaterSources();
      return { success: true };
    } catch (err) {
      console.error('Error saving water source:', err);
      return { success: false, error: 'Failed to save water source' };
    }
  }, [refreshWaterSources]);

  const deleteWaterSource = useCallback(async (sourceId) => {
    try {
      await waterSourcesAPI.delete(sourceId);
      // Deleting a water source may affect water tests
      await Promise.all([refreshWaterSources(), refreshWaterTests()]);
      return { success: true };
    } catch (err) {
      console.error('Error deleting water source:', err);
      return { success: false, error: 'Failed to delete water source' };
    }
  }, [refreshWaterSources, refreshWaterTests]);

  // ============================================================================
  // WATER TEST CRUD OPERATIONS
  // ============================================================================
  const saveWaterTest = useCallback(async (testData, isEdit = false) => {
    try {
      if (isEdit) {
        await waterTestsAPI.update(testData.id, testData);
      } else {
        await waterTestsAPI.create(testData);
      }
      await refreshWaterTests();
      return { success: true };
    } catch (err) {
      console.error('Error saving water test:', err);
      return { success: false, error: 'Failed to save water test' };
    }
  }, [refreshWaterTests]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  const value = {
    // State
    farms,
    fields,
    applications,
    products,
    waterSources,
    waterTests,
    crops,
    rootstocks,
    applicationEvents,
    unifiedProducts,
    applicators,
    loading,
    error,

    // Actions
    loadData,

    // Farm operations
    saveFarm,
    updateFarm,
    patchFarm,
    deleteFarm,

    // Field operations
    saveField,
    deleteField,

    // Application operations (legacy)
    saveApplication,
    deleteApplication,

    // Application event operations (new PUR/Tank Mix)
    saveApplicationEvent,
    deleteApplicationEvent,
    refreshApplicationEvents,
    refreshUnifiedProducts,
    refreshApplicators,

    // Water source operations
    saveWaterSource,
    deleteWaterSource,

    // Water test operations
    saveWaterTest,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK
// =============================================================================

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
