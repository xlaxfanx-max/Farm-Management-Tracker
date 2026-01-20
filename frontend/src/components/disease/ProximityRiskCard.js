import React, { useState, useEffect } from 'react';
import { diseaseDashboardAPI, DISEASE_CONSTANTS } from '../../services/api';
import { MapPin, AlertTriangle, Shield, TrendingUp, ChevronRight } from 'lucide-react';

/**
 * ProximityRiskCard - Display proximity risks to disease detections
 *
 * Shows nearest HLB/ACP detections and overall risk score for the company.
 * Designed as a dashboard widget.
 */
const ProximityRiskCard = ({ onViewDetails = null, compact = false }) => {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRiskData();
  }, []);

  const fetchRiskData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await diseaseDashboardAPI.getRiskScore();
      setRiskData(response.data);
    } catch (err) {
      console.error('Error fetching proximity risk data:', err);
      setError('Failed to load risk data');
    } finally {
      setLoading(false);
    }
  };

  // Get risk level styling
  const getRiskLevelStyle = (level) => {
    const styles = {
      critical: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-500',
        icon: 'text-red-600',
        badge: 'bg-red-600 text-white',
      },
      high: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-500',
        icon: 'text-orange-600',
        badge: 'bg-orange-500 text-white',
      },
      moderate: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-500',
        icon: 'text-yellow-600',
        badge: 'bg-yellow-500 text-white',
      },
      low: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-500',
        icon: 'text-green-600',
        badge: 'bg-green-600 text-white',
      },
    };
    return styles[level] || styles.low;
  };

  // Risk score circle component
  const RiskScoreCircle = ({ score, level }) => {
    const style = getRiskLevelStyle(level);
    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          {/* Background circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={style.icon}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${style.text}`}>{score}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">/ 100</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error}</p>
          <button
            onClick={fetchRiskData}
            className="mt-2 text-sm text-green-600 hover:text-green-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!riskData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-gray-500">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No proximity risk data available</p>
        </div>
      </div>
    );
  }

  const style = getRiskLevelStyle(riskData.risk_level);

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden
      ${compact ? '' : 'shadow-sm'}
    `}>
      {/* Header */}
      <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-700 ${style.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className={`w-5 h-5 ${style.icon}`} />
            <h3 className={`font-semibold ${style.text}`}>Disease Risk Assessment</h3>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
            {riskData.risk_level?.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-6">
          {/* Risk Score */}
          <div className="flex-shrink-0">
            <RiskScoreCircle score={riskData.risk_score} level={riskData.risk_level} />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Proximity Metrics */}
            <div className="space-y-3">
              {/* Nearest HLB */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Nearest HLB</span>
                </div>
                <span className={`text-sm font-medium ${
                  riskData.nearest_hlb_miles && riskData.nearest_hlb_miles < 10
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {riskData.nearest_hlb_miles
                    ? `${riskData.nearest_hlb_miles} mi`
                    : 'None detected'}
                </span>
              </div>

              {/* Nearest ACP */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Nearest ACP</span>
                </div>
                <span className={`text-sm font-medium ${
                  riskData.nearest_acp_miles && riskData.nearest_acp_miles < 10
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {riskData.nearest_acp_miles
                    ? `${riskData.nearest_acp_miles} mi`
                    : 'None detected'}
                </span>
              </div>

              {/* Farms at Risk */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Farms at risk</span>
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {riskData.farms_at_risk} of {riskData.total_farms}
                </span>
              </div>
            </div>

            {/* Risk Factors */}
            {!compact && riskData.factors?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Contributing Factors:
                </p>
                <ul className="space-y-1">
                  {riskData.factors.slice(0, 3).map((factor, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                    >
                      <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* View Details Button */}
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
          >
            View Disease Dashboard
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ProximityRiskCard;
