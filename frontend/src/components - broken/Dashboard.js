import React, { useState, useMemo } from 'react';
import { Calendar, Clock, MapPin, Package, TrendingUp, AlertTriangle, CheckCircle, Plus, ChevronRight, Droplet, Leaf, Shield, BarChart3 } from 'lucide-react';

function Dashboard({ applications = [], onViewApp, onNewApp }) {
  const [timeFilter, setTimeFilter] = useState('30');

  // Ensure applications is always an array
  const safeApplications = Array.isArray(applications) ? applications : [];

  // Calculate statistics
  const stats = useMemo(() => {
    const now = new Date();
    const filterDate = new Date(now.getTime() - (timeFilter * 24 * 60 * 60 * 1000));
    
    const filtered = safeApplications.filter(app => {
      const appDate = new Date(app.application_date);
      return appDate >= filterDate;
    });

    const total = filtered.length;
    const completed = filtered.filter(app => app.status === 'complete').length;
    const pending = filtered.filter(app => app.status === 'pending_signature').length;
    const uniqueProducts = new Set(filtered.map(app => app.product).filter(Boolean)).size;
    const uniqueFields = new Set(filtered.map(app => app.field).filter(Boolean)).size;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending,
      uniqueProducts,
      uniqueFields,
      completionRate
    };
  }, [safeApplications, timeFilter]);

  // Get recent applications
  const recentApplications = useMemo(() => {
    return [...safeApplications]
      .sort((a, b) => new Date(b.application_date) - new Date(a.application_date))
      .slice(0, 5);
  }, [safeApplications]);

  // Get pending applications
  const upcomingApplications = useMemo(() => {
    return safeApplications
      .filter(app => app.status === 'pending_signature')
      .sort((a, b) => new Date(a.application_date) - new Date(b.application_date))
      .slice(0, 4);
  }, [safeApplications]);

  const StatCard = ({ icon: Icon, label, value, subtitle, gradient, trend }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
          <Icon className="text-white" size={24} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-sm font-bold text-green-600">
            <TrendingUp size={16} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-black text-slate-800 mb-1">{value}</div>
        <div className="text-sm font-bold text-slate-600 mb-1">{label}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    if (status === 'complete') return 'bg-green-100 text-green-700 border-green-200';
    if (status === 'submitted') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const getStatusIcon = (status) => {
    if (status === 'complete') return CheckCircle;
    return Clock;
  };

  const getStatusLabel = (status) => {
    if (status === 'complete') return 'Complete';
    if (status === 'submitted') return 'Submitted';
    return 'Pending';
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">
            Dashboard Overview
          </h1>
          <p className="text-slate-600">
            Track applications, monitor compliance, and manage your citrus operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:border-orange-500 transition-colors"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={onNewApp}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-black hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40 hover:scale-105"
          >
            <Plus size={20} />
            <span>New Application</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Droplet}
          label="Total Applications"
          value={stats.total}
          subtitle={`${stats.completed} completed, ${stats.pending} pending`}
          gradient="from-blue-500 to-cyan-600"
        />
        <StatCard
          icon={Package}
          label="Products Used"
          value={stats.uniqueProducts}
          subtitle="Unique pesticides applied"
          gradient="from-purple-500 to-violet-600"
        />
        <StatCard
          icon={MapPin}
          label="Fields Treated"
          value={stats.uniqueFields}
          subtitle="Active field locations"
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          icon={Shield}
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          subtitle="Applications marked complete"
          gradient="from-amber-500 to-orange-600"
          trend={stats.completionRate >= 80 ? '+12%' : null}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Applications - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                    <Calendar className="text-white" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Recent Applications</h2>
                    <p className="text-sm text-slate-600">Latest pesticide applications</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {recentApplications.length === 0 ? (
                <div className="p-12 text-center">
                  <Droplet className="mx-auto mb-4 text-slate-300" size={48} />
                  <p className="text-slate-500 mb-4 font-semibold">No applications recorded yet</p>
                  <button
                    onClick={onNewApp}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:from-orange-600 hover:to-orange-700 transition-all"
                  >
                    Create First Application
                  </button>
                </div>
              ) : (
                recentApplications.map((app) => {
                  const StatusIcon = getStatusIcon(app.status);
                  return (
                    <div
                      key={app.id}
                      onClick={() => onViewApp(app)}
                      className="p-5 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(app.status)}`}>
                              <StatusIcon size={14} />
                              {getStatusLabel(app.status)}
                            </span>
                            <span className="text-sm font-semibold text-slate-600">
                              {formatDate(app.application_date)}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-800 mb-2 group-hover:text-orange-600 transition-colors">
                            {app.product_name || `Product #${app.product}`}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-slate-400" />
                              <span className="font-medium">{app.field_name || `Field #${app.field}`}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Package size={14} className="text-slate-400" />
                              <span className="font-medium">{app.amount_used} {app.unit_of_measure}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-orange-500 transition-colors flex-shrink-0" size={20} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Takes 1 column */}
        <div className="space-y-6">
          {/* Compliance Status Card */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-black">Compliance Status</h3>
            </div>
            <div className="mb-4">
              <div className="text-5xl font-black mb-2">{stats.completionRate}%</div>
              <p className="text-green-100 text-sm font-semibold">
                {stats.completionRate >= 90 ? 'Excellent' : stats.completionRate >= 70 ? 'Good' : 'Needs Attention'}
              </p>
            </div>
            <div className="pt-4 border-t border-white/20">
              <p className="text-sm text-green-100 font-medium">
                California DPR & FSMA compliant tracking
              </p>
            </div>
          </div>

          {/* Upcoming Applications */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
              <div className="flex items-center gap-2">
                <Clock className="text-amber-600" size={18} />
                <h3 className="text-base font-black text-slate-800">Pending Tasks</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {upcomingApplications.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="mx-auto mb-2 text-green-500" size={32} />
                  <p className="text-sm text-slate-600 font-semibold">All caught up!</p>
                </div>
              ) : (
                upcomingApplications.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => onViewApp(app)}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors border border-slate-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-xs font-bold text-slate-500">
                        {formatDate(app.application_date)}
                      </div>
                      <AlertTriangle className="text-amber-500 flex-shrink-0" size={14} />
                    </div>
                    <div className="text-sm font-bold text-slate-800 mb-1 line-clamp-1">
                      {app.product_name || `Product #${app.product}`}
                    </div>
                    <div className="text-xs text-slate-600 font-medium">
                      {app.field_name || `Field #${app.field}`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-base font-black text-slate-800 mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={onNewApp}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 transition-all group"
              >
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-md">
                  <Plus size={16} />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-orange-600 transition-colors">
                  New Application
                </span>
              </button>
              <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-all group">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-md">
                  <BarChart3 size={16} />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                  Generate Report
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Sections for Future Expansion */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Analytics Preview Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-md">
              <BarChart3 className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Usage Analytics</h3>
              <p className="text-sm text-slate-600">Coming soon</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 text-center border-2 border-dashed border-slate-300">
            <TrendingUp className="mx-auto mb-3 text-slate-400" size={40} />
            <p className="text-sm font-semibold text-slate-600 mb-2">Product Usage Trends</p>
            <p className="text-xs text-slate-500">
              Visualize application patterns and optimize your pesticide usage
            </p>
          </div>
        </div>

        {/* Weather Integration Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md">
              <Leaf className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800">Weather Insights</h3>
              <p className="text-sm text-slate-600">Coming soon</p>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 text-center border-2 border-dashed border-slate-300">
            <Droplet className="mx-auto mb-3 text-slate-400" size={40} />
            <p className="text-sm font-semibold text-slate-600 mb-2">Application Timing</p>
            <p className="text-xs text-slate-500">
              Get weather-based recommendations for optimal application timing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;