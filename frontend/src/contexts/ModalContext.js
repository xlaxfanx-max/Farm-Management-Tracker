import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Create context
const ModalContext = createContext(null);

// =============================================================================
// MODAL PROVIDER COMPONENT
// =============================================================================

export function ModalProvider({ children }) {
  // ============================================================================
  // FARM MODAL STATE
  // ============================================================================
  const [farmModal, setFarmModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // FIELD MODAL STATE
  // ============================================================================
  const [fieldModal, setFieldModal] = useState({
    isOpen: false,
    data: null,
    preselectedFarmId: null,
  });

  // ============================================================================
  // APPLICATION MODAL STATE
  // ============================================================================
  const [applicationModal, setApplicationModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // WATER SOURCE MODAL STATE
  // ============================================================================
  const [waterSourceModal, setWaterSourceModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // WATER TEST MODAL STATE
  // ============================================================================
  const [waterTestModal, setWaterTestModal] = useState({
    isOpen: false,
    data: null,
    selectedWaterSource: null,
  });

  // ============================================================================
  // WELL MODAL STATE
  // ============================================================================
  const [wellModal, setWellModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // WELL READING MODAL STATE
  // ============================================================================
  const [wellReadingModal, setWellReadingModal] = useState({
    isOpen: false,
    wellId: null,
    wellName: null,
  });

  // ============================================================================
  // WELL SOURCE MODAL STATE
  // ============================================================================
  const [wellSourceModal, setWellSourceModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // HARVEST MODAL STATE
  // ============================================================================
  const [harvestModal, setHarvestModal] = useState({
    isOpen: false,
    data: null,
    preselectedFieldId: null,
  });

  // ============================================================================
  // HARVEST LOAD MODAL STATE
  // ============================================================================
  const [harvestLoadModal, setHarvestLoadModal] = useState({
    isOpen: false,
    harvestId: null,
    data: null,
  });

  // ============================================================================
  // HARVEST LABOR MODAL STATE
  // ============================================================================
  const [harvestLaborModal, setHarvestLaborModal] = useState({
    isOpen: false,
    harvestId: null,
    data: null,
  });

  // ============================================================================
  // BUYER MODAL STATE
  // ============================================================================
  const [buyerModal, setBuyerModal] = useState({
    isOpen: false,
  });

  // ============================================================================
  // LABOR CONTRACTOR MODAL STATE
  // ============================================================================
  const [laborContractorModal, setLaborContractorModal] = useState({
    isOpen: false,
  });

  // ============================================================================
  // NUTRIENT APPLICATION MODAL STATE
  // ============================================================================
  const [nutrientAppModal, setNutrientAppModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // FERTILIZER PRODUCT MODAL STATE
  // ============================================================================
  const [fertilizerProductModal, setFertilizerProductModal] = useState({
    isOpen: false,
    data: null,
  });

  // ============================================================================
  // QUICK HARVEST MODAL STATE
  // ============================================================================
  const [quickHarvestModal, setQuickHarvestModal] = useState({
    isOpen: false,
  });

  // ============================================================================
  // BATCH READING MODAL STATE
  // ============================================================================
  const [batchReadingModal, setBatchReadingModal] = useState({
    isOpen: false,
    wells: [],
  });

  // ============================================================================
  // REFRESH CALLBACKS REGISTRY
  // ============================================================================
  // Components can register their refresh functions here
  const refreshCallbacks = useRef({
    harvests: null,
    nutrients: null,
    buyers: null,
    contractors: null,
  });

  // Register a refresh callback for a specific data type
  const registerRefreshCallback = useCallback((type, callback) => {
    refreshCallbacks.current[type] = callback;
  }, []);

  // Unregister a refresh callback
  const unregisterRefreshCallback = useCallback((type) => {
    refreshCallbacks.current[type] = null;
  }, []);

  // Trigger refresh for specific data types
  const triggerRefresh = useCallback((types) => {
    const typesArray = Array.isArray(types) ? types : [types];
    typesArray.forEach(type => {
      if (refreshCallbacks.current[type]) {
        refreshCallbacks.current[type]();
      }
    });
  }, []);

  // ============================================================================
  // FARM MODAL ACTIONS
  // ============================================================================
  const openFarmModal = useCallback((farm = null) => {
    setFarmModal({ isOpen: true, data: farm });
  }, []);

  const closeFarmModal = useCallback(() => {
    setFarmModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // FIELD MODAL ACTIONS
  // ============================================================================
  const openFieldModal = useCallback((field = null, preselectedFarmId = null) => {
    setFieldModal({ isOpen: true, data: field, preselectedFarmId });
  }, []);

  const closeFieldModal = useCallback(() => {
    setFieldModal({ isOpen: false, data: null, preselectedFarmId: null });
  }, []);

  // ============================================================================
  // APPLICATION MODAL ACTIONS
  // ============================================================================
  const openApplicationModal = useCallback((application = null) => {
    setApplicationModal({ isOpen: true, data: application });
  }, []);

  const closeApplicationModal = useCallback(() => {
    setApplicationModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // WATER SOURCE MODAL ACTIONS
  // ============================================================================
  const openWaterSourceModal = useCallback((waterSource = null) => {
    setWaterSourceModal({ isOpen: true, data: waterSource });
  }, []);

  const closeWaterSourceModal = useCallback(() => {
    setWaterSourceModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // WATER TEST MODAL ACTIONS
  // ============================================================================
  const openWaterTestModal = useCallback((waterTest = null, waterSource = null) => {
    setWaterTestModal({ isOpen: true, data: waterTest, selectedWaterSource: waterSource });
  }, []);

  const closeWaterTestModal = useCallback(() => {
    setWaterTestModal({ isOpen: false, data: null, selectedWaterSource: null });
  }, []);

  // ============================================================================
  // WELL MODAL ACTIONS
  // ============================================================================
  const openWellModal = useCallback((well = null) => {
    setWellModal({ isOpen: true, data: well });
  }, []);

  const closeWellModal = useCallback(() => {
    setWellModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // WELL READING MODAL ACTIONS
  // ============================================================================
  const openWellReadingModal = useCallback((wellId, wellName) => {
    setWellReadingModal({ isOpen: true, wellId, wellName });
  }, []);

  const closeWellReadingModal = useCallback(() => {
    setWellReadingModal({ isOpen: false, wellId: null, wellName: null });
  }, []);

  // ============================================================================
  // WELL SOURCE MODAL ACTIONS
  // ============================================================================
  const openWellSourceModal = useCallback((wellSource = null) => {
    setWellSourceModal({ isOpen: true, data: wellSource });
  }, []);

  const closeWellSourceModal = useCallback(() => {
    setWellSourceModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // HARVEST MODAL ACTIONS
  // ============================================================================
  const openHarvestModal = useCallback((harvest = null, preselectedFieldId = null) => {
    setHarvestModal({ isOpen: true, data: harvest, preselectedFieldId });
  }, []);

  const closeHarvestModal = useCallback(() => {
    setHarvestModal({ isOpen: false, data: null, preselectedFieldId: null });
  }, []);

  // ============================================================================
  // HARVEST LOAD MODAL ACTIONS
  // ============================================================================
  const openHarvestLoadModal = useCallback((harvestId, load = null) => {
    setHarvestLoadModal({ isOpen: true, harvestId, data: load });
  }, []);

  const closeHarvestLoadModal = useCallback(() => {
    setHarvestLoadModal({ isOpen: false, harvestId: null, data: null });
  }, []);

  // ============================================================================
  // HARVEST LABOR MODAL ACTIONS
  // ============================================================================
  const openHarvestLaborModal = useCallback((harvestId, labor = null) => {
    setHarvestLaborModal({ isOpen: true, harvestId, data: labor });
  }, []);

  const closeHarvestLaborModal = useCallback(() => {
    setHarvestLaborModal({ isOpen: false, harvestId: null, data: null });
  }, []);

  // ============================================================================
  // BUYER MODAL ACTIONS
  // ============================================================================
  const openBuyerModal = useCallback(() => {
    setBuyerModal({ isOpen: true });
  }, []);

  const closeBuyerModal = useCallback(() => {
    setBuyerModal({ isOpen: false });
  }, []);

  // ============================================================================
  // LABOR CONTRACTOR MODAL ACTIONS
  // ============================================================================
  const openLaborContractorModal = useCallback(() => {
    setLaborContractorModal({ isOpen: true });
  }, []);

  const closeLaborContractorModal = useCallback(() => {
    setLaborContractorModal({ isOpen: false });
  }, []);

  // ============================================================================
  // NUTRIENT APPLICATION MODAL ACTIONS
  // ============================================================================
  const openNutrientAppModal = useCallback((application = null) => {
    setNutrientAppModal({ isOpen: true, data: application });
  }, []);

  const closeNutrientAppModal = useCallback(() => {
    setNutrientAppModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // FERTILIZER PRODUCT MODAL ACTIONS
  // ============================================================================
  const openFertilizerProductModal = useCallback((product = null) => {
    setFertilizerProductModal({ isOpen: true, data: product });
  }, []);

  const closeFertilizerProductModal = useCallback(() => {
    setFertilizerProductModal({ isOpen: false, data: null });
  }, []);

  // ============================================================================
  // QUICK HARVEST MODAL ACTIONS
  // ============================================================================
  const openQuickHarvestModal = useCallback(() => {
    setQuickHarvestModal({ isOpen: true });
  }, []);

  const closeQuickHarvestModal = useCallback(() => {
    setQuickHarvestModal({ isOpen: false });
  }, []);

  // ============================================================================
  // BATCH READING MODAL ACTIONS
  // ============================================================================
  const openBatchReadingModal = useCallback((wells = []) => {
    setBatchReadingModal({ isOpen: true, wells });
  }, []);

  const closeBatchReadingModal = useCallback(() => {
    setBatchReadingModal({ isOpen: false, wells: [] });
  }, []);

  // ============================================================================
  // GENERIC CLOSE FUNCTION
  // ============================================================================
  const closeModal = useCallback((modalType) => {
    switch (modalType) {
      case 'farm':
        closeFarmModal();
        break;
      case 'field':
        closeFieldModal();
        break;
      case 'application':
        closeApplicationModal();
        break;
      case 'waterSource':
        closeWaterSourceModal();
        break;
      case 'waterTest':
        closeWaterTestModal();
        break;
      case 'well':
        closeWellModal();
        break;
      case 'wellReading':
        closeWellReadingModal();
        break;
      case 'wellSource':
        closeWellSourceModal();
        break;
      case 'harvest':
        closeHarvestModal();
        break;
      case 'harvestLoad':
        closeHarvestLoadModal();
        break;
      case 'harvestLabor':
        closeHarvestLaborModal();
        break;
      case 'buyer':
        closeBuyerModal();
        break;
      case 'laborContractor':
        closeLaborContractorModal();
        break;
      case 'nutrientApp':
        closeNutrientAppModal();
        break;
      case 'fertilizerProduct':
        closeFertilizerProductModal();
        break;
      case 'quickHarvest':
        closeQuickHarvestModal();
        break;
      case 'batchReading':
        closeBatchReadingModal();
        break;
      default:
        console.warn(`Unknown modal type: ${modalType}`);
    }
  }, [
    closeFarmModal,
    closeFieldModal,
    closeApplicationModal,
    closeWaterSourceModal,
    closeWaterTestModal,
    closeWellModal,
    closeWellReadingModal,
    closeWellSourceModal,
    closeHarvestModal,
    closeHarvestLoadModal,
    closeHarvestLaborModal,
    closeBuyerModal,
    closeLaborContractorModal,
    closeNutrientAppModal,
    closeFertilizerProductModal,
    closeQuickHarvestModal,
    closeBatchReadingModal,
  ]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================
  const value = {
    // Modal states
    farmModal,
    fieldModal,
    applicationModal,
    waterSourceModal,
    waterTestModal,
    wellModal,
    wellReadingModal,
    wellSourceModal,
    harvestModal,
    harvestLoadModal,
    harvestLaborModal,
    buyerModal,
    laborContractorModal,
    nutrientAppModal,
    fertilizerProductModal,
    quickHarvestModal,
    batchReadingModal,

    // Farm actions
    openFarmModal,
    closeFarmModal,

    // Field actions
    openFieldModal,
    closeFieldModal,

    // Application actions
    openApplicationModal,
    closeApplicationModal,

    // Water source actions
    openWaterSourceModal,
    closeWaterSourceModal,

    // Water test actions
    openWaterTestModal,
    closeWaterTestModal,

    // Well actions
    openWellModal,
    closeWellModal,

    // Well reading actions
    openWellReadingModal,
    closeWellReadingModal,

    // Well source actions
    openWellSourceModal,
    closeWellSourceModal,

    // Harvest actions
    openHarvestModal,
    closeHarvestModal,

    // Harvest load actions
    openHarvestLoadModal,
    closeHarvestLoadModal,

    // Harvest labor actions
    openHarvestLaborModal,
    closeHarvestLaborModal,

    // Buyer actions
    openBuyerModal,
    closeBuyerModal,

    // Labor contractor actions
    openLaborContractorModal,
    closeLaborContractorModal,

    // Nutrient application actions
    openNutrientAppModal,
    closeNutrientAppModal,

    // Fertilizer product actions
    openFertilizerProductModal,
    closeFertilizerProductModal,

    // Quick harvest actions
    openQuickHarvestModal,
    closeQuickHarvestModal,

    // Batch reading actions
    openBatchReadingModal,
    closeBatchReadingModal,

    // Generic close
    closeModal,

    // Refresh callback system
    registerRefreshCallback,
    unregisterRefreshCallback,
    triggerRefresh,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK
// =============================================================================

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}

export default ModalContext;
