import React, { useState, useEffect, useCallback } from 'react';
import { STATUS_HEX, CHART_GRID } from '../../theme/finchChartTheme';
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
  complianceProfileAPI,
  inspectorReportAPI,
} from '../../services/api';
import TodayActionList from './TodayActionList';
import ComplianceScoreBreakdown from './ComplianceScoreBreakdown';
import ActiveREITicker from './ActiveREITicker';
import PHIStatusBar from './PHIStatusBar';
import SetupChecklist from './SetupChecklist';
import SuggestionsPanel from './SuggestionsPanel';

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

  let color = STATUS_HEX.success;
  if (score < 70) color = STATUS_HEX.danger;
  else if (score < 85) color = STATUS_HEX.warning;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={CHART_GRID}
          strokeWidth={strokeWidth}
          className=""
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
      bg: 'bg-primary-light',
      icon: 'bg-green-100 text-primary',
      border: 'border-green-200',
      hover: 'hover:border-green-400',
    },
    blue: {
      bg: 'bg-orange-50',
      icon: 'bg-orange-100 text-link',
      border: 'border-orange-200',
      hover: 'hover:border-orange-400',
    },
    purple: {
      bg: 'bg-cream-100',
      icon: 'bg-sand-200 text-bark-700',
      border: 'border-sand-200',
      hover: 'hover:border-sand-400',
    },
    amber: {
      bg: 'bg-yellow-100',
      icon: 'bg-yellow-200 text-yellow-600',
      border: 'border-yellow-200',
      hover: 'hover:border-yellow-400',
    },
    teal: {
      bg: 'bg-green-50',
      icon: 'bg-green-100 text-green-600',
      border: 'border-green-200',
      hover: 'hover:border-green-400',
    },
  };

  const c = colorClasses[color] || colorClasses.green;

  const statusColors = {
    good: 'bg-green-100 text-primary',
    warning: 'bg-yellow-200 text-yellow-700',
    critical: 'bg-danger-bg text-danger',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-surface-raised border-2 ${c.border} ${c.hover} rounded-card p-5 transition-all hover:shadow-lg group`}
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
          <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-bark-600 transition-colors" />
        </div>
      </div>

      <h3 className="text-lg text-heading mb-1">{title}</h3>
      <p className="text-sm text-text-secondary mb-2">{description}</p>

      {certifications.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {certifications.map(cert => (
            <span key={cert} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
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
                metric.status === 'critical' ? 'text-danger' :
                metric.status === 'warning' ? 'text-yellow-600' :
                'text-heading'
              }`}>
                {metric.value}
              </p>
              <p className="text-xs text-text-secondary">{metric.label}</p>
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
    <div className="bg-danger-bg border border-danger/25 rounded-card p-4 mb-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className=" text-danger">
            {criticalAlerts.length} urgent compliance {criticalAlerts.length === 1 ? 'alert' : 'alerts'}
          </h3>
          <ul className="mt-2 space-y-1">
            {criticalAlerts.slice(0, 3).map(alert => (
              <li key={alert.id} className="text-sm text-danger">
                • {alert.title}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={() => onDismiss()}
          className="text-danger hover:text-danger"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Main ComplianceDashboard Component
export default function ComplianceDashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [checklistDismissed, setChecklistDismissed] = useState(false);

  // Data state
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);
  const [profileData, setProfileData] = useState(null);
  const [smartScoreData, setSmartScoreData] = useState(null);
  const [todayData, setTodayData] = useState(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [dashRes, alertsRes, deadlinesRes, licensesRes, trainingRes, profileRes, smartScoreRes, todayRes] = await Promise.all([
        complianceDashboardAPI.get().catch(() => ({ data: null })),
        complianceAlertsAPI.getAll({ is_active: true, limit: 10 }).catch(() => ({ data: { results: [] } })),
        complianceDeadlinesAPI.getAll({ status__in: 'upcoming,due_soon,overdue', limit: 20 }).catch(() => ({ data: { results: [] } })),
        licensesAPI.getAll({ limit: 20 }).catch(() => ({ data: { results: [] } })),
        wpsTrainingAPI.getAll({ limit: 20 }).catch(() => ({ data: { results: [] } })),
        complianceProfileAPI.get().catch(() => ({ data: null })),
        complianceDashboardAPI.getSmartScore().catch(() => ({ data: null })),
        complianceDashboardAPI.getToday().catch(() => ({ data: null })),
      ]);

      setDashboardData(dashRes.data);
      setAlerts(alertsRes.data?.results || alertsRes.data || []);
      setDeadlines(deadlinesRes.data?.results || deadlinesRes.data || []);
      setLicenses(licensesRes.data?.results || licensesRes.data || []);
      setTrainingRecords(trainingRes.data?.results || trainingRes.data || []);
      setProfileData(profileRes.data);
      setSmartScoreData(smartScoreRes.data);
      setTodayData(todayRes.data);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-bark-600 mt-2">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <div className="bg-surface-raised border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-text-secondary text-sm">
                  Manage all regulatory and food safety compliance
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Overall Score */}
              <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-cream-50 rounded-lg">
                <MiniScoreCircle score={overallScore} />
                <div>
                  <p className="text-xs text-text-secondary">Overall Score</p>
                  <p className="text-sm font-medium text-heading">
                    {overallScore >= 85 ? 'Excellent' : overallScore >= 70 ? 'Good' : 'Needs Work'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-bark-600 hover:bg-cream-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate?.('compliance-settings')}
                className="p-2 text-bark-600 hover:bg-cream-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">

        {/* 1. Setup Checklist — shows when setup is incomplete */}
        {!checklistDismissed && (
          <SetupChecklist
            scoreData={smartScoreData}
            onNavigate={onNavigate}
            onDismiss={() => setChecklistDismissed(true)}
          />
        )}

        {/* 2. Alert Banner — critical compliance alerts */}
        {showAlerts && <AlertBanner alerts={alerts} onDismiss={() => setShowAlerts(false)} />}

        {/* 3. Active REI Ticker */}
        <ActiveREITicker />

        {/* 4. PHI Status Bar */}
        <PHIStatusBar
          phiBlockedFields={todayData?.phi_blocked_fields || []}
          onNavigate={onNavigate}
        />

        {/* 5. Score + Today Actions (side by side on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <ComplianceScoreBreakdown onNavigate={onNavigate} />
          </div>
          <div className="lg:col-span-3">
            <TodayActionList onNavigate={onNavigate} />
          </div>
        </div>

        {/* 6. Smart Suggestions */}
        <SuggestionsPanel onNavigate={onNavigate} />

        {/* 7. Quick Actions */}
        <div>
          <h2 className="text-base text-heading mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              onClick={() => onNavigate?.('compliance-deadlines')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-raised border border-border rounded-button hover:border-green-400 hover:shadow transition-all"
            >
              <Calendar className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-bark-700">Deadlines</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-reports')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-raised border border-border rounded-button hover:border-green-400 hover:shadow transition-all"
            >
              <FileText className="w-6 h-6 text-bark-700" />
              <span className="text-sm font-medium text-bark-700">Reports</span>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-inspector-checklist')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-raised border border-border rounded-button hover:border-green-400 hover:shadow transition-all"
            >
              <ClipboardCheck className="w-6 h-6 text-primary" />
              <span className="text-sm font-medium text-bark-700">Inspector</span>
            </button>
          </div>
        </div>

        {/* 8. Category Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <CategoryCard
            title="Pesticide Compliance"
            description="Deadlines, PUR reports, REI tracking, and application records"
            icon={Leaf}
            color="green"
            status={getPesticideStatus()}
            onClick={() => onNavigate?.('compliance-pesticide')}
            metrics={[
              { value: pesticideMetrics.overdueDeadlines, label: 'Overdue', status: pesticideMetrics.overdueDeadlines > 0 ? 'critical' : 'good' },
              { value: pesticideMetrics.dueSoon, label: 'Due Soon', status: pesticideMetrics.dueSoon > 2 ? 'warning' : 'good' },
              { value: pesticideMetrics.activeREIs, label: 'Active REIs', status: pesticideMetrics.activeREIs > 0 ? 'warning' : 'good' },
              { value: pesticideMetrics.upcomingReports, label: 'Reports Due' },
            ]}
          />

          <CategoryCard
            title="Worker Protection"
            description="WPS training records, safety certifications, and handler requirements"
            icon={Users}
            color="purple"
            status={getWPSStatus()}
            onClick={() => onNavigate?.('compliance-wps')}
            metrics={[
              { value: wpsMetrics.currentTraining, label: 'Trained Workers' },
              { value: wpsMetrics.expiringSoon, label: 'Expiring Soon', status: wpsMetrics.expiringSoon > 2 ? 'warning' : 'good' },
              { value: wpsMetrics.expired, label: 'Expired', status: wpsMetrics.expired > 0 ? 'critical' : 'good' },
              { value: wpsMetrics.totalWorkers, label: 'Total Records' },
            ]}
          />

          <CategoryCard
            title="Licenses & Certifications"
            description="Applicator licenses, business permits, and professional certifications"
            icon={Award}
            color="amber"
            status={getLicenseStatus()}
            onClick={() => onNavigate?.('compliance-licenses')}
            metrics={[
              { value: licenseMetrics.active, label: 'Active' },
              { value: licenseMetrics.expiringSoon, label: 'Expiring Soon', status: licenseMetrics.expiringSoon > 0 ? 'warning' : 'good' },
              { value: licenseMetrics.expired, label: 'Expired', status: licenseMetrics.expired > 0 ? 'critical' : 'good' },
              { value: licenseMetrics.total, label: 'Total' },
            ]}
          />
        </div>

        {/* 9. Inspector Report Banner */}
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
          className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-green-600 to-green-800 text-white rounded-button hover:from-green-700 hover:to-green-800 transition-all shadow-sm hover:shadow"
        >
          <Download className="w-6 h-6 flex-shrink-0" />
          <div className="text-left">
            <div className="font-semibold">Download Inspector-Ready Report</div>
            <div className="text-green-100 text-sm">One-click PDF with licenses, PHI status, water testing, PUR compliance, and deadlines</div>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto flex-shrink-0" />
        </button>
      </div>
    </div>
  );
}
