/**
 * AuditLogViewer.js - Audit Log Viewer Component
 * 
 * Place this file at: frontend/src/components/AuditLogViewer.js
 * 
 * A comprehensive audit log viewer with filtering, sorting, pagination,
 * and export functionality for compliance reporting.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Activity,
  FileText,
  Clock,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  Send,
  UserPlus,
  Eye,
  EyeOff
} from 'lucide-react';
import { auditAPI } from '../services/api';

// Action type icons and colors
const ACTION_CONFIG = {
  create: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  update: { icon: Edit, color: 'text-blue-600', bg: 'bg-blue-100' },
  delete: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100' },
  login: { icon: LogIn, color: 'text-purple-600', bg: 'bg-purple-100' },
  logout: { icon: LogOut, color: 'text-gray-600', bg: 'bg-gray-100' },
  export: { icon: Download, color: 'text-orange-600', bg: 'bg-orange-100' },
  submit: { icon: Send, color: 'text-teal-600', bg: 'bg-teal-100' },
  invite: { icon: UserPlus, color: 'text-indigo-600', bg: 'bg-indigo-100' },
};

const AuditLogViewer = () => {
  // State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    modelName: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    users: [],
    actions: [],
    modelNames: [],
  });
  
  // Sorting
  const [ordering, setOrdering] = useState('-timestamp');
  
  // Export
  const [exporting, setExporting] = useState(false);

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch logs when filters/pagination/sorting change
  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, ordering, filters]);

  const fetchFilterOptions = async () => {
    try {
      const response = await auditAPI.getFilters();
      setFilterOptions({
        users: response.data.users || [],
        actions: response.data.actions || [],
        modelNames: response.data.model_names || [],
      });
    } catch (err) {
      console.error('Failed to fetch filter options:', err);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        page: page,
        page_size: pageSize,
        ordering: ordering,
      };
      
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      if (filters.userId) params.user_id = filters.userId;
      if (filters.action) params.action = filters.action;
      if (filters.modelName) params.model_name = filters.modelName;
      if (filters.search) params.search = filters.search;
      
      const response = await auditAPI.list(params);
      
      setLogs(response.data.results || []);
      setTotalCount(response.data.count || 0);
      setTotalPages(response.data.total_pages || 1);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, ordering, filters]);

  const handleExport = async () => {
    setExporting(true);
    
    try {
      const params = {};
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      if (filters.userId) params.user_id = filters.userId;
      if (filters.action) params.action = filters.action;
      if (filters.modelName) params.model_name = filters.modelName;
      if (filters.search) params.search = filters.search;
      
      const response = await auditAPI.export(params);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or generate one
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'audit_log_export.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) filename = filenameMatch[1];
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export audit logs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      action: '',
      modelName: '',
      search: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const handleSort = (field) => {
    if (ordering === field) {
      setOrdering(`-${field}`);
    } else if (ordering === `-${field}`) {
      setOrdering(field);
    } else {
      setOrdering(`-${field}`);
    }
  };

  const getSortIcon = (field) => {
    if (ordering === field) return <ChevronUp className="w-4 h-4" />;
    if (ordering === `-${field}`) return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
    };
  };

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) {
      return <span className="text-gray-400 italic">No changes recorded</span>;
    }

    return (
      <div className="space-y-2">
        {Object.entries(changes).map(([field, change]) => (
          <div key={field} className="flex flex-col sm:flex-row sm:items-start gap-1">
            <span className="font-medium text-gray-700 min-w-32">{field}:</span>
            {typeof change === 'object' && change !== null && 'old' in change && 'new' in change ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-sm line-through">
                  {String(change.old || '(empty)')}
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-sm">
                  {String(change.new || '(empty)')}
                </span>
              </div>
            ) : (
              <span className="text-gray-600">{JSON.stringify(change)}</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  const ActionIcon = ({ action }) => {
    const config = ACTION_CONFIG[action] || { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' };
    const Icon = config.icon;
    return (
      <div className={`p-1.5 rounded-full ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
    );
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-600 mt-1">
          Track all changes and actions across your farm management system
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search descriptions..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {Object.values(filters).filter(v => v !== '').length}
                </span>
              )}
            </button>

            <button
              onClick={fetchLogs}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleExport}
              disabled={exporting || totalCount === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* User filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  User
                </label>
                <select
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All Users</option>
                  {filterOptions.users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user.email
                      }
                    </option>
                  ))}
                </select>
              </div>

              {/* Action filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Activity className="w-4 h-4 inline mr-1" />
                  Action
                </label>
                <select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All Actions</option>
                  {filterOptions.actions.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Record Type
                </label>
                <select
                  value={filters.modelName}
                  onChange={(e) => handleFilterChange('modelName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">All Types</option>
                  {filterOptions.modelNames.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear filters */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4 inline mr-1" />
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between mb-4 text-sm text-gray-600">
        <span>
          Showing {logs.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, totalCount)} of {totalCount} entries
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-3"></th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('timestamp')}
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Timestamp
                    {getSortIcon('timestamp')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('user__email')}
                >
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    User
                    {getSortIcon('user__email')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('action')}
                >
                  <div className="flex items-center gap-1">
                    Action
                    {getSortIcon('action')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('model_name')}
                >
                  <div className="flex items-center gap-1">
                    Record Type
                    {getSortIcon('model_name')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                // Loading skeleton
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-4"><div className="w-8 h-8 bg-gray-200 rounded-full"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-40"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No activity found</p>
                    <p className="text-sm">
                      {hasActiveFilters 
                        ? 'Try adjusting your filters'
                        : 'Activity will appear here as you use the system'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const { date, time } = formatTimestamp(log.timestamp);
                  const isExpanded = expandedRow === log.id;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-green-50' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="px-4 py-3">
                          <button className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{date}</div>
                            <div className="text-gray-500">{time}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {log.user 
                                ? (log.user.first_name && log.user.last_name
                                    ? `${log.user.first_name} ${log.user.last_name}`
                                    : log.user.email
                                  )
                                : 'System'
                              }
                            </div>
                            {log.user && log.user.email && log.user.first_name && (
                              <div className="text-gray-500 truncate max-w-xs">{log.user.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ActionIcon action={log.action} />
                            <span className="text-sm font-medium text-gray-900">
                              {log.action_display}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {log.model_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 max-w-md truncate">
                            {log.object_repr || `${log.model_name} #${log.object_id}`}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded details row */}
                      {isExpanded && (
                        <tr className="bg-green-50">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="ml-12 space-y-4">
                              {/* Changes section */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                  Changes
                                </h4>
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  {renderChanges(log.changes)}
                                </div>
                              </div>
                              
                              {/* Metadata */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Record ID:</span>
                                  <span className="ml-2 font-mono text-gray-900">{log.object_id || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">IP Address:</span>
                                  <span className="ml-2 font-mono text-gray-900">{log.ip_address || 'N/A'}</span>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-gray-500">User Agent:</span>
                                  <span className="ml-2 text-gray-900 text-xs">
                                    {log.user_agent || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                <ChevronLeft className="w-4 h-4" />
                <ChevronLeft className="w-4 h-4 -ml-2" />
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded text-sm font-medium ${
                        page === pageNum
                          ? 'bg-green-600 text-white'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                <ChevronRight className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 -ml-2" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compliance note */}
      <div className="mt-4 text-sm text-gray-500 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          This activity log is maintained for regulatory compliance purposes. 
          Records are retained according to California agricultural regulations (PUR, SGMA, ILRP).
          Export data for official reporting.
        </span>
      </div>
    </div>
  );
};

export default AuditLogViewer;
