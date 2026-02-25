import React, { useState, useEffect } from 'react';
import { diseaseAlertsAPI, DISEASE_CONSTANTS } from '../../services/api';

/**
 * DiseaseAlertsList - Display and manage disease alerts
 *
 * Shows active disease alerts with ability to acknowledge/dismiss.
 * Supports filtering by priority, type, and farm.
 */
const DiseaseAlertsList = ({
  farmId = null,
  limit = null,
  showFilters = true,
  compact = false,
  onAlertClick = null
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({
    priority: '',
    alert_type: '',
    is_active: true,
  });

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { ...filter };
      if (farmId) params.farm = farmId;
      if (limit) params.limit = limit;

      const response = await diseaseAlertsAPI.getAll(params);
      setAlerts(response.data.results || response.data);
    } catch (err) {
      console.error('Error fetching disease alerts:', err);
      setError('Failed to load disease alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [farmId, filter]);

  // Handle acknowledging an alert
  const handleAcknowledge = async (alertId, e) => {
    e?.stopPropagation();
    try {
      await diseaseAlertsAPI.acknowledge(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  // Handle dismissing an alert
  const handleDismiss = async (alertId, e) => {
    e?.stopPropagation();
    try {
      await diseaseAlertsAPI.dismiss(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  // Get priority styling
  const getPriorityStyle = (priority) => {
    const styles = {
      critical: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-500',
        text: 'text-red-800 dark:text-red-200',
        badge: 'bg-red-600 text-white',
      },
      high: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        border: 'border-orange-500',
        text: 'text-orange-800 dark:text-orange-200',
        badge: 'bg-orange-500 text-white',
      },
      medium: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-yellow-500',
        text: 'text-yellow-800 dark:text-yellow-200',
        badge: 'bg-yellow-500 text-white',
      },
      low: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        border: 'border-blue-500',
        text: 'text-blue-800 dark:text-blue-200',
        badge: 'bg-blue-500 text-white',
      },
    };
    return styles[priority] || styles.medium;
  };

  // Get alert type icon
  const getAlertTypeIcon = (alertType) => {
    const typeInfo = DISEASE_CONSTANTS.ALERT_TYPES.find(t => t.value === alertType);
    return typeInfo?.icon || '⚠️';
  };

  // Format distance
  const formatDistance = (miles) => {
    if (!miles) return null;
    return `${parseFloat(miles).toFixed(1)} mi`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={fetchAlerts}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={filter.priority}
            onChange={(e) => setFilter(prev => ({ ...prev, priority: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
          >
            <option value="">All Priorities</option>
            {DISEASE_CONSTANTS.ALERT_PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          <select
            value={filter.alert_type}
            onChange={(e) => setFilter(prev => ({ ...prev, alert_type: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
          >
            <option value="">All Types</option>
            {DISEASE_CONSTANTS.ALERT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filter.is_active}
              onChange={(e) => setFilter(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Active only
          </label>
        </div>
      )}

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">✅</div>
          <p>No disease alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const style = getPriorityStyle(alert.priority);

            return (
              <div
                key={alert.id}
                onClick={() => onAlertClick?.(alert)}
                className={`
                  ${style.bg} border-l-4 ${style.border} rounded-lg p-4
                  ${onAlertClick ? 'cursor-pointer hover:opacity-90' : ''}
                  ${alert.is_acknowledged ? 'opacity-60' : ''}
                  transition-all
                `}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getAlertTypeIcon(alert.alert_type)}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                        {alert.priority?.toUpperCase()}
                      </span>
                      {alert.distance_miles && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDistance(alert.distance_miles)} away
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className={`font-semibold ${style.text} ${compact ? 'text-sm' : ''}`}>
                      {alert.title}
                    </h4>

                    {/* Message */}
                    {!compact && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
                        {alert.message}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {alert.farm_name && <span>{alert.farm_name}</span>}
                      {alert.field_name && <span>• {alert.field_name}</span>}
                      <span>• {formatDate(alert.created_at)}</span>
                    </div>

                    {/* Recommended Actions */}
                    {!compact && alert.recommended_actions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Recommended Actions:
                        </p>
                        <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                          {alert.recommended_actions.slice(0, 2).map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                          {alert.recommended_actions.length > 2 && (
                            <li className="text-gray-400">
                              +{alert.recommended_actions.length - 2} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {!alert.is_acknowledged && (
                      <button
                        onClick={(e) => handleAcknowledge(alert.id, e)}
                        className="px-3 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title="Acknowledge"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDismiss(alert.id, e)}
                      className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title="Dismiss"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiseaseAlertsList;
