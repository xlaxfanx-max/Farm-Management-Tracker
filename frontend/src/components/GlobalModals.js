import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { farmsAPI } from '../services/api';

// Import all modal components
import FarmModal from './FarmModal';
import FieldModal from './FieldModal';
import ApplicationModal from './ApplicationModal';
import WaterSourceModal from './WaterSourceModal';
import WaterTestModal from './WaterTestModal';
import WellModal from './WellModal';
import WellReadingModal from './WellReadingModal';
import WellSourceModal from './WellSourceModal';
import HarvestModal from './HarvestModal';
import HarvestLoadModal from './HarvestLoadModal';
import HarvestLaborModal from './HarvestLaborModal';
import BuyerModal from './BuyerModal';
import LaborContractorModal from './LaborContractorModal';
import NutrientApplicationModal from './NutrientApplicationModal';
import FertilizerProductModal from './FertilizerProductModal';
import QuickHarvestModal from './QuickHarvestModal';
import BatchReadingModal from './BatchReadingModal';

// =============================================================================
// GLOBAL MODALS COMPONENT
// =============================================================================
// Centralized modal rendering - all modals in one place

export function GlobalModals() {
  const {
    farms,
    fields,
    products,
    waterSources,
    crops,
    rootstocks,
    saveFarm,
    saveField,
    saveApplication,
    saveWaterSource,
    saveWaterTest,
    loadData,
  } = useData();

  const {
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
    openBuyerModal,
    closeLaborContractorModal,
    openLaborContractorModal,
    closeNutrientAppModal,
    closeFertilizerProductModal,
    closeQuickHarvestModal,
    closeBatchReadingModal,
    openHarvestModal,
    triggerRefresh,
  } = useModal();

  const toast = useToast();

  // Refresh triggers for dropdown lists in modals (buyers, contractors)
  const [buyerRefreshTrigger, setBuyerRefreshTrigger] = useState(0);
  const [contractorRefreshTrigger, setContractorRefreshTrigger] = useState(0);

  const handleBuyerRefresh = () => {
    setBuyerRefreshTrigger(prev => prev + 1);
  };

  const handleContractorRefresh = () => {
    setContractorRefreshTrigger(prev => prev + 1);
  };

  // ============================================================================
  // FARM MODAL
  // ============================================================================
  const handleSaveFarm = async (farmData, newParcels = []) => {
    const result = await saveFarm(farmData, !!farmModal.data);
    if (result.success) {
      // Save any new parcels if provided
      if (newParcels.length > 0 && result.data?.id) {
        await farmsAPI.bulkAddParcels(
          result.data.id,
          newParcels.map(p => ({
            apn: p.apn,
            acreage: p.acreage,
            ownership_type: p.ownership_type,
            notes: p.notes
          })),
          false
        );
      }
      closeFarmModal();
    } else {
      throw new Error(result.error);
    }
  };

  // ============================================================================
  // FIELD MODAL
  // ============================================================================
  const handleSaveField = async (fieldData) => {
    const result = await saveField(fieldData, !!fieldModal.data);
    if (result.success) {
      closeFieldModal();
    } else {
      toast.error(result.error);
    }
  };

  // ============================================================================
  // APPLICATION MODAL — new modal saves via applicationEventsAPI internally
  // ============================================================================
  const handleSaveApplication = async () => {
    // Modal handles its own save and close; just refresh data
    await loadData();
  };

  // ============================================================================
  // WATER SOURCE MODAL
  // ============================================================================
  const handleSaveWaterSource = async (waterSourceData) => {
    const result = await saveWaterSource(waterSourceData, !!waterSourceModal.data);
    if (result.success) {
      closeWaterSourceModal();
    } else {
      toast.error(result.error);
    }
  };

  // ============================================================================
  // WATER TEST MODAL
  // ============================================================================
  const handleSaveWaterTest = async (testData) => {
    const result = await saveWaterTest(testData, !!waterTestModal.data);
    if (result.success) {
      closeWaterTestModal();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      {/* Farm Modal */}
      {farmModal.isOpen && (
        <FarmModal
          farm={farmModal.data}
          onSave={handleSaveFarm}
          onClose={closeFarmModal}
        />
      )}

      {/* Field Modal */}
      {fieldModal.isOpen && (
        <FieldModal
          field={fieldModal.data}
          farms={farms}
          crops={crops}
          rootstocks={rootstocks}
          preselectedFarmId={fieldModal.preselectedFarmId}
          onSave={handleSaveField}
          onClose={closeFieldModal}
        />
      )}

      {/* Application Modal */}
      {applicationModal.isOpen && (
        <ApplicationModal
          application={applicationModal.data}
          farms={farms}
          fields={fields}
          products={products}
          onSave={handleSaveApplication}
          onClose={closeApplicationModal}
        />
      )}

      {/* Water Source Modal */}
      {waterSourceModal.isOpen && (
        <WaterSourceModal
          source={waterSourceModal.data}
          farms={farms}
          fields={fields}
          onSave={handleSaveWaterSource}
          onClose={closeWaterSourceModal}
        />
      )}

      {/* Water Test Modal */}
      {waterTestModal.isOpen && (
        <WaterTestModal
          waterTest={waterTestModal.data}
          waterSource={waterTestModal.selectedWaterSource}
          waterSources={waterSources}
          onSave={handleSaveWaterTest}
          onClose={closeWaterTestModal}
        />
      )}

      {/* Well Modal */}
      {wellModal.isOpen && (
        <WellModal
          isOpen={wellModal.isOpen}
          onClose={closeWellModal}
          well={wellModal.data}
          waterSources={waterSources}
          onSave={() => {
            loadData();
            closeWellModal();
          }}
        />
      )}

      {/* Well Reading Modal */}
      {wellReadingModal.isOpen && (
        <WellReadingModal
          isOpen={wellReadingModal.isOpen}
          onClose={closeWellReadingModal}
          reading={wellReadingModal.reading}
          wellId={wellReadingModal.wellId}
          wellName={wellReadingModal.wellName}
          onSave={() => {
            loadData();
            closeWellReadingModal();
          }}
        />
      )}

      {/* Well Source Modal */}
      {wellSourceModal.isOpen && (
        <WellSourceModal
          isOpen={wellSourceModal.isOpen}
          wellSource={wellSourceModal.data}
          farms={farms}
          fields={fields}
          onSave={() => {
            loadData();
            closeWellSourceModal();
          }}
          onClose={closeWellSourceModal}
        />
      )}

      {/* Harvest Modal */}
      {harvestModal.isOpen && (
        <HarvestModal
          isOpen={harvestModal.isOpen}
          onClose={closeHarvestModal}
          onSave={() => triggerRefresh('harvests')}
          harvest={harvestModal.data}
          fields={fields}
          farms={farms}
          preselectedFieldId={harvestModal.preselectedFieldId}
        />
      )}

      {/* Harvest Load Modal */}
      {harvestLoadModal.isOpen && (
        <HarvestLoadModal
          isOpen={harvestLoadModal.isOpen}
          onClose={closeHarvestLoadModal}
          onSave={() => triggerRefresh('harvests')}
          harvestId={harvestLoadModal.harvestId}
          load={harvestLoadModal.data}
          onAddBuyer={openBuyerModal}
          buyerRefreshTrigger={buyerRefreshTrigger}
        />
      )}

      {/* Harvest Labor Modal */}
      {harvestLaborModal.isOpen && (
        <HarvestLaborModal
          isOpen={harvestLaborModal.isOpen}
          onClose={closeHarvestLaborModal}
          onSave={() => triggerRefresh('harvests')}
          harvestId={harvestLaborModal.harvestId}
          labor={harvestLaborModal.data}
          onAddContractor={openLaborContractorModal}
          contractorRefreshTrigger={contractorRefreshTrigger}
        />
      )}

      {/* Buyer Modal */}
      {buyerModal.isOpen && (
        <BuyerModal
          isOpen={buyerModal.isOpen}
          onClose={closeBuyerModal}
          onSave={() => {
            triggerRefresh('harvests');
            handleBuyerRefresh();
          }}
        />
      )}

      {/* Labor Contractor Modal */}
      {laborContractorModal.isOpen && (
        <LaborContractorModal
          isOpen={laborContractorModal.isOpen}
          onClose={closeLaborContractorModal}
          onSave={() => {
            triggerRefresh('harvests');
            handleContractorRefresh();
          }}
        />
      )}

      {/* Nutrient Application Modal */}
      {nutrientAppModal.isOpen && (
        <NutrientApplicationModal
          isOpen={nutrientAppModal.isOpen}
          application={nutrientAppModal.data}
          farms={farms}
          fields={fields}
          waterSources={waterSources}
          onSave={() => {
            triggerRefresh('nutrients');
            closeNutrientAppModal();
          }}
          onClose={closeNutrientAppModal}
        />
      )}

      {/* Fertilizer Product Modal */}
      {fertilizerProductModal.isOpen && (
        <FertilizerProductModal
          isOpen={fertilizerProductModal.isOpen}
          product={fertilizerProductModal.data}
          onSave={() => {
            triggerRefresh('nutrients');
            closeFertilizerProductModal();
          }}
          onClose={closeFertilizerProductModal}
        />
      )}

      {/* Quick Harvest Modal */}
      {quickHarvestModal.isOpen && (
        <QuickHarvestModal
          isOpen={quickHarvestModal.isOpen}
          onClose={closeQuickHarvestModal}
          onSave={() => triggerRefresh('harvests')}
          fields={fields}
          onSwitchToAdvanced={(formData) => {
            // Pass form data from quick modal to full modal
            openHarvestModal({ ...formData, isFromQuickMode: true }, formData.field);
          }}
        />
      )}

      {/* Batch Reading Modal */}
      {batchReadingModal.isOpen && (
        <BatchReadingModal
          isOpen={batchReadingModal.isOpen}
          onClose={closeBatchReadingModal}
          wells={batchReadingModal.wells}
          onSave={loadData}
        />
      )}
    </>
  );
}

export default GlobalModals;
