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
  Bell,
  RefreshCw,
  Settings,
  Plus,
  Filter,
  X,
  Info,
} from 'lucide-react';
import {
  complianceDashboardAPI,
  complianceDeadlinesAPI,
  complianceAlertsAPI,
  licensesAPI,
  wpsTrainingAPI,
  COMPLIANCE_CONSTANTS,
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

// Score Circle Component
const ScoreCircle = ({ score, size = 120 }) => {
  const strokeWidth = 8;
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-gray-500">Score</span>
      </div>
    </div>
  );
};

// Alert Card Component
const AlertCard = ({ alert, onAcknowledge, onDismiss }) => {
  const priorityConfig = {
    critical: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600' },
    high: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-600' },
    medium: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    low: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600' },
  };

  const config = priorityConfig[alert.priority] || priorityConfig.low;

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${config.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm">{alert.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              Acknowledge
            </button>
            <button
              onClick={() => onDismiss(alert.id)}
              className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          alert.priority === 'critical' ? 'bg-red-100 text-red-700' :
          alert.priority === 'high' ? 'bg-amber-100 text-amber-700' :
          alert.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {alert.priority.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

// Deadline Row Component
const DeadlineRow = ({ deadline, onComplete }) => {
  const days = getDaysUntil(deadline.due_date);

  let statusColor = 'text-gray-600 bg-gray-100';
  if (deadline.status === 'overdue') statusColor = 'text-red-600 bg-red-100';
  else if (deadline.status === 'due_soon') statusColor = 'text-amber-600 bg-amber-100';
  else if (deadline.status === 'completed') statusColor = 'text-green-600 bg-green-100';

  const categoryLabels = {
    reporting: 'Reporting',
    training: 'Training',
    testing: 'Testing',
    renewal: 'Renewal',
    inspection: 'Inspection',
    other: 'Other',
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 px-2 -mx-2 rounded">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          deadline.status === 'overdue' ? 'bg-red-500' :
          deadline.status === 'due_soon' ? 'bg-amber-500' :
          deadline.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
        }`} />
        <div>
          <p className="font-medium text-gray-900 text-sm">{deadline.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{categoryLabels[deadline.category] || deadline.category}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500">Due {formatDate(deadline.due_date)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {deadline.status !== 'completed' && days !== null && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
            {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
          </span>
        )}
        {deadline.status !== 'completed' && (
          <button
            onClick={() => onComplete(deadline.id)}
            className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
            title="Mark complete"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// License Card Component
const LicenseCard = ({ license }) => {
  const days = getDaysUntil(license.expiration_date);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Award className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{license.license_type_display}</p>
            <p className="text-xs text-gray-500">{license.holder_name || 'Company'}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          license.status === 'active' ? 'bg-green-100 text-green-700' :
          license.status === 'expiring_soon' ? 'bg-amber-100 text-amber-700' :
          license.status === 'expired' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {license.status === 'active' ? 'Active' :
           license.status === 'expiring_soon' ? 'Expiring Soon' :
           license.status === 'expired' ? 'Expired' : license.status}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>#{license.license_number}</span>
        <span>Expires: {formatDate(license.expiration_date)}</span>
      </div>
      {days !== null && days <= 90 && days > 0 && (
        <div className="mt-2 text-xs text-amber-600">
          {days} days until expiration
        </div>
      )}
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon: Icon, color = 'green', onClick }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    red: 'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-600',
    blue: 'bg-blue-100 text-blue-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-gray-400" />}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-700">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};

// Main ComplianceDashboard Component
export default function ComplianceDashboard({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Dashboard data state
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [trainingRecords, setTrainingRecords] = useState([]);

  // Show coming soon notification
  const showComingSoon = (featureName) => {
    setNotification(`${featureName} - Coming soon! This feature is currently under development.`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [dashRes, alertsRes, deadlinesRes, licensesRes, trainingRes] = await Promise.all([
        complianceDashboardAPI.get().catch(() => ({ data: null })),
        complianceAlertsAPI.getAll({ is_active: true, limit: 10 }).catch(() => ({ data: { results: [] } })),
        complianceDeadlinesAPI.getAll({ status__in: 'upcoming,due_soon,overdue', limit: 10 }).catch(() => ({ data: { results: [] } })),
        licensesAPI.getAll({ limit: 5 }).catch(() => ({ data: { results: [] } })),
        wpsTrainingAPI.getAll({ limit: 5 }).catch(() => ({ data: { results: [] } })),
      ]);

      setDashboardData(dashRes.data);
      setAlerts(alertsRes.data?.results || alertsRes.data || []);
      setDeadlines(deadlinesRes.data?.results || deadlinesRes.data || []);
      setLicenses(licensesRes.data?.results || licensesRes.data || []);
      setTrainingRecords(trainingRes.data?.results || trainingRes.data || []);
    } catch (err) {
      console.error('Error fetching compliance data:', err);
      setError('Failed to load compliance data');
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

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await complianceAlertsAPI.acknowledge(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const handleDismissAlert = async (alertId) => {
    try {
      await complianceAlertsAPI.dismiss(alertId);
      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  const handleCompleteDeadline = async (deadlineId) => {
    try {
      await complianceDeadlinesAPI.complete(deadlineId);
      fetchData(); // Refresh to get updated data
    } catch (err) {
      console.error('Error completing deadline:', err);
    }
  };

  // Calculate summary stats from data
  const summary = dashboardData?.summary || {
    deadlines_this_month: deadlines.length,
    overdue_items: deadlines.filter(d => d.status === 'overdue').length,
    expiring_licenses: licenses.filter(l => l.status === 'expiring_soon').length,
    active_alerts: alerts.length,
  };

  const score = dashboardData?.score || 85;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin mx-auto" />
          <p className="text-gray-600 mt-2">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
                <p className="text-gray-500 text-sm">Manage regulatory compliance and deadlines</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => onNavigate?.('compliance-settings')}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Compliance Score and Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Score Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Compliance Score</h3>
            <div className="flex justify-center">
              <ScoreCircle score={score} />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                {score >= 85 ? 'Great job! Keep it up.' :
                 score >= 70 ? 'Some items need attention.' :
                 'Action required on multiple items.'}
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Active Alerts"
              value={summary.active_alerts || 0}
              subtitle="Requires attention"
              icon={Bell}
              color={summary.active_alerts > 0 ? 'red' : 'green'}
              onClick={() => showComingSoon('Alerts Management')}
            />
            <SummaryCard
              title="Due This Month"
              value={summary.deadlines_this_month || 0}
              subtitle="Deadlines"
              icon={Calendar}
              color="blue"
              onClick={() => onNavigate?.('compliance-deadlines')}
            />
            <SummaryCard
              title="Overdue Items"
              value={summary.overdue_items || 0}
              subtitle="Past due date"
              icon={Clock}
              color={summary.overdue_items > 0 ? 'red' : 'green'}
              onClick={() => onNavigate?.('compliance-deadlines')}
            />
            <SummaryCard
              title="Expiring Licenses"
              value={summary.expiring_licenses || 0}
              subtitle="Within 90 days"
              icon={Award}
              color={summary.expiring_licenses > 0 ? 'amber' : 'green'}
              onClick={() => onNavigate?.('compliance-licenses')}
            />
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Active Alerts</h2>
              <button
                onClick={() => showComingSoon('Alerts Management')}
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 5).map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={handleAcknowledgeAlert}
                  onDismiss={handleDismissAlert}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Deadlines */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Upcoming Deadlines</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate?.('compliance-deadlines')}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                  title="Add deadline"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate?.('compliance-deadlines')}
                  className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {deadlines.length > 0 ? (
                deadlines.slice(0, 8).map(deadline => (
                  <DeadlineRow
                    key={deadline.id}
                    deadline={deadline}
                    onComplete={handleCompleteDeadline}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No upcoming deadlines</p>
                </div>
              )}
            </div>
          </div>

          {/* Licenses & Certifications */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Licenses & Certifications</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate?.('compliance-licenses')}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                  title="Add license"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate?.('compliance-licenses')}
                  className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              {licenses.length > 0 ? (
                <div className="space-y-3">
                  {licenses.slice(0, 4).map(license => (
                    <LicenseCard key={license.id} license={license} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Award className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No licenses recorded</p>
                  <button
                    onClick={() => onNavigate?.('compliance-licenses')}
                    className="mt-2 text-sm text-green-600 hover:text-green-700"
                  >
                    Add your first license
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigate?.('compliance-wps')}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">WPS Training</p>
                  <p className="text-xs text-gray-500">Worker protection</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate?.('compliance-reports')}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Reports</p>
                  <p className="text-xs text-gray-500">PUR, SGMA, etc.</p>
                </div>
              </button>

              <button
                onClick={() => onNavigate?.('compliance-wps')}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">REI Tracker</p>
                  <p className="text-xs text-gray-500">Entry intervals</p>
                </div>
              </button>

              <button
                onClick={() => showComingSoon('Incident Reporting')}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Incidents</p>
                  <p className="text-xs text-gray-500">Report & track</p>
                </div>
              </button>
            </div>
          </div>

          {/* WPS Training Summary */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">WPS Training</h2>
              <button
                onClick={() => onNavigate?.('compliance-wps')}
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {trainingRecords.length > 0 ? (
                <div className="space-y-3">
                  {trainingRecords.slice(0, 4).map(record => {
                    const days = getDaysUntil(record.expiration_date);
                    return (
                      <div key={record.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{record.trainee_name}</p>
                            <p className="text-xs text-gray-500">{record.training_type_display}</p>
                          </div>
                        </div>
                        {days !== null && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            days < 0 ? 'bg-red-100 text-red-700' :
                            days <= 30 ? 'bg-amber-100 text-amber-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {days < 0 ? 'Expired' : days <= 30 ? `${days}d left` : 'Current'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No training records</p>
                  <button
                    onClick={() => onNavigate?.('compliance-wps')}
                    className="mt-2 text-sm text-green-600 hover:text-green-700"
                  >
                    Add training record
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
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
