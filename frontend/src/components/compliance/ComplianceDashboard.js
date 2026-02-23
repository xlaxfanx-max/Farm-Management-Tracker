import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  FileText,
  Award,
  Users,
  ChevronRight,
  ChevronDown,
  Bell,
  RefreshCw,
  Settings,
  X,
  Info,
  Leaf,
  ClipboardCheck,
  Package,
  Truck,
  SprayCanIcon as Spray,
  Target,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  Droplets,
  Wrench,
  Bug,
  Clipboard,
  Map,
  GraduationCap,
  BookOpen,
  Eye,
  ListChecks,
  UserX,
  Phone,
  FlaskConical,
  ClipboardList,
  Download,
} from 'lucide-react';
import {
  complianceDashboardAPI,
  complianceDeadlinesAPI,
  complianceAlertsAPI,
  licensesAPI,
  wpsTrainingAPI,
  fsmaAPI,
  primusGFSAPI,
  complianceProfileAPI,
  inspectorReportAPI,
} from '../../services/api';

// Utility function to format dates
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Utility function to get days until date
const getDaysUntil = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / (1000 * 60 * 60 * 24));
};

// Mini Score Circle Component
const MiniScoreCircle = ({ score, size = 48 }) => {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  let color = '#22c55e'; // green
  if (score < 70) color = '#ef4444'; // red
  else if (score < 85) color = '#f59e0b'; // yellow

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          className="dark:stroke-gray-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
};

// Category Card Component
const CategoryCard = ({
  title,
  description,
  icon: Icon,
  score,
  metrics = [],
  status = 'good', // 'good', 'warning', 'critical'
  onClick,
  color = 'green',
  certifications = [],
}) => {
  const colorClasses = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-800',
      hover: 'hover:border-green-400 dark:hover:border-green-600',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-800',
      hover: 'hover:border-blue-400 dark:hover:border-blue-600',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      icon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-800',
      hover: 'hover:border-purple-400 dark:hover:border-purple-600',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      hover: 'hover:border-amber-400 dark:hover:border-amber-600',
    },
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-900/20',
      icon: 'bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400',
      border: 'border-teal-200 dark:border-teal-800',
      hover: 'hover:border-teal-400 dark:hover:border-teal-600',
    },
  };

  const c = colorClasses[color] || colorClasses.green;

  const statusColors = {
    good: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-gray-800 border-2 ${c.border} ${c.hover} rounded-xl p-5 transition-all hover:shadow-lg group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 ${c.icon} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          {score !== undefined && <MiniScoreCircle score={score} />}
          {status && !score && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status]}`}>
              {status === 'good' ? 'On Track' : status === 'warning' ? 'Attention' : 'Action Needed'}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{description}</p>

      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {certifications.map(cert => (
            <span key={cert} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {cert}
            </span>
          ))}
        </div>
      )}

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, idx) => (
            <div key={idx} className={`${c.bg} rounded-lg p-2`}>
              <p className={`text-lg font-bold ${
                metric.status === 'critical' ? 'text-red-600 dark:text-red-400' :
                metric.status === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                'text-gray-900 dark:text-white'
              }`}>
                {metric.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{metric.label}</p>
            </div>
          ))}
        </div>
      )}
    </button>
  );
};

// Alert Banner Component
const AlertBanner = ({ alerts, onDismiss }) => {
  const criticalAlerts = alerts.filter(a => a.priority === 'critical' || a.priority === 'high');

  if (criticalAlerts.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-red-800 dark:text-red-200">
            {criticalAlerts.length} urgent compliance {criticalAlerts.length === 1 ? 'alert' : 'alerts'}
          </h3>
          <ul className="mt-2 space-y-1">
            {criticalAlerts.slice(0, 3).map(alert => (
              <li key={alert.id} className="text-sm text-red-700 dark:text-red-300">
                • {alert.title}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => onDismiss()}
          className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Primus GFS module definitions grouped by audit category
const PRIMUS_MODULES = [
  // Management & Organization
  { key: 'food_safety_profile', label: 'Food Safety Profile', tab: 'profile', icon: Shield, category: 'management',
    getAction: (d) => {
      const p = d?.food_safety_profile;
      if (!p) return 'Profile not started';
      const missing = [!p.has_coordinator && 'coordinator', !p.has_policy && 'policy', !p.has_map && 'map'].filter(Boolean);
      return missing.length > 0 ? `Missing: ${missing.join(', ')}` : null;
    }},
  { key: 'org_roles', label: 'Org Roles', tab: 'org-roles', icon: Users, category: 'management',
    getAction: (d) => !d?.org_roles?.has_coordinator ? 'No coordinator assigned' : null },
  { key: 'committee_meetings', label: 'Committee Meetings', tab: 'committee', icon: ClipboardList, category: 'management',
    getAction: (d) => {
      const q = d?.committee_meetings?.quarters_completed || 0;
      return q < 4 ? `${q}/4 quarterly meetings` : null;
    }},
  { key: 'management_review', label: 'Mgmt Review', tab: 'mgmt-review', icon: ClipboardCheck, category: 'management',
    getAction: (d) => !d?.management_review?.exists ? 'No review this year' :
      !d?.management_review?.approved ? 'Review not approved' : null },
  { key: 'document_control', label: 'Document Control', tab: 'documents', icon: FileText, category: 'management',
    getAction: (d) => d?.documents?.overdue_reviews > 0 ? `${d.documents.overdue_reviews} overdue review(s)` : null },

  // Training & People
  { key: 'training_matrix', label: 'Training Matrix', tab: 'training-matrix', icon: GraduationCap, category: 'training',
    getAction: (d) => {
      const avg = d?.training_matrix?.average_compliance;
      return avg !== undefined && avg < 80 ? `${Math.round(avg)}% avg compliance` : null;
    }},
  { key: 'training_sessions', label: 'Training Sessions', tab: 'training-sessions', icon: BookOpen, category: 'training',
    getAction: (d) => {
      const s = d?.training_sessions?.sessions_this_year || 0;
      return s < 4 ? `${s}/4 sessions this year` : null;
    }},
  { key: 'non_conformance', label: 'Non-Conformance', tab: 'non-conformance', icon: UserX, category: 'training',
    getAction: (d) => {
      const open = d?.non_conformance?.open || 0;
      return open > 0 ? `${open} unresolved` : null;
    }},
  { key: 'product_holds', label: 'Product Holds', tab: 'product-holds', icon: Package, category: 'training',
    getAction: (d) => {
      const active = d?.product_holds?.active || 0;
      return active > 0 ? `${active} active hold(s)` : null;
    }},

  // Field Operations
  { key: 'pre_harvest', label: 'Pre-Harvest', tab: 'pre-harvest', icon: Clipboard, category: 'field_ops',
    getAction: (d) => d?.pre_harvest?.this_year === 0 ? 'No inspections this year' : null },
  { key: 'pre_season_checklist', label: 'Pre-Season', tab: 'pre-season', icon: ListChecks, category: 'field_ops',
    getAction: (d) => {
      const a = d?.pre_season_checklist?.approved_count || 0;
      const t = d?.pre_season_checklist?.farms_total || 0;
      return a < t ? `${a}/${t} farms approved` : null;
    }},
  { key: 'field_risk_assessment', label: 'Field Risk', tab: 'field-risk', icon: ShieldAlert, category: 'field_ops',
    getAction: (d) => {
      const a = d?.field_risk_assessment?.farms_approved || 0;
      const t = d?.field_risk_assessment?.farms_total || 0;
      return a < t ? `${a}/${t} farms assessed` : null;
    }},
  { key: 'land_assessments', label: 'Land History', tab: 'land', icon: Map, category: 'field_ops',
    getAction: (d) => {
      const unassessed = (d?.land_assessments?.fields_total || 0) - (d?.land_assessments?.fields_assessed || 0);
      return unassessed > 0 ? `${unassessed} field(s) unassessed` : null;
    }},
  { key: 'perimeter_monitoring', label: 'Perimeter', tab: 'perimeter', icon: Eye, category: 'field_ops',
    getAction: (d) => {
      const w = d?.perimeter_monitoring?.weeks_logged_30d || 0;
      return w < 4 ? `${w}/4 weeks logged (30d)` : null;
    }},

  // Suppliers & Traceability
  { key: 'suppliers', label: 'Supplier Mgmt', tab: 'suppliers', icon: Truck, category: 'suppliers',
    getAction: (d) => d?.suppliers?.review_overdue > 0 ? `${d.suppliers.review_overdue} review(s) overdue` : null },
  { key: 'supplier_verification', label: 'Supplier Verify', tab: 'supplier-verify', icon: Truck, category: 'suppliers',
    getAction: (d) => {
      const v = d?.supplier_verification?.suppliers_verified || 0;
      const t = d?.supplier_verification?.total_approved_suppliers || 0;
      return t > 0 && v < t ? `${v}/${t} suppliers verified` : null;
    }},
  { key: 'food_fraud', label: 'Food Fraud', tab: 'food-fraud', icon: AlertTriangle, category: 'suppliers',
    getAction: (d) => !d?.food_fraud?.has_assessment ? 'No assessment this year' :
      !d?.food_fraud?.approved ? 'Assessment not approved' : null },
  { key: 'mock_recalls', label: 'Mock Recalls', tab: 'recalls', icon: RotateCcw, category: 'suppliers',
    getAction: (d) => d?.mock_recalls?.passed_this_year === 0 ? 'No recall exercise this year' : null },

  // Monitoring & Records
  { key: 'sanitation', label: 'Field Sanitation', tab: 'sanitation', icon: Droplets, category: 'monitoring',
    getAction: (d) => d?.sanitation?.total_logs_30d === 0 ? 'No logs in past 30 days' : null },
  { key: 'sanitation_maintenance', label: 'San. Maintenance', tab: 'sanitation-maint', icon: Wrench, category: 'monitoring',
    getAction: (d) => {
      const logs = d?.sanitation_maintenance?.logs_30d || 0;
      return logs === 0 ? 'No logs in past 30 days' : null;
    }},
  { key: 'equipment_calibration', label: 'Equipment Calibration', tab: 'calibration', icon: Wrench, category: 'monitoring',
    getAction: (d) => d?.equipment_calibration?.overdue > 0 ? `${d.equipment_calibration.overdue} overdue` : null },
  { key: 'pest_control', label: 'Pest Control', tab: 'pest-control', icon: Bug, category: 'monitoring',
    getAction: (d) => !d?.pest_control?.program_approved ? 'Program not approved' : null },
  { key: 'chemical_inventory', label: 'Chemical Inventory', tab: 'chemical-inv', icon: FlaskConical, category: 'monitoring',
    getAction: (d) => !d?.chemical_inventory?.logged_this_month ? 'No inventory this month' : null },

  // Safety & Response
  { key: 'food_defense', label: 'Food Defense', tab: 'food-defense', icon: ShieldAlert, category: 'safety',
    getAction: (d) => !d?.food_defense?.plan_approved ? 'Plan not approved' : null },
  { key: 'emergency_contacts', label: 'Emergency Contacts', tab: 'emergency', icon: Phone, category: 'safety',
    getAction: (d) => {
      const k = d?.emergency_contacts?.key_types_present || 0;
      return k < 5 ? `${k}/5 key contacts` : null;
    }},
  { key: 'corrective_actions', label: 'Corrective Actions', tab: 'corrective-actions', icon: AlertTriangle, category: 'safety',
    getAction: (d) => d?.corrective_actions?.overdue > 0 ? `${d.corrective_actions.overdue} overdue` : null },
  { key: 'internal_audits', label: 'Internal Audits', tab: 'audits', icon: ClipboardCheck, category: 'safety',
    getAction: (d) => d?.audits?.completed_this_year === 0 ? 'No audit completed this year' : null },
];

// Category definitions with display order
const PRIMUS_CATEGORIES = [
  { key: 'management', label: 'Management & Organization' },
  { key: 'training', label: 'Training & People' },
  { key: 'field_ops', label: 'Field Operations' },
  { key: 'suppliers', label: 'Suppliers & Traceability' },
  { key: 'monitoring', label: 'Monitoring & Records' },
  { key: 'safety', label: 'Safety & Response' },
];

// Cross-module references: existing compliance modules that contribute to Primus GFS
const CROSS_MODULE_LINKS = [
  { module: 'Pesticide Compliance', relevance: 'Auditors verify application records & REI compliance' },
  { module: 'Food Safety (FSMA)', relevance: 'Covers produce safety rule requirements' },
  { module: 'Worker Protection (WPS)', relevance: 'Auditors verify training records & safety postings' },
];

// Category accordion row for Certification Readiness
const CategorySection = ({ category, modules, moduleScores, primusData, onNavigate, isOpen, onToggle }) => {
  const catModules = modules.filter(m => m.category === category.key);
  const catNeedsAttention = catModules.filter(m => (moduleScores[m.key] || 0) < 60);
  const catOnTrack = catModules.filter(m => (moduleScores[m.key] || 0) >= 60);
  const readyCount = catOnTrack.length;
  const totalCount = catModules.length;
  const avgScore = totalCount > 0
    ? Math.round(catModules.reduce((sum, m) => sum + (moduleScores[m.key] || 0), 0) / totalCount)
    : 0;
  const barColor = avgScore >= 80 ? 'bg-green-500' : avgScore >= 60 ? 'bg-amber-500' : 'bg-red-400';
  const allGood = catNeedsAttention.length === 0;

  return (
    <div className={`rounded-lg border ${allGood
      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {/* Category header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors rounded-lg"
      >
        {isOpen
          ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        }
        <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
          {category.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
          {readyCount}/{totalCount}
        </span>
        {/* Mini progress bar */}
        <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mr-2">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${avgScore}%` }} />
        </div>
        <span className={`text-xs font-bold min-w-[32px] text-right ${
          avgScore >= 80 ? 'text-green-600 dark:text-green-400' :
          avgScore >= 60 ? 'text-amber-600 dark:text-amber-400' :
          'text-red-600 dark:text-red-400'
        }`}>
          {avgScore}%
        </span>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-3 space-y-1.5">
          {/* Modules needing attention */}
          {catNeedsAttention.map(mod => {
            const score = moduleScores[mod.key] || 0;
            const actionText = mod.getAction(primusData);
            const ModIcon = mod.icon;
            return (
              <button
                key={mod.key}
                onClick={() => onNavigate?.(`compliance-primusgfs-${mod.tab}`)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 hover:border-red-300 dark:hover:border-red-700 transition-colors text-left"
              >
                <ModIcon className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />
                <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">{mod.label}</span>
                <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[180px]">
                  {actionText || `Score: ${score}%`}
                </span>
              </button>
            );
          })}
          {/* On-track modules as compact pills */}
          {catOnTrack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {catOnTrack.map(mod => {
                const score = moduleScores[mod.key] || 0;
                const ModIcon = mod.icon;
                return (
                  <button
                    key={mod.key}
                    onClick={() => onNavigate?.(`compliance-primusgfs-${mod.tab}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-colors"
                  >
                    <ModIcon className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{mod.label}</span>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">{score}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Certification Readiness Section Component
const CertificationReadinessSection = ({ primusData, onNavigate }) => {
  const moduleScores = primusData?.module_scores || {};
  const overallScore = primusData?.overall_score || 0;
  const totalModules = PRIMUS_MODULES.length;
  const readyModules = PRIMUS_MODULES.filter(m => (moduleScores[m.key] || 0) >= 60).length;

  // All categories start collapsed — user expands what they need
  const [expandedCats, setExpandedCats] = useState({});

  const toggleCat = useCallback((catKey) => {
    setExpandedCats(prev => ({ ...prev, [catKey]: !prev[catKey] }));
  }, []);

  return (
    <div className="mb-6">
      <div className="bg-white dark:bg-gray-800 border-2 border-teal-200 dark:border-teal-800 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-teal-50 dark:bg-teal-900/20 px-6 py-4 flex items-center justify-between border-b border-teal-200 dark:border-teal-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 dark:bg-teal-900/40 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Certification Readiness</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track your progress toward farm certification audits
              </p>
            </div>
          </div>
          <MiniScoreCircle score={overallScore} size={56} />
        </div>

        {/* Primus GFS content */}
        <div className="p-6">
          {/* Top bar: status + progress + link */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Primus GFS</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                overallScore >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                overallScore >= 60 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {overallScore >= 80 ? 'Audit Ready' : overallScore >= 60 ? 'In Progress' : 'Not Ready'}
              </span>
            </div>
            <button
              onClick={() => onNavigate?.('compliance-primusgfs')}
              className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1"
            >
              Full Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Overall progress bar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overallScore >= 80 ? 'bg-green-500' : overallScore >= 60 ? 'bg-amber-500' : 'bg-red-400'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {readyModules}/{totalModules} ready
            </span>
          </div>

          {/* Category accordion */}
          <div className="space-y-2">
            {PRIMUS_CATEGORIES.map(cat => (
              <CategorySection
                key={cat.key}
                category={cat}
                modules={PRIMUS_MODULES}
                moduleScores={moduleScores}
                primusData={primusData}
                onNavigate={onNavigate}
                isOpen={expandedCats[cat.key] || false}
                onToggle={() => toggleCat(cat.key)}
              />
            ))}
          </div>

          {/* Cross-references to existing modules */}
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Already Covered by Your Compliance Modules
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {CROSS_MODULE_LINKS.map(link => (
                <div key={link.module} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{link.module}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{link.relevance}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main ComplianceDashboard Component
export default function ComplianceDashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showAlerts, setShowAlerts] = useState(true);

  // Data state
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [fsmaData, setFsmaData] = useState(null);
  const [primusData, setPrimusData] = useState(null);
  const [profileData, setProfileData] = useState(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [dashRes, alertsRes, deadlinesRes, licensesRes, trainingRes, fsmaRes, primusRes, profileRes] = await Promise.all([
        complianceDashboardAPI.get().catch(() => ({ data: null })),
        complianceAlertsAPI.getAll({ is_active: true, limit: 10 }).catch(() => ({ data: { results: [] } })),
        complianceDeadlinesAPI.getAll({ status__in: 'upcoming,due_soon,overdue', limit: 20 }).catch(() => ({ data: { results: [] } })),
        licensesAPI.getAll({ limit: 20 }).catch(() => ({ data: { results: [] } })),
        wpsTrainingAPI.getAll({ limit: 20 }).catch(() => ({ data: { results: [] } })),
        fsmaAPI.getDashboard().catch(() => ({ data: null })),
        primusGFSAPI.getDashboard().catch(() => ({ data: null })),
        complianceProfileAPI.get().catch(() => ({ data: null })),
      ]);

      setDashboardData(dashRes.data);
      setAlerts(alertsRes.data?.results || alertsRes.data || []);
      setDeadlines(deadlinesRes.data?.results || deadlinesRes.data || []);
      setLicenses(licensesRes.data?.results || licensesRes.data || []);
      setTrainingRecords(trainingRes.data?.results || trainingRes.data || []);
      setFsmaData(fsmaRes.data);
      setPrimusData(primusRes.data);
      setProfileData(profileRes.data);
    } catch (err) {
      console.error('Error fetching compliance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Calculate metrics for each category
  const pesticideMetrics = {
    overdueDeadlines: deadlines.filter(d => d.status === 'overdue').length,
    dueSoon: deadlines.filter(d => d.status === 'due_soon').length,
    activeREIs: dashboardData?.active_reis || 0,
    upcomingReports: deadlines.filter(d => d.category === 'reporting').length,
  };

  const licenseMetrics = {
    total: licenses.length,
    active: licenses.filter(l => l.status === 'active').length,
    expiringSoon: licenses.filter(l => l.status === 'expiring_soon').length,
    expired: licenses.filter(l => l.status === 'expired').length,
  };

  const wpsMetrics = {
    totalWorkers: trainingRecords.length,
    currentTraining: trainingRecords.filter(t => getDaysUntil(t.expiration_date) > 0).length,
    expiringSoon: trainingRecords.filter(t => {
      const days = getDaysUntil(t.expiration_date);
      return days !== null && days > 0 && days <= 30;
    }).length,
    expired: trainingRecords.filter(t => getDaysUntil(t.expiration_date) < 0).length,
  };

  const fsmaMetrics = {
    visitorsToday: fsmaData?.visitors_today || 0,
    facilitiesCleaned: fsmaData?.facilities_cleaned_today || 0,
    facilitiesTotal: fsmaData?.facilities_total || 0,
    phiIssues: fsmaData?.phi_issues || 0,
    meetingsThisQuarter: fsmaData?.meetings_this_quarter || 0,
    lowInventory: fsmaData?.low_inventory_count || 0,
  };

  // Calculate overall compliance score
  const overallScore = dashboardData?.score ?? 0;

  // Determine status for each category
  const getPesticideStatus = () => {
    if (pesticideMetrics.overdueDeadlines > 0) return 'critical';
    if (pesticideMetrics.dueSoon > 2) return 'warning';
    return 'good';
  };

  const getLicenseStatus = () => {
    if (licenseMetrics.expired > 0) return 'critical';
    if (licenseMetrics.expiringSoon > 0) return 'warning';
    return 'good';
  };

  const getWPSStatus = () => {
    if (wpsMetrics.expired > 0) return 'critical';
    if (wpsMetrics.expiringSoon > 2) return 'warning';
    return 'good';
  };

  const getFSMAStatus = () => {
    if (fsmaMetrics.phiIssues > 0) return 'critical';
    if (fsmaMetrics.lowInventory > 2 || fsmaMetrics.facilitiesCleaned < fsmaMetrics.facilitiesTotal) return 'warning';
    return 'good';
  };

  const isPrimusCertified = profileData?.primus_certified === true;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 mt-2">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Hub</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Manage all regulatory and food safety compliance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Overall Score */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <MiniScoreCircle score={overallScore} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Overall Score</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : 'Needs Work'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate?.('compliance-settings')}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Alert Banner */}
        {showAlerts && <AlertBanner alerts={alerts} onDismiss={() => setShowAlerts(false)} />}

        {/* Certification Readiness */}
        {primusData && (
          <CertificationReadinessSection
            primusData={primusData}
            onNavigate={onNavigate}
          />
        )}

        {/* Category Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pesticide Compliance */}
          <CategoryCard
            title="Pesticide Compliance"
            description="Deadlines, PUR reports, REI tracking, and application records"
            icon={Leaf}
            color="green"
            status={getPesticideStatus()}
            onClick={() => onNavigate?.('compliance-pesticide')}
            certifications={primusData ? ['Primus GFS'] : []}
            metrics={[
              {
                value: pesticideMetrics.overdueDeadlines,
                label: 'Overdue',
                status: pesticideMetrics.overdueDeadlines > 0 ? 'critical' : 'good'
              },
              {
                value: pesticideMetrics.dueSoon,
                label: 'Due Soon',
                status: pesticideMetrics.dueSoon > 2 ? 'warning' : 'good'
              },
              {
                value: pesticideMetrics.activeREIs,
                label: 'Active REIs',
                status: pesticideMetrics.activeREIs > 0 ? 'warning' : 'good'
              },
              {
                value: pesticideMetrics.upcomingReports,
                label: 'Reports Due'
              },
            ]}
          />

          {/* Food Safety (FSMA) */}
          <CategoryCard
            title="Food Safety (FSMA)"
            description="Visitor logs, facility cleaning, safety meetings, and PHI compliance"
            icon={ClipboardCheck}
            color="blue"
            status={getFSMAStatus()}
            onClick={() => onNavigate?.('compliance-fsma')}
            certifications={primusData ? ['Primus GFS'] : []}
            metrics={[
              {
                value: fsmaMetrics.visitorsToday,
                label: 'Visitors Today'
              },
              {
                value: `${fsmaMetrics.facilitiesCleaned}/${fsmaMetrics.facilitiesTotal}`,
                label: 'Cleaned Today',
                status: fsmaMetrics.facilitiesCleaned < fsmaMetrics.facilitiesTotal ? 'warning' : 'good'
              },
              {
                value: fsmaMetrics.phiIssues,
                label: 'PHI Issues',
                status: fsmaMetrics.phiIssues > 0 ? 'critical' : 'good'
              },
              {
                value: fsmaMetrics.meetingsThisQuarter,
                label: 'Meetings (Q)'
              },
            ]}
          />

          {/* Worker Protection (WPS) */}
          <CategoryCard
            title="Worker Protection"
            description="WPS training records, safety certifications, and handler requirements"
            icon={Users}
            color="purple"
            status={getWPSStatus()}
            onClick={() => onNavigate?.('compliance-wps')}
            certifications={primusData ? ['Primus GFS'] : []}
            metrics={[
              {
                value: wpsMetrics.currentTraining,
                label: 'Trained Workers'
              },
              {
                value: wpsMetrics.expiringSoon,
                label: 'Expiring Soon',
                status: wpsMetrics.expiringSoon > 2 ? 'warning' : 'good'
              },
              {
                value: wpsMetrics.expired,
                label: 'Expired',
                status: wpsMetrics.expired > 0 ? 'critical' : 'good'
              },
              {
                value: wpsMetrics.totalWorkers,
                label: 'Total Records'
              },
            ]}
          />

          {/* Licenses & Certifications */}
          <CategoryCard
            title="Licenses & Certifications"
            description="Applicator licenses, business permits, and professional certifications"
            icon={Award}
            color="amber"
            status={getLicenseStatus()}
            onClick={() => onNavigate?.('compliance-licenses')}
            metrics={[
              {
                value: licenseMetrics.active,
                label: 'Active'
              },
              {
                value: licenseMetrics.expiringSoon,
                label: 'Expiring Soon',
                status: licenseMetrics.expiringSoon > 0 ? 'warning' : 'good'
              },
              {
                value: licenseMetrics.expired,
                label: 'Expired',
                status: licenseMetrics.expired > 0 ? 'critical' : 'good'
              },
              {
                value: licenseMetrics.total,
                label: 'Total'
              },
            ]}
          />
        </div>

        {/* Inspector Report Banner */}
        <div className="mt-8">
          <button
            onClick={async () => {
              try {
                const response = await inspectorReportAPI.downloadPDF();
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `compliance_report_${new Date().toISOString().split('T')[0]}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Error downloading report:', error);
              }
            }}
            className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-sm hover:shadow"
          >
            <Download className="w-6 h-6 flex-shrink-0" />
            <div className="text-left">
              <div className="font-semibold">Download Inspector-Ready Report</div>
              <div className="text-green-100 text-sm">One-click PDF with licenses, PHI status, water testing, PUR compliance, and deadlines</div>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto flex-shrink-0" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              onClick={() => onNavigate?.('compliance-deadlines')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Deadlines</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-reports')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reports</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-fsma-visitors')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Log Visitor</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-fsma-cleaning')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <Spray className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Log Cleaning</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-fsma-phi')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PHI Check</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-fsma-audit')}
              className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-400 dark:hover:border-green-600 hover:shadow transition-all"
            >
              <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audit Binder</span>
            </button>
          </div>
        </div>

        {/* Recent Activity Summary */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Deadlines */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming Deadlines</h3>
              <button
                onClick={() => onNavigate?.('compliance-deadlines')}
                className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {deadlines.length > 0 ? (
                <div className="space-y-3">
                  {deadlines.slice(0, 5).map(deadline => {
                    const days = getDaysUntil(deadline.due_date);
                    return (
                      <div key={deadline.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            deadline.status === 'overdue' ? 'bg-red-500' :
                            deadline.status === 'due_soon' ? 'bg-amber-500' : 'bg-gray-400'
                          }`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{deadline.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(deadline.due_date)}</p>
                          </div>
                        </div>
                        {days !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            days < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                            days <= 7 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">No upcoming deadlines</p>
              )}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Active Alerts</h3>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-full">
                {alerts.length} active
              </span>
            </div>
            <div className="p-4">
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="flex items-start gap-3">
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        alert.priority === 'critical' ? 'text-red-500' :
                        alert.priority === 'high' ? 'text-amber-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{alert.message?.slice(0, 60)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">No active alerts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <p className="text-sm">{notification}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-white ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
