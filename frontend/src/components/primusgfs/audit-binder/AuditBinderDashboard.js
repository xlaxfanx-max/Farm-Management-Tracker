import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  FileText,
  ChevronRight,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';
import CreateBinderModal from './CreateBinderModal';
import BinderOverview from './BinderOverview';

const AuditBinderDashboard = () => {
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBinder, setSelectedBinder] = useState(null);

  const loadBinders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getAuditBinders();
      setBinders(response.data.results || response.data);
    } catch (err) {
      console.error('Error loading audit binders:', err);
      setError('Failed to load audit binders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBinders();
  }, [loadBinders]);

  const handleCreateBinder = async (data) => {
    try {
      const response = await primusGFSAPI.createAuditBinder(data);
      setShowCreateModal(false);
      await loadBinders();
      setSelectedBinder(response.data);
    } catch (err) {
      console.error('Error creating binder:', err);
      throw err;
    }
  };

  const handleDeleteBinder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this audit binder?')) return;
    try {
      await primusGFSAPI.deleteAuditBinder(id);
      if (selectedBinder?.id === id) setSelectedBinder(null);
      await loadBinders();
    } catch (err) {
      console.error('Error deleting binder:', err);
    }
  };

  // If a binder is selected, show the BinderOverview
  if (selectedBinder) {
    return (
      <BinderOverview
        binderId={selectedBinder.id}
        onBack={() => {
          setSelectedBinder(null);
          loadBinders();
        }}
      />
    );
  }

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      ready: 'bg-green-100 text-primary dark:bg-green-900 dark:text-green-300',
      submitted: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    };
    const labels = {
      draft: 'Draft',
      in_progress: 'In Progress',
      ready: 'Ready',
      submitted: 'Submitted',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            CAC Audit Binder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your CAC Food Safety Manual for PrimusGFS audit preparation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadBinders}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Binder
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Binder List */}
      {binders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No audit binders</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a new audit binder from the CAC Food Safety Manual template.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Binder
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {binders.map((binder) => {
            const stats = binder.completion_stats || {};
            return (
              <div
                key={binder.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedBinder(binder)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-medium text-gray-900 dark:text-white truncate">
                        {binder.name}
                      </h3>
                      {getStatusBadge(binder.status)}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {binder.template_name} v{binder.template_version}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {binder.season_year}
                      </span>
                      {binder.farm_name && (
                        <span>{binder.farm_name}</span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {stats.total > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            {stats.complete} of {stats.total - stats.not_applicable} sections complete
                          </span>
                          <span className="font-medium">{stats.percent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              stats.percent === 100
                                ? 'bg-green-500'
                                : stats.percent >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${stats.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBinder(binder.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete binder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateBinderModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateBinder}
        />
      )}
    </div>
  );
};

export default AuditBinderDashboard;
