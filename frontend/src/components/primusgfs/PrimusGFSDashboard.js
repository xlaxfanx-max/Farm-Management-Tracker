import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy } from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// Section navigation
import SectionNav from './SectionNav';
import WhatsNextDashboard from './WhatsNextDashboard';
import OverviewTab from './OverviewTab';
import SeasonCopyModal from './SeasonCopyModal';
import SetupWizard from './SetupWizard';

// Sub-module components
import DocumentControlList from './DocumentControlList';
import InternalAuditList from './InternalAuditList';
import CorrectiveActionTracker from './CorrectiveActionTracker';
import LandHistoryForm from './LandHistoryForm';
import SupplierManagement from './SupplierManagement';
import MockRecallExercise from './MockRecallExercise';
import FoodDefensePlanView from './FoodDefensePlan';
import FieldSanitationTracker from './FieldSanitationTracker';
import EquipmentCalibrationView from './EquipmentCalibration';
import PestControlProgramView from './PestControlProgram';
import PreHarvestInspectionView from './PreHarvestInspection';
// CAC Food Safety Manual V5.0 additions
import FoodSafetyProfile from './FoodSafetyProfile';
import OrgRoles from './OrgRoles';
import CommitteeMeetings from './CommitteeMeetings';
import ManagementReview from './ManagementReview';
import TrainingMatrix from './TrainingMatrix';
import TrainingSessions from './TrainingSessions';
import PerimeterMonitoring from './PerimeterMonitoring';
import PreSeasonChecklist from './PreSeasonChecklist';
import FieldRiskAssessment from './FieldRiskAssessment';
import NonConformanceLog from './NonConformanceLog';
import ProductHolds from './ProductHolds';
import SupplierVerification from './SupplierVerification';
import FoodFraudAssessment from './FoodFraudAssessment';
import EmergencyContacts from './EmergencyContacts';
import ChemicalInventory from './ChemicalInventory';
import SanitationMaintenance from './SanitationMaintenance';
import CACManualViewer from './CACManualViewer';
import AuditBinderDashboard from './audit-binder/AuditBinderDashboard';

/**
 * PrimusGFSDashboard — Main dashboard for Primus GFS compliance.
 *
 * Uses a grouped sidebar navigation (SectionNav) instead of the
 * old 29-tab horizontal nav.  Layout: sidebar (w-64) + content area.
 */
const PrimusGFSDashboard = ({ onNavigate, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(
    () => localStorage.getItem('primusgfs_wizard_dismissed') === 'true'
  );

  // Sync when initialTab prop changes (URL-based navigation)
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getDashboard();
      setDashboardData(response.data);
    } catch (err) {
      console.error('Error loading Primus GFS dashboard:', err);
      setError('Failed to load Primus GFS compliance data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Extract module scores for the SectionNav badges
  const moduleScores = dashboardData?.module_scores || {};

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Primus GFS Compliance
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Good Agricultural Practices audit readiness and tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCopyModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy Season
          </button>
          <button
            onClick={loadDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* Sidebar Navigation */}
        <SectionNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          scores={moduleScores}
        />

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {!wizardDismissed && (
                <SetupWizard
                  onTabChange={setActiveTab}
                  onDismiss={() => {
                    setWizardDismissed(true);
                    localStorage.setItem('primusgfs_wizard_dismissed', 'true');
                  }}
                />
              )}
              <WhatsNextDashboard onTabChange={setActiveTab} />
            </div>
          )}
          {activeTab === 'full-overview' && (
            <OverviewTab
              data={dashboardData}
              error={error}
              onTabChange={setActiveTab}
              onRefresh={loadDashboardData}
            />
          )}
          {activeTab === 'cac-manual' && <CACManualViewer onTabChange={setActiveTab} />}
          {activeTab === 'profile' && <FoodSafetyProfile />}
          {activeTab === 'org-roles' && <OrgRoles />}
          {activeTab === 'committee' && <CommitteeMeetings />}
          {activeTab === 'mgmt-review' && <ManagementReview />}
          {activeTab === 'documents' && <DocumentControlList />}
          {activeTab === 'audits' && <InternalAuditList />}
          {activeTab === 'corrective-actions' && <CorrectiveActionTracker />}
          {activeTab === 'non-conformance' && <NonConformanceLog />}
          {activeTab === 'product-holds' && <ProductHolds />}
          {activeTab === 'training-matrix' && <TrainingMatrix />}
          {activeTab === 'training-sessions' && <TrainingSessions />}
          {activeTab === 'land' && <LandHistoryForm />}
          {activeTab === 'suppliers' && <SupplierManagement />}
          {activeTab === 'supplier-verify' && <SupplierVerification />}
          {activeTab === 'recalls' && <MockRecallExercise />}
          {activeTab === 'food-defense' && <FoodDefensePlanView />}
          {activeTab === 'food-fraud' && <FoodFraudAssessment />}
          {activeTab === 'emergency' && <EmergencyContacts />}
          {activeTab === 'pre-season' && <PreSeasonChecklist />}
          {activeTab === 'field-risk' && <FieldRiskAssessment />}
          {activeTab === 'perimeter' && <PerimeterMonitoring />}
          {activeTab === 'sanitation' && <FieldSanitationTracker />}
          {activeTab === 'sanitation-maint' && <SanitationMaintenance />}
          {activeTab === 'chemical-inv' && <ChemicalInventory />}
          {activeTab === 'calibration' && <EquipmentCalibrationView />}
          {activeTab === 'pest-control' && <PestControlProgramView />}
          {activeTab === 'pre-harvest' && <PreHarvestInspectionView />}
          {activeTab === 'audit-binder' && <AuditBinderDashboard />}
        </div>
      </div>

      {/* Season Copy Modal */}
      {showCopyModal && (
        <SeasonCopyModal
          onClose={() => setShowCopyModal(false)}
          onCopied={loadDashboardData}
        />
      )}
    </div>
  );
};

export default PrimusGFSDashboard;
