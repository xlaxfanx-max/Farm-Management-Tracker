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
  rootstocksAPI
} from '../services/api';

// Create context
const DataContext = createContext(null);

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ============================================================================
  // LOAD DATA
  // ============================================================================
  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [farmsRes, fieldsRes, appsRes, productsRes, waterSourcesRes, waterTestsRes, cropsRes, rootstocksRes] = await Promise.all([
        farmsAPI.getAll(),
        fieldsAPI.getAll(),
        applicationsAPI.getAll(),
        productsAPI.getAll(),
        waterSourcesAPI.getAll(),
        waterTestsAPI.getAll(),
        cropsAPI.getAll(),
        rootstocksAPI.getAll()
      ]);

      setFarms(farmsRes.data.results || farmsRes.data || []);
      setFields(fieldsRes.data.results || fieldsRes.data || []);
      setApplications(appsRes.data.results || appsRes.data || []);
      setProducts(productsRes.data.results || productsRes.data || []);
      setWaterSources(waterSourcesRes.data.results || waterSourcesRes.data || []);
      setWaterTests(waterTestsRes.data.results || waterTestsRes.data || []);
      setCrops(cropsRes.data.results || cropsRes.data || []);
      setRootstocks(rootstocksRes.data.results || rootstocksRes.data || []);
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
      if (isEdit) {
        await farmsAPI.update(farmData.id, farmData);
      } else {
        await farmsAPI.create(farmData);
      }
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error saving farm:', err);
      return { success: false, error: 'Failed to save farm' };
    }
  }, [loadData]);

  const updateFarm = useCallback(async (farmId, farmData) => {
    try {
      await farmsAPI.update(farmId, farmData);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error updating farm:', err);
      return { success: false, error: 'Failed to update farm' };
    }
  }, [loadData]);

  // Partial update for farms (uses PATCH instead of PUT)
  const patchFarm = useCallback(async (farmId, partialData) => {
    try {
      await farmsAPI.patch(farmId, partialData);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error patching farm:', err);
      return { success: false, error: 'Failed to update farm' };
    }
  }, [loadData]);

  const deleteFarm = useCallback(async (farmId) => {
    try {
      await farmsAPI.delete(farmId);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error deleting farm:', err);
      return { success: false, error: 'Failed to delete farm' };
    }
  }, [loadData]);

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
      await loadData();
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
  }, [loadData]);

  const deleteField = useCallback(async (fieldId) => {
    try {
      await fieldsAPI.delete(fieldId);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error deleting field:', err);
      return { success: false, error: 'Failed to delete field' };
    }
  }, [loadData]);

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
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error saving application:', err);
      console.error('Error response:', err.response?.data);
      return {
        success: false,
        error: err.response?.data?.detail || err.message || 'Failed to save application'
      };
    }
  }, [loadData]);

  const deleteApplication = useCallback(async (appId) => {
    try {
      await applicationsAPI.delete(appId);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error deleting application:', err);
      return { success: false, error: 'Failed to delete application' };
    }
  }, [loadData]);

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
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error saving water source:', err);
      return { success: false, error: 'Failed to save water source' };
    }
  }, [loadData]);

  const deleteWaterSource = useCallback(async (sourceId) => {
    try {
      await waterSourcesAPI.delete(sourceId);
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error deleting water source:', err);
      return { success: false, error: 'Failed to delete water source' };
    }
  }, [loadData]);

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
      await loadData();
      return { success: true };
    } catch (err) {
      console.error('Error saving water test:', err);
      return { success: false, error: 'Failed to save water test' };
    }
  }, [loadData]);

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

    // Application operations
    saveApplication,
    deleteApplication,

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
