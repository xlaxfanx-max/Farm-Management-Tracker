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

const DataContext = createContext(null);

const extractResults = (res) => res.data.results || res.data || [];

// =============================================================================
// CRUD FACTORY — eliminates repeated save/delete boilerplate
// =============================================================================

function extractErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (!data) return err.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  const fieldErrors = Object.entries(data)
    .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
    .join('\n');
  return fieldErrors || fallback;
}

function makeSave(api, refreshFn, label, { cleanData, refreshExtra } = {}) {
  return async (data, isEdit = false) => {
    try {
      const payload = cleanData ? cleanData(data) : data;
      let response;
      if (isEdit) {
        response = await api.update(data.id, payload);
      } else {
        response = await api.create(payload);
      }
      if (refreshExtra) {
        await Promise.all([refreshFn(), refreshExtra()]);
      } else {
        await refreshFn();
      }
      return { success: true, data: response?.data };
    } catch (err) {
      console.error(`Error saving ${label}:`, err);
      return { success: false, error: extractErrorMessage(err, `Failed to save ${label}`) };
    }
  };
}

function makeDelete(api, refreshFn, label, { refreshExtra } = {}) {
  return async (id) => {
    try {
      await api.delete(id);
      if (refreshExtra) {
        await Promise.all([refreshFn(), refreshExtra()]);
      } else {
        await refreshFn();
      }
      return { success: true };
    } catch (err) {
      console.error(`Error deleting ${label}:`, err);
      return { success: false, error: `Failed to delete ${label}` };
    }
  };
}

// =============================================================================
// DATA PROVIDER
// =============================================================================

export function DataProvider({ children }) {
  const { isAuthenticated, currentCompany } = useAuth();

  // State
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [applications, setApplications] = useState([]);
  const [products, setProducts] = useState([]);
  const [waterSources, setWaterSources] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  const [crops, setCrops] = useState([]);
  const [rootstocks, setRootstocks] = useState([]);
  const [applicationEvents, setApplicationEvents] = useState([]);
  const [unifiedProducts, setUnifiedProducts] = useState([]);
  const [applicators, setApplicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refresh helpers
  const refreshFarms = useCallback(async () => setFarms(extractResults(await farmsAPI.getAll())), []);
  const refreshFields = useCallback(async () => setFields(extractResults(await fieldsAPI.getAll())), []);
  const refreshApplications = useCallback(async () => setApplications(extractResults(await applicationsAPI.getAll())), []);
  const refreshWaterSources = useCallback(async () => setWaterSources(extractResults(await waterSourcesAPI.getAll())), []);
  const refreshWaterTests = useCallback(async () => setWaterTests(extractResults(await waterTestsAPI.getAll())), []);
  const refreshApplicationEvents = useCallback(async () => setApplicationEvents(extractResults(await applicationEventsAPI.getAll())), []);
  const refreshUnifiedProducts = useCallback(async () => setUnifiedProducts(extractResults(await unifiedProductsAPI.getAll())), []);
  const refreshApplicators = useCallback(async () => setApplicators(extractResults(await applicatorsAPI.getAll())), []);

  // Initial load
  const loadData = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [farmsRes, fieldsRes, appsRes, productsRes, wsRes, wtRes, cropsRes, rsRes, aeRes, upRes, appRes] = await Promise.all([
        farmsAPI.getAll(), fieldsAPI.getAll(), applicationsAPI.getAll(),
        productsAPI.getAll(), waterSourcesAPI.getAll(), waterTestsAPI.getAll(),
        cropsAPI.getAll(), rootstocksAPI.getAll(), applicationEventsAPI.getAll(),
        unifiedProductsAPI.getAll(), applicatorsAPI.getAll(),
      ]);
      setFarms(extractResults(farmsRes));
      setFields(extractResults(fieldsRes));
      setApplications(extractResults(appsRes));
      setProducts(extractResults(productsRes));
      setWaterSources(extractResults(wsRes));
      setWaterTests(extractResults(wtRes));
      setCrops(extractResults(cropsRes));
      setRootstocks(extractResults(rsRes));
      setApplicationEvents(extractResults(aeRes));
      setUnifiedProducts(extractResults(upRes));
      setApplicators(extractResults(appRes));
    } catch (err) {
      setError('Failed to load data. Please check your connection.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && currentCompany) loadData();
  }, [isAuthenticated, currentCompany, loadData]);

  // CRUD operations (generated via factories)
  const saveFarm = useCallback(makeSave(farmsAPI, refreshFarms, 'farm'), [refreshFarms]);
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
  const deleteFarm = useCallback(makeDelete(farmsAPI, refreshFarms, 'farm', { refreshExtra: refreshFields }), [refreshFarms, refreshFields]);
  const saveField = useCallback(makeSave(fieldsAPI, refreshFields, 'field'), [refreshFields]);
  const deleteField = useCallback(makeDelete(fieldsAPI, refreshFields, 'field'), [refreshFields]);

  const saveApplication = useCallback(makeSave(applicationsAPI, refreshApplications, 'application', {
    cleanData: (d) => ({
      ...d,
      field: d.field ? parseInt(d.field) : null,
      product: d.product ? parseInt(d.product) : null,
      acres_treated: d.acres_treated ? parseFloat(d.acres_treated) : null,
      amount_used: d.amount_used ? parseFloat(d.amount_used) : null,
      temperature: d.temperature ? parseFloat(d.temperature) : null,
      wind_speed: d.wind_speed ? parseFloat(d.wind_speed) : null,
    }),
  }), [refreshApplications]);
  const deleteApplication = useCallback(makeDelete(applicationsAPI, refreshApplications, 'application'), [refreshApplications]);

  const saveApplicationEvent = useCallback(makeSave(applicationEventsAPI, refreshApplicationEvents, 'application event'), [refreshApplicationEvents]);
  const deleteApplicationEvent = useCallback(makeDelete(applicationEventsAPI, refreshApplicationEvents, 'application event'), [refreshApplicationEvents]);

  const saveWaterSource = useCallback(makeSave(waterSourcesAPI, refreshWaterSources, 'water source'), [refreshWaterSources]);
  const deleteWaterSource = useCallback(makeDelete(waterSourcesAPI, refreshWaterSources, 'water source', { refreshExtra: refreshWaterTests }), [refreshWaterSources, refreshWaterTests]);
  const saveWaterTest = useCallback(makeSave(waterTestsAPI, refreshWaterTests, 'water test'), [refreshWaterTests]);

  const value = {
    farms, fields, applications, products, waterSources, waterTests,
    crops, rootstocks, applicationEvents, unifiedProducts, applicators,
    loading, error, loadData,
    saveFarm, updateFarm, patchFarm, deleteFarm,
    saveField, deleteField,
    saveApplication, deleteApplication,
    saveApplicationEvent, deleteApplicationEvent,
    refreshApplicationEvents, refreshUnifiedProducts, refreshApplicators,
    saveWaterSource, deleteWaterSource, saveWaterTest,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
}

export default DataContext;
