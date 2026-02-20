import React from 'react';
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
  ShieldOff,
  Droplets,
  Wrench,
  Bug,
  Clipboard,
  Users,
  GraduationCap,
  BookOpen,
  Eye,
  ListChecks,
  UserX,
  PackageX,
  Phone,
  FlaskConical,
  ClipboardList,
} from 'lucide-react';

/**
 * Score color helpers
 */
const getScoreStrokeColor = (score) => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
};

const getScoreTextColor = (score) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

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
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-gray-200 dark:text-gray-700"
        />
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
 * Section groups matching the sidebar navigation.
 */
const SECTION_GROUPS = [
  {
    label: 'Getting Started',
    keys: ['food_safety_profile', 'org_roles', 'emergency_contacts'],
  },
  {
    label: 'Seasonal Compliance',
    keys: ['pre_season_checklist', 'field_risk_assessment', 'land_assessments', 'perimeter_monitoring'],
  },
  {
    label: 'Operations',
    keys: ['chemical_inventory', 'pest_control', 'sanitation', 'sanitation_maintenance', 'equipment_calibration', 'pre_harvest'],
  },
  {
    label: 'People & Training',
    keys: ['training_matrix', 'training_sessions', 'non_conformance', 'committee_meetings', 'management_review'],
  },
  {
    label: 'Supply Chain',
    keys: ['suppliers', 'supplier_verification', 'product_holds', 'mock_recalls'],
  },
  {
    label: 'Governance',
    keys: ['document_control', 'internal_audits', 'corrective_actions', 'food_defense', 'food_fraud'],
  },
];

/**
 * Build the full modules array from dashboard data.
 */
const buildModules = (data) => {
  const ms = data.module_scores || {};
  return [
    {
      key: 'document_control', label: 'Document Control', icon: FileText, tab: 'documents',
      score: ms.document_control ?? 0,
      stats: [
        { label: 'Total', value: data.documents?.total ?? 0 },
        { label: 'Approved', value: data.documents?.approved ?? 0 },
        { label: 'Overdue', value: data.documents?.overdue_reviews ?? 0 },
      ],
    },
    {
      key: 'internal_audits', label: 'Internal Audits', icon: ClipboardCheck, tab: 'audits',
      score: ms.internal_audits ?? 0,
      stats: [
        { label: 'This Year', value: data.audits?.this_year ?? 0 },
        { label: 'Completed', value: data.audits?.completed_this_year ?? 0 },
      ],
    },
    {
      key: 'corrective_actions', label: 'Corrective Actions', icon: AlertTriangle, tab: 'corrective-actions',
      score: ms.corrective_actions ?? 0,
      stats: [
        { label: 'Open', value: data.corrective_actions?.open ?? 0 },
        { label: 'Overdue', value: data.corrective_actions?.overdue ?? 0 },
        { label: 'Verified', value: data.corrective_actions?.verified ?? 0 },
      ],
    },
    {
      key: 'land_assessments', label: 'Land Assessments', icon: Map, tab: 'land',
      score: ms.land_assessments ?? 0,
      stats: [
        { label: 'Fields', value: data.land_assessments?.fields_total ?? 0 },
        { label: 'Assessed', value: data.land_assessments?.fields_assessed ?? 0 },
        { label: 'Approved', value: data.land_assessments?.fields_approved ?? 0 },
      ],
    },
    {
      key: 'suppliers', label: 'Supplier Control', icon: Truck, tab: 'suppliers',
      score: ms.suppliers ?? 0,
      stats: [
        { label: 'Total', value: data.suppliers?.total ?? 0 },
        { label: 'Approved', value: data.suppliers?.approved ?? 0 },
        { label: 'Overdue', value: data.suppliers?.review_overdue ?? 0 },
      ],
    },
    {
      key: 'mock_recalls', label: 'Mock Recalls', icon: RotateCcw, tab: 'recalls',
      score: ms.mock_recalls ?? 0,
      stats: [
        { label: 'This Year', value: data.mock_recalls?.this_year ?? 0 },
        { label: 'Passed', value: data.mock_recalls?.passed_this_year ?? 0 },
      ],
    },
    {
      key: 'food_defense', label: 'Food Defense', icon: ShieldAlert, tab: 'food-defense',
      score: ms.food_defense ?? 0,
      stats: [
        { label: 'Plan', value: data.food_defense?.has_current_plan ? 'Yes' : 'No' },
        { label: 'Approved', value: data.food_defense?.plan_approved ? 'Yes' : 'No' },
      ],
    },
    {
      key: 'sanitation', label: 'Field Sanitation', icon: Droplets, tab: 'sanitation',
      score: ms.sanitation ?? 0,
      stats: [
        { label: 'Logs 30d', value: data.sanitation?.total_logs_30d ?? 0 },
        { label: 'Compliant', value: data.sanitation?.compliant_30d ?? 0 },
      ],
    },
    {
      key: 'equipment_calibration', label: 'Equipment Calibration', icon: Wrench, tab: 'calibration',
      score: ms.equipment_calibration ?? 0,
      stats: [
        { label: 'Total', value: data.equipment_calibration?.total ?? 0 },
        { label: 'Current', value: data.equipment_calibration?.current ?? 0 },
        { label: 'Overdue', value: data.equipment_calibration?.overdue ?? 0 },
      ],
    },
    {
      key: 'pest_control', label: 'Pest Control', icon: Bug, tab: 'pest-control',
      score: ms.pest_control ?? 0,
      stats: [
        { label: 'Program', value: data.pest_control?.program_approved ? 'Yes' : 'No' },
        { label: 'Logs 30d', value: data.pest_control?.inspections_30d ?? 0 },
      ],
    },
    {
      key: 'pre_harvest', label: 'Pre-Harvest', icon: Clipboard, tab: 'pre-harvest',
      score: ms.pre_harvest ?? 0,
      stats: [
        { label: 'This Year', value: data.pre_harvest?.this_year ?? 0 },
        { label: 'Passed', value: data.pre_harvest?.passed ?? 0 },
        { label: 'Failed', value: data.pre_harvest?.failed ?? 0 },
      ],
    },
    {
      key: 'food_safety_profile', label: 'Food Safety Profile', icon: Shield, tab: 'profile',
      score: ms.food_safety_profile ?? 0,
      stats: [
        { label: 'Coordinator', value: data.food_safety_profile?.has_coordinator ? 'Yes' : 'No' },
        { label: 'Policy', value: data.food_safety_profile?.has_policy ? 'Yes' : 'No' },
        { label: 'Map', value: data.food_safety_profile?.has_map ? 'Yes' : 'No' },
      ],
    },
    {
      key: 'org_roles', label: 'Org Roles', icon: Users, tab: 'org-roles',
      score: ms.org_roles ?? 0,
      stats: [
        { label: 'Coordinator', value: data.org_roles?.has_coordinator ? 'Yes' : 'No' },
        { label: 'Owner', value: data.org_roles?.has_owner ? 'Yes' : 'No' },
        { label: 'Roles', value: data.org_roles?.total_roles ?? 0 },
      ],
    },
    {
      key: 'committee_meetings', label: 'Committee Meetings', icon: ClipboardList, tab: 'committee',
      score: ms.committee_meetings ?? 0,
      stats: [{ label: 'Completed', value: `${data.committee_meetings?.quarters_completed ?? 0}/4` }],
    },
    {
      key: 'management_review', label: 'Mgmt Review', icon: ClipboardCheck, tab: 'mgmt-review',
      score: ms.management_review ?? 0,
      stats: [
        { label: 'Exists', value: data.management_review?.exists ? 'Yes' : 'No' },
        { label: 'Approved', value: data.management_review?.approved ? 'Yes' : 'No' },
        { label: 'Sections', value: `${data.management_review?.sections_reviewed ?? 0}/12` },
      ],
    },
    {
      key: 'training_matrix', label: 'Training Matrix', icon: GraduationCap, tab: 'training-matrix',
      score: ms.training_matrix ?? 0,
      stats: [
        { label: 'Employees', value: data.training_matrix?.total_employees ?? 0 },
        { label: 'Avg Compliance', value: `${data.training_matrix?.average_compliance ?? 0}%` },
      ],
    },
    {
      key: 'training_sessions', label: 'Training Sessions', icon: BookOpen, tab: 'training-sessions',
      score: ms.training_sessions ?? 0,
      stats: [{ label: 'This Year', value: `${data.training_sessions?.sessions_this_year ?? 0}/4` }],
    },
    {
      key: 'perimeter_monitoring', label: 'Perimeter', icon: Eye, tab: 'perimeter',
      score: ms.perimeter_monitoring ?? 0,
      stats: [{ label: 'Weeks (30d)', value: `${data.perimeter_monitoring?.weeks_logged_30d ?? 0}/4` }],
    },
    {
      key: 'pre_season_checklist', label: 'Pre-Season', icon: ListChecks, tab: 'pre-season',
      score: ms.pre_season_checklist ?? 0,
      stats: [
        { label: 'Farms', value: data.pre_season_checklist?.farms_total ?? 0 },
        { label: 'Approved', value: data.pre_season_checklist?.approved_count ?? 0 },
      ],
    },
    {
      key: 'field_risk_assessment', label: 'Field Risk', icon: ShieldAlert, tab: 'field-risk',
      score: ms.field_risk_assessment ?? 0,
      stats: [
        { label: 'Farms', value: data.field_risk_assessment?.farms_total ?? 0 },
        { label: 'Assessed', value: data.field_risk_assessment?.farms_assessed ?? 0 },
        { label: 'Approved', value: data.field_risk_assessment?.farms_approved ?? 0 },
      ],
    },
    {
      key: 'non_conformance', label: 'Non-Conformance', icon: UserX, tab: 'non-conformance',
      score: ms.non_conformance ?? 0,
      stats: [
        { label: 'Total', value: data.non_conformance?.total ?? 0 },
        { label: 'Open', value: data.non_conformance?.open ?? 0 },
      ],
    },
    {
      key: 'product_holds', label: 'Product Holds', icon: PackageX, tab: 'product-holds',
      score: ms.product_holds ?? 0,
      stats: [
        { label: 'Total', value: data.product_holds?.total ?? 0 },
        { label: 'Active', value: data.product_holds?.active ?? 0 },
      ],
    },
    {
      key: 'supplier_verification', label: 'Supplier Verify', icon: Truck, tab: 'supplier-verify',
      score: ms.supplier_verification ?? 0,
      stats: [
        { label: 'Verified', value: data.supplier_verification?.suppliers_verified ?? 0 },
        { label: 'Total', value: data.supplier_verification?.total_approved_suppliers ?? 0 },
      ],
    },
    {
      key: 'food_fraud', label: 'Food Fraud', icon: ShieldOff, tab: 'food-fraud',
      score: ms.food_fraud ?? 0,
      stats: [
        { label: 'Assessment', value: data.food_fraud?.has_assessment ? 'Yes' : 'No' },
        { label: 'Approved', value: data.food_fraud?.approved ? 'Yes' : 'No' },
      ],
    },
    {
      key: 'emergency_contacts', label: 'Emergency Contacts', icon: Phone, tab: 'emergency',
      score: ms.emergency_contacts ?? 0,
      stats: [
        { label: 'Key Types', value: `${data.emergency_contacts?.key_types_present ?? 0}/5` },
        { label: 'Total', value: data.emergency_contacts?.total_contacts ?? 0 },
      ],
    },
    {
      key: 'chemical_inventory', label: 'Chemical Inventory', icon: FlaskConical, tab: 'chemical-inv',
      score: ms.chemical_inventory ?? 0,
      stats: [
        { label: 'This Month', value: data.chemical_inventory?.logged_this_month ? 'Yes' : 'No' },
        { label: 'Entries', value: data.chemical_inventory?.entries_this_month ?? 0 },
      ],
    },
    {
      key: 'sanitation_maintenance', label: 'San. Maintenance', icon: Wrench, tab: 'sanitation-maint',
      score: ms.sanitation_maintenance ?? 0,
      stats: [
        { label: 'Logs 30d', value: data.sanitation_maintenance?.logs_30d ?? 0 },
        { label: 'Acceptable', value: data.sanitation_maintenance?.acceptable_30d ?? 0 },
      ],
    },
  ];
};

/**
 * Module Score Card
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

      <div className={`grid grid-cols-${Math.min(stats.length, 3)} gap-3`}>
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

      <div className="mt-4">
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
};

/**
 * Upcoming Deadlines
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
      case 'document_review': return <FileText className="w-5 h-5 text-blue-500" />;
      case 'audit': return <ClipboardCheck className="w-5 h-5 text-purple-500" />;
      case 'corrective_action': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'land_assessment': return <Map className="w-5 h-5 text-teal-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getUrgencyBadge = (daysUntil) => {
    if (daysUntil < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
          <XCircle className="w-3 h-3" /> Overdue
        </span>
      );
    }
    if (daysUntil <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
          <Clock className="w-3 h-3" /> {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
        <Clock className="w-3 h-3" /> {daysUntil}d
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

/**
 * OverviewTab — Full compliance overview with score ring, section-grouped
 * module cards, and upcoming deadlines.
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
  const modules = buildModules(data);
  const moduleMap = {};
  modules.forEach((m) => { moduleMap[m.key] = m; });

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

      {/* Module Score Cards — grouped by section */}
      {SECTION_GROUPS.map((section) => {
        const sectionModules = section.keys
          .map((k) => moduleMap[k])
          .filter(Boolean);
        if (sectionModules.length === 0) return null;

        const avgScore = Math.round(
          sectionModules.reduce((sum, m) => sum + m.score, 0) / sectionModules.length
        );

        return (
          <div key={section.label}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {section.label}
              </h3>
              <span className={`text-sm font-medium ${getScoreTextColor(avgScore)}`}>
                {avgScore}%
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sectionModules.map((mod) => (
                <ModuleCard
                  key={mod.key}
                  module={mod}
                  onClick={() => onTabChange(mod.tab)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Upcoming Deadlines */}
      <UpcomingDeadlines deadlines={data.upcoming_deadlines || []} />
    </div>
  );
};

export { ScoreRing, getScoreTextColor, getScoreLabel, buildModules, SECTION_GROUPS };
export default OverviewTab;
