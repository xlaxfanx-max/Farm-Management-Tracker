import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Sparkles,
  Calendar,
  Package,
  AlertTriangle,
  FileText,
  ChevronRight,
  ChevronLeft,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Leaf,
  Droplets,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import MetricCard from '../ui/MetricCard';
import VisitorLogList from './VisitorLogList';
import CleaningLogList from './CleaningLogList';
import SafetyMeetingList from './SafetyMeetingList';
import FertilizerInventoryManager from './FertilizerInventoryManager';
import PHIComplianceChecker from './PHIComplianceChecker';
import AuditBinderGenerator from './AuditBinderGenerator';
import { WaterAssessmentDashboard, WaterAssessmentWizard } from './water-assessment';

/**
 * FSMADashboard Component
 *
 * Main dashboard for FSMA compliance module showing:
 * - Overall compliance score
 * - Today's status cards
 * - Quick actions
 * - Upcoming items and alerts
 * - Recent activity
 */
const FSMADashboard = ({ onNavigate, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Water Assessment state
  const [waterAssessmentMode, setWaterAssessmentMode] = useState(null); // null, 'list', 'create', 'edit', 'view'
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);

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
      const response = await fsmaAPI.getDashboard();
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error loading FSMA dashboard:', err);
      setError('Failed to load FSMA compliance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 dark:text-green-400';
      case 'good':
        return 'text-blue-600 dark:text-blue-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'visitors', label: 'Visitor Logs', icon: Users },
    { id: 'cleaning', label: 'Cleaning', icon: Sparkles },
    { id: 'meetings', label: 'Safety Meetings', icon: Calendar },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'phi', label: 'PHI Checks', icon: Leaf },
    { id: 'water-assessment', label: 'Water Assessment', icon: Droplets },
    { id: 'audit', label: 'Audit Binder', icon: FileText },
  ];

  // Water Assessment handlers
  const handleWaterAssessmentCreate = () => {
    setWaterAssessmentMode('create');
    setSelectedAssessmentId(null);
  };

  const handleWaterAssessmentView = async (id) => {
    // For viewing, we open in edit mode (wizard handles read-only display for approved)
    // This allows users to see the full assessment details
    setWaterAssessmentMode('edit');
    setSelectedAssessmentId(id);
  };

  const handleWaterAssessmentEdit = (id) => {
    setWaterAssessmentMode('edit');
    setSelectedAssessmentId(id);
  };

  const handleWaterAssessmentComplete = () => {
    setWaterAssessmentMode('list');
    setSelectedAssessmentId(null);
  };

  const handleWaterAssessmentCancel = () => {
    setWaterAssessmentMode('list');
    setSelectedAssessmentId(null);
  };

  // Reset water assessment mode when changing tabs
  useEffect(() => {
    if (activeTab === 'water-assessment') {
      setWaterAssessmentMode('list');
    } else {
      setWaterAssessmentMode(null);
    }
  }, [activeTab]);

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
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate?.('compliance')}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to Compliance Hub"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Food Safety (FSMA)</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Food Safety Modernization Act tracking and documentation
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('audit')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileText className="w-5 h-5" />
          Generate Audit Binder
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
      {activeTab === 'visitors' && <VisitorLogList />}
      {activeTab === 'cleaning' && <CleaningLogList />}
      {activeTab === 'meetings' && <SafetyMeetingList />}
      {activeTab === 'inventory' && <FertilizerInventoryManager />}
      {activeTab === 'phi' && <PHIComplianceChecker />}
      {activeTab === 'water-assessment' && (
        waterAssessmentMode === 'create' || waterAssessmentMode === 'edit' ? (
          <WaterAssessmentWizard
            assessmentId={selectedAssessmentId}
            onComplete={handleWaterAssessmentComplete}
            onCancel={handleWaterAssessmentCancel}
          />
        ) : (
          <WaterAssessmentDashboard
            onCreateNew={handleWaterAssessmentCreate}
            onViewAssessment={handleWaterAssessmentView}
            onEditAssessment={handleWaterAssessmentEdit}
          />
        )
      )}
      {activeTab === 'audit' && <AuditBinderGenerator />}
    </div>
  );
};

/**
 * Overview Tab Component
 */
const OverviewTab = ({ data, error, onTabChange, onRefresh }) => {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
        </div>
        <button
          onClick={onRefresh}
          className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent':
        return 'from-green-500 to-green-600';
      case 'good':
        return 'from-blue-500 to-blue-600';
      case 'warning':
        return 'from-yellow-500 to-yellow-600';
      case 'critical':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Compliance Score and Status Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Compliance Score Circle */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
            Compliance Score
          </h3>
          <div className="flex flex-col items-center">
            <div className={`relative w-32 h-32 rounded-full bg-gradient-to-br ${getStatusColor(data.overall_status)} p-1`}>
              <div className="w-full h-full rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                  {data.overall_compliance_score}
                </span>
              </div>
            </div>
            <span className={`mt-3 text-lg font-medium capitalize ${
              data.overall_status === 'excellent' ? 'text-green-600 dark:text-green-400' :
              data.overall_status === 'good' ? 'text-blue-600 dark:text-blue-400' :
              data.overall_status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {data.overall_status}
            </span>
          </div>
        </div>

        {/* Status Cards */}
        <StatusCard
          title="Facilities Cleaned"
          value={`${data.facilities_cleaned_today}/${data.facilities_requiring_cleaning}`}
          subtitle="Today"
          icon={Sparkles}
          color={data.facilities_cleaned_today >= data.facilities_requiring_cleaning ? 'green' : 'yellow'}
          onClick={() => onTabChange('cleaning')}
        />

        <StatusCard
          title="Visitors Logged"
          value={data.visitors_logged_today}
          subtitle="Today"
          icon={Users}
          color="blue"
          onClick={() => onTabChange('visitors')}
        />

        <StatusCard
          title="PHI Issues"
          value={data.phi_issues_pending}
          subtitle="Pending"
          icon={AlertTriangle}
          color={data.phi_issues_pending > 0 ? 'red' : 'green'}
          onClick={() => onTabChange('phi')}
        />
      </div>

      {/* Quarterly Meeting Status and Low Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarterly Meeting Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quarterly FSMA Meeting
            </h3>
            <button
              onClick={() => onTabChange('meetings')}
              className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {data.quarterly_meeting_status && (
            <div className="flex items-center gap-4">
              {data.quarterly_meeting_status.completed ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-8 h-8" />
                  <div>
                    <p className="font-medium">Q{data.quarterly_meeting_status.quarter} Meeting Complete</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Held on {data.quarterly_meeting_status.meeting_date}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Clock className="w-8 h-8" />
                  <div>
                    <p className="font-medium">Q{data.quarterly_meeting_status.quarter} Meeting Needed</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Schedule before end of quarter
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Low Inventory Alert */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Inventory Alerts
            </h3>
            <button
              onClick={() => onTabChange('inventory')}
              className="text-sm text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
            >
              Manage <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {data.low_inventory_count > 0 ? (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Package className="w-8 h-8" />
                <div>
                  <p className="font-medium">{data.low_inventory_count} items low on stock</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Review and reorder
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-8 h-8" />
                <div>
                  <p className="font-medium">All inventory levels OK</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No items below reorder point
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton
            icon={Users}
            label="Log Visitor"
            onClick={() => onTabChange('visitors')}
          />
          <QuickActionButton
            icon={Sparkles}
            label="Log Cleaning"
            onClick={() => onTabChange('cleaning')}
          />
          <QuickActionButton
            icon={Leaf}
            label="PHI Check"
            onClick={() => onTabChange('phi')}
          />
          <QuickActionButton
            icon={FileText}
            label="Generate Binder"
            onClick={() => onTabChange('audit')}
          />
        </div>
      </div>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cleaning Compliance */}
        <MetricCard
          title="Cleaning Compliance"
          value={`${data.cleaning_compliance_rate || 0}%`}
          subtitle="Last 7 days"
          trend={data.cleaning_compliance_rate >= 90 ? 'Good' : 'Needs Attention'}
          trendDirection={data.cleaning_compliance_rate >= 90 ? 'up' : 'down'}
          color={data.cleaning_compliance_rate >= 90 ? 'green' : 'amber'}
        />

        {/* Visitor Log Compliance */}
        <MetricCard
          title="Visitor Signature Rate"
          value={`${data.visitor_log_compliance_rate || 0}%`}
          subtitle="Last 7 days"
          trend={data.visitor_log_compliance_rate >= 90 ? 'Good' : 'Needs Attention'}
          trendDirection={data.visitor_log_compliance_rate >= 90 ? 'up' : 'down'}
          color={data.visitor_log_compliance_rate >= 90 ? 'green' : 'amber'}
        />
      </div>

      {/* Recent Activity */}
      {data.recent_activity && data.recent_activity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {data.recent_activity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                {activity.type === 'cleaning' && <Sparkles className="w-5 h-5 text-blue-500" />}
                {activity.type === 'visitor' && <Users className="w-5 h-5 text-green-500" />}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Status Card Component
 */
const StatusCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => {
  const colorClasses = {
    green: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  };

  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-left hover:border-green-300 dark:hover:border-green-700 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      </div>
    </button>
  );
};

/**
 * Quick Action Button Component
 */
const QuickActionButton = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group"
  >
    <div className="p-3 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:bg-green-100 dark:group-hover:bg-green-900/40 transition-colors">
      <Icon className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400" />
    </div>
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
  </button>
);

export default FSMADashboard;
