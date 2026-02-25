import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, HelpCircle, RefreshCw, Loader2 } from 'lucide-react';
import { quarantineAPI } from '../services/api';

/**
 * QuarantineStatusBadge Component
 *
 * Displays the HLB quarantine status for a farm or field.
 * Fetches status on mount and allows manual refresh.
 *
 * Props:
 *   farmId - ID of the farm to check (mutually exclusive with fieldId)
 *   fieldId - ID of the field to check (mutually exclusive with farmId)
 *   compact - If true, shows a smaller badge without text
 *   showRefresh - If true, shows refresh button (default: true)
 *   className - Additional CSS classes
 */
function QuarantineStatusBadge({
  farmId,
  fieldId,
  compact = false,
  showRefresh = true,
  className = ''
}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async (forceRefresh = false) => {
    if (!farmId && !fieldId) {
      setLoading(false);
      return;
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let response;
      if (farmId) {
        response = await quarantineAPI.checkFarm(farmId, forceRefresh);
      } else {
        response = await quarantineAPI.checkField(fieldId, forceRefresh);
      }

      setStatus(response.data);
    } catch (err) {
      console.error('Error fetching quarantine status:', err);
      setError(err.response?.data?.error || 'Failed to check quarantine status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [farmId, fieldId]);

  const handleRefresh = (e) => {
    e.stopPropagation();
    fetchStatus(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {!compact && <span>Checking...</span>}
      </div>
    );
  }

  // No coordinates available
  if (status?.error === 'No GPS coordinates available for this location') {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs ${className}`}>
        <HelpCircle className="w-3 h-3" />
        {!compact && <span>No GPS</span>}
      </div>
    );
  }

  // API error - hide badge when quarantine API is unavailable
  if (error || status?.error_message) {
    // Don't show confusing "Unknown" badge - just hide it
    return null;
  }

  // In quarantine
  if (status?.in_quarantine === true) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs ${className}`}
        title={`HLB Quarantine Zone: ${status.zone_name || 'Unknown'}`}
      >
        <AlertTriangle className="w-3 h-3" />
        {!compact && <span>HLB Zone</span>}
        {showRefresh && (
          <button
            onClick={handleRefresh}
            className="ml-1 p-0.5 hover:bg-red-200 rounded"
            disabled={refreshing}
            title="Refresh status"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  // Clear - not in quarantine
  if (status?.in_quarantine === false) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-primary text-xs ${className}`}
        title="Not in HLB quarantine zone"
      >
        <CheckCircle className="w-3 h-3" />
        {!compact && <span>Clear</span>}
        {showRefresh && (
          <button
            onClick={handleRefresh}
            className="ml-1 p-0.5 hover:bg-green-200 rounded"
            disabled={refreshing}
            title="Refresh status"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    );
  }

  // Unknown state (null in_quarantine)
  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs ${className}`}
      title="Quarantine status unknown"
    >
      <HelpCircle className="w-3 h-3" />
      {!compact && <span>Unknown</span>}
      {showRefresh && (
        <button
          onClick={handleRefresh}
          className="ml-1 p-0.5 hover:bg-gray-200 rounded"
          disabled={refreshing}
          title="Check status"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}

export default QuarantineStatusBadge;
