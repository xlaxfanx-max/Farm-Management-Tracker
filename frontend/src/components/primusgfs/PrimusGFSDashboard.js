import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Map,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  RotateCcw,
  ShieldAlert,
  Droplets,
  Wrench,
  Bug,
  Clipboard,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
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

// Dark mode placeholder - replace with useTheme() hook when available
const isDarkMode = false;

/**
 * PrimusGFSDashboard Component
 *
 * Main dashboard for Primus GFS compliance module showing:
 * - Overall compliance score with SVG ring
 * - Module score cards (Document Control, Internal Audits, Corrective Actions, Land Assessments)
 * - Upcoming deadlines
 * - Tab-based navigation to sub-modules
 */
const PrimusGFSDashboard = ({ onNavigate, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Update activeTab when initialTab prop changes
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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'audits', label: 'Audits', icon: ClipboardCheck },
    { id: 'corrective-actions', label: 'Corrective Actions', icon: AlertTriangle },
    { id: 'land', label: 'Land History', icon: Map },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'recalls', label: 'Mock Recalls', icon: RotateCcw },
    { id: 'food-defense', label: 'Food Defense', icon: ShieldAlert },
    { id: 'sanitation', label: 'Sanitation', icon: Droplets },
    { id: 'calibration', label: 'Calibration', icon: Wrench },
    { id: 'pest-control', label: 'Pest Control', icon: Bug },
    { id: 'pre-harvest', label: 'Pre-Harvest', icon: Clipboard },
  ];

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
    <div className="p-6 space-y-6">
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
        <button
          onClick={loadDashboardData}
          className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 -mb-px overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-600 dark:text-green-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          data={dashboardData}
          error={error}
          onTabChange={setActiveTab}
          onRefresh={loadDashboardData}
        />
      )}
      {activeTab === 'documents' && <DocumentControlList />}
      {activeTab === 'audits' && <InternalAuditList />}
      {activeTab === 'corrective-actions' && <CorrectiveActionTracker />}
      {activeTab === 'land' && <LandHistoryForm />}
      {activeTab === 'suppliers' && <SupplierManagement />}
      {activeTab === 'recalls' && <MockRecallExercise />}
      {activeTab === 'food-defense' && <FoodDefensePlanView />}
      {activeTab === 'sanitation' && <FieldSanitationTracker />}
      {activeTab === 'calibration' && <EquipmentCalibrationView />}
      {activeTab === 'pest-control' && <PestControlProgramView />}
      {activeTab === 'pre-harvest' && <PreHarvestInspectionView />}
    </div>
  );
};

/**
 * Returns the SVG stroke color class based on a numeric score.
 * Green >= 80, Yellow >= 60, Red < 60.
 */
const getScoreStrokeColor = (score) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
};

/**
 * Returns Tailwind text color classes based on a numeric score.
 */
const getScoreTextColor = (score) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

/**
 * Returns a label for the score range.
 */
const getScoreLabel = (score) => {
  if (score >= 80) return 'Compliant';
  if (score >= 60) return 'Needs Attention';
  return 'Non-Compliant';
};

/**
 * SVG Ring Score Display
 */
const ScoreRing = ({ score, size = 120 }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = getScoreStrokeColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Score arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getScoreTextColor(score)}`}>
          {score}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">/ 100</span>
      </div>
    </div>
  );
};

/**
 * Overview Tab Component
 */
const OverviewTab = ({ data, error, onTabChange, onRefresh }) => {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No compliance data available
      </div>
    );
  }

  const overallScore = data.overall_score ?? 0;

  const modules = [
    {
      key: 'document_control',
      label: 'Document Control',
      icon: FileText,
      tab: 'documents',
      score: data.document_control_score ?? 0,
      stats: [
        { label: 'Total Documents', value: data.total_documents ?? 0 },
        { label: 'Pending Review', value: data.pending_reviews ?? 0 },
        { label: 'Overdue', value: data.overdue_documents ?? 0 },
      ],
    },
    {
      key: 'internal_audits',
      label: 'Internal Audits',
      icon: ClipboardCheck,
      tab: 'audits',
      score: data.audit_score ?? 0,
      stats: [
        { label: 'Completed', value: data.audits_completed ?? 0 },
        { label: 'Scheduled', value: data.audits_scheduled ?? 0 },
        { label: 'Open Findings', value: data.open_findings ?? 0 },
      ],
    },
    {
      key: 'corrective_actions',
      label: 'Corrective Actions',
      icon: AlertTriangle,
      tab: 'corrective-actions',
      score: data.corrective_action_score ?? 0,
      stats: [
        { label: 'Open', value: data.open_actions ?? 0 },
        { label: 'In Progress', value: data.in_progress_actions ?? 0 },
        { label: 'Overdue', value: data.overdue_actions ?? 0 },
      ],
    },
    {
      key: 'land_assessments',
      label: 'Land Assessments',
      icon: Map,
      tab: 'land',
      score: data.land_assessment_score ?? 0,
      stats: [
        { label: 'Assessed', value: data.assessed_fields ?? 0 },
        { label: 'Pending', value: data.pending_assessments ?? 0 },
        { label: 'Expired', value: data.expired_assessments ?? 0 },
      ],
    },
    {
      key: 'supplier_control',
      label: 'Supplier Control',
      icon: Truck,
      tab: 'suppliers',
      score: data.supplier_score ?? 0,
      stats: [
        { label: 'Approved', value: data.approved_suppliers ?? 0 },
        { label: 'Pending', value: data.pending_suppliers ?? 0 },
        { label: 'Due Review', value: data.suppliers_due_review ?? 0 },
      ],
    },
    {
      key: 'mock_recalls',
      label: 'Mock Recalls',
      icon: RotateCcw,
      tab: 'recalls',
      score: data.recall_score ?? 0,
      stats: [
        { label: 'Completed', value: data.recalls_completed ?? 0 },
        { label: 'Passed', value: data.recalls_passed ?? 0 },
        { label: 'Planned', value: data.recalls_planned ?? 0 },
      ],
    },
    {
      key: 'food_defense',
      label: 'Food Defense',
      icon: ShieldAlert,
      tab: 'food-defense',
      score: data.food_defense_score ?? 0,
      stats: [
        { label: 'Plans', value: data.food_defense_plans ?? 0 },
        { label: 'Approved', value: data.food_defense_approved ?? 0 },
        { label: 'Review Due', value: data.food_defense_review_due ?? 0 },
      ],
    },
    {
      key: 'field_sanitation',
      label: 'Field Sanitation',
      icon: Droplets,
      tab: 'sanitation',
      score: data.sanitation_score ?? 0,
      stats: [
        { label: 'Total Logs', value: data.sanitation_logs ?? 0 },
        { label: 'Compliant', value: data.sanitation_compliant ?? 0 },
        { label: 'Issues', value: data.sanitation_non_compliant ?? 0 },
      ],
    },
    {
      key: 'equipment_calibration',
      label: 'Equipment Calibration',
      icon: Wrench,
      tab: 'calibration',
      score: data.calibration_score ?? 0,
      stats: [
        { label: 'Total', value: data.calibrations_total ?? 0 },
        { label: 'Current', value: data.calibrations_current ?? 0 },
        { label: 'Overdue', value: data.calibrations_overdue ?? 0 },
      ],
    },
    {
      key: 'pest_control',
      label: 'Pest Control',
      icon: Bug,
      tab: 'pest-control',
      score: data.pest_control_score ?? 0,
      stats: [
        { label: 'Program', value: data.has_pest_program ? 'Yes' : 'No' },
        { label: 'Approved', value: data.pest_program_approved ? 'Yes' : 'No' },
        { label: 'Logs 30d', value: data.pest_inspections_30d ?? 0 },
      ],
    },
    {
      key: 'pre_harvest',
      label: 'Pre-Harvest',
      icon: Clipboard,
      tab: 'pre-harvest',
      score: data.pre_harvest_score ?? 0,
      stats: [
        { label: 'This Year', value: data.pre_harvest_this_year ?? 0 },
        { label: 'Passed', value: data.pre_harvest_passed ?? 0 },
        { label: 'Failed', value: data.pre_harvest_failed ?? 0 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Compliance Score */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Overall Compliance
            </h3>
            <ScoreRing score={overallScore} size={140} />
            <span className={`mt-3 text-sm font-semibold ${getScoreTextColor(overallScore)}`}>
              {getScoreLabel(overallScore)}
            </span>
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
            {modules.map((mod) => (
              <div key={mod.key} className="text-center">
                <div className={`text-2xl font-bold ${getScoreTextColor(mod.score)}`}>
                  {mod.score}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {mod.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod) => (
          <ModuleCard
            key={mod.key}
            module={mod}
            onClick={() => onTabChange(mod.tab)}
          />
        ))}
      </div>

      {/* Upcoming Deadlines */}
      <UpcomingDeadlines deadlines={data.upcoming_deadlines || []} />
    </div>
  );
};

/**
 * Module Score Card Component
 */
const ModuleCard = ({ module, onClick }) => {
  const { label, icon: Icon, score, stats } = module;

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-md transition-shadow w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            score >= 80
              ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
              : score >= 60
              ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400'
              : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
          }`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {label}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xl font-bold ${getScoreTextColor(score)}`}>
            {score}%
          </span>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Score bar */}
      <div className="mt-4">
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 80
                ? 'bg-green-500'
                : score >= 60
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
};

/**
 * Upcoming Deadlines Component
 */
const UpcomingDeadlines = ({ deadlines }) => {
  if (!deadlines || deadlines.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Upcoming Deadlines
        </h3>
        <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          <span>No upcoming deadlines</span>
        </div>
      </div>
    );
  }

  const getDeadlineIcon = (type) => {
    switch (type) {
      case 'document_review':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'audit':
        return <ClipboardCheck className="w-5 h-5 text-purple-500" />;
      case 'corrective_action':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'land_assessment':
        return <Map className="w-5 h-5 text-teal-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getUrgencyBadge = (daysUntil) => {
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
          <XCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }
    if (daysUntil <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
          <Clock className="w-3 h-3" />
          {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
        <Clock className="w-3 h-3" />
        {daysUntil}d
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Upcoming Deadlines
      </h3>
      <div className="space-y-3">
        {deadlines.map((deadline, index) => {
          const dueDate = new Date(deadline.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

          return (
            <div
              key={deadline.id || index}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:shadow-md transition-shadow"
            >
              {getDeadlineIcon(deadline.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {deadline.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Due: {dueDate.toLocaleDateString()}
                </p>
              </div>
              {getUrgencyBadge(daysUntil)}
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrimusGFSDashboard;
