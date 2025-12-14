import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  MapPin, 
  FileText, 
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  Tractor,
  Sprout,
  BarChart3,
  Bell,
  Search
} from 'lucide-react';

function Dashboard({ 
  applications, 
  fields, 
  farms, 
  waterSources,
  onNewApplication,
  onNewField,
  onNewWaterTest, 
  onNavigateToReports
}) {
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingApplications: 0,
    completeApplications: 0,
    submittedToPur: 0,
    totalFields: 0,
    activeFields: 0,
    totalAcres: 0,
    waterSourcesDue: 0,
    applicationsThisWeek: 0,
    applicationsThisMonth: 0
  });

  const [recentApplications, setRecentApplications] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);

  useEffect(() => {
    const calculateStats = () => {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const thisWeek = applications.filter(app => 
        new Date(app.application_date) >= oneWeekAgo
      ).length;

      const thisMonth = applications.filter(app => 
        new Date(app.application_date) >= oneMonthAgo
      ).length;

      const totalAcres = fields.reduce((sum, field) => 
        sum + (parseFloat(field.total_acres) || 0), 0
      );

      const activeFields = fields.filter(f => f.active).length;

      // Calculate water sources needing tests (simplified - you'd add test_frequency logic)
      const waterSourcesDue = waterSources.filter(ws => ws.active).length;

      setStats({
        totalApplications: applications.length,
        pendingApplications: applications.filter(a => a.status === 'pending_signature').length,
        completeApplications: applications.filter(a => a.status === 'complete').length,
        submittedToPur: applications.filter(a => a.submitted_to_pur).length,
        totalFields: fields.length,
        activeFields,
        totalAcres: totalAcres.toFixed(1),
        waterSourcesDue,
        applicationsThisWeek: thisWeek,
        applicationsThisMonth: thisMonth
      });
    };

    const loadRecentApplications = () => {
      const sorted = [...applications]
        .sort((a, b) => new Date(b.application_date) - new Date(a.application_date))
        .slice(0, 5);
      setRecentApplications(sorted);
    };

    const loadUpcomingTasks = () => {
      const tasks = [];
      
      // Add pending applications as tasks
      applications
        .filter(a => a.status === 'pending_signature')
        .forEach(app => {
          tasks.push({
            id: `app-${app.id}`,
            type: 'signature',
            title: 'Application Needs Signature',
            description: `${app.field_name} - ${app.product_name}`,
            date: app.application_date,
            priority: 'high'
          });
        });

      // Add applications ready for PUR submission
      applications
        .filter(a => a.status === 'complete' && !a.submitted_to_pur)
        .forEach(app => {
          tasks.push({
            id: `pur-${app.id}`,
            type: 'pur',
            title: 'Ready for PUR Submission',
            description: `${app.field_name} - ${app.product_name}`,
            date: app.application_date,
            priority: 'medium'
          });
        });

      setUpcomingTasks(tasks.slice(0, 4));
    };

    calculateStats();
    loadRecentApplications();
    loadUpcomingTasks();
  }, [applications, fields, waterSources]);

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-50 text-blue-600 border-blue-100",
      green: "bg-green-50 text-green-600 border-green-100",
      orange: "bg-orange-50 text-orange-600 border-orange-100",
      purple: "bg-purple-50 text-purple-600 border-purple-100",
      red: "bg-red-50 text-red-600 border-red-100"
    };

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center mt-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                <span className="text-green-600 font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className={`rounded-lg p-3 ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
    );
  };

  const QuickActionButton = ({ icon: Icon, label, onClick, color = "blue" }) => {
    const colorClasses = {
      blue: "bg-blue-600 hover:bg-blue-700 text-white",
      green: "bg-green-600 hover:bg-green-700 text-white",
      purple: "bg-purple-600 hover:bg-purple-700 text-white"
    };

    return (
      <button
        onClick={onClick}
        className={`${colorClasses[color]} rounded-lg px-6 py-4 flex flex-col items-center justify-center gap-2 transition-all hover:shadow-lg transform hover:-translate-y-0.5`}
      >
        <Icon className="w-6 h-6" />
        <span className="text-sm font-medium">{label}</span>
      </button>
    );
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending_signature': <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">Pending</span>,
      'complete': <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Complete</span>,
      'submitted': <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Submitted</span>
    };
    return badges[status] || <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">{status}</span>;
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      'high': <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded">High</span>,
      'medium': <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded">Medium</span>,
      'low': <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">Low</span>
    };
    return badges[priority];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back! Here's your farm operations overview.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5" />
                {(stats.pendingApplications > 0) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <QuickActionButton
              icon={Droplet}
              label="New Application"
              onClick={onNewApplication}
              color="blue"
            />
            <QuickActionButton
              icon={MapPin}
              label="Add Field"
              onClick={onNewField}
              color="green"
            />
            <QuickActionButton
              icon={FileText}
              label="Water Test"
              onClick={onNewWaterTest}
              color="purple"
            />
            <QuickActionButton
              icon={BarChart3}
              label="Generate Report"
              onClick={onNavigateToReports}
              color="blue"
            />
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Key Metrics
          </h2>
          <div className="grid grid-cols-4 gap-6">
            <StatCard
              title="Total Applications"
              value={stats.totalApplications}
              subtitle={`${stats.applicationsThisMonth} this month`}
              icon={Droplet}
              trend={`${stats.applicationsThisWeek} this week`}
              color="blue"
            />
            <StatCard
              title="Pending Signatures"
              value={stats.pendingApplications}
              subtitle="Need attention"
              icon={AlertCircle}
              color={stats.pendingApplications > 0 ? "orange" : "green"}
            />
            <StatCard
              title="Active Fields"
              value={stats.activeFields}
              subtitle={`${stats.totalAcres} total acres`}
              icon={Sprout}
              color="green"
            />
            <StatCard
              title="PUR Submissions"
              value={stats.submittedToPur}
              subtitle={`${stats.completeApplications - stats.submittedToPur} ready`}
              icon={FileText}
              color="purple"
            />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Recent Applications - Takes 2 columns */}
          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Applications
              </h2>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View All →
              </button>
            </div>
            
            {recentApplications.length === 0 ? (
              <div className="text-center py-12">
                <Droplet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No applications yet</p>
                <button
                  onClick={onNewApplication}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Create your first application →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentApplications.map(app => (
                  <div
                    key={app.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{app.field_name}</h3>
                          {getStatusBadge(app.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{app.product_name}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(app.application_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {app.acres_treated} acres
                          </span>
                          <span className="flex items-center gap-1">
                            <Tractor className="w-3 h-3" />
                            {app.applicator_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tasks - Takes 1 column */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming Tasks
            </h2>
            
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">All caught up!</p>
                <p className="text-xs text-gray-500 mt-1">No pending tasks</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map(task => (
                  <div
                    key={task.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {getPriorityBadge(task.priority)}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.date)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Compliance Status */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Compliance Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">PUR Compliant</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Water Tests</span>
                  <span className="text-xs font-medium text-orange-600">{stats.waterSourcesDue} Due Soon</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">FSMA Ready</span>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Future Feature Placeholders */}
        <div className="grid grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-lg border border-gray-200 border-dashed p-6 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">Analytics</h3>
            <p className="text-xs text-gray-500">Coming Soon</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 border-dashed p-6 text-center">
            <Sprout className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">Harvest Tracking</h3>
            <p className="text-xs text-gray-500">Coming Soon</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 border-dashed p-6 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="font-medium text-gray-900 mb-1">Schedule Planner</h3>
            <p className="text-xs text-gray-500">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;