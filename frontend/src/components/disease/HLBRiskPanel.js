import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { diseaseDashboardAPI } from '../../services/api';

/**
 * HLBRiskPanel — per-field HLB risk scores.
 *
 * Hits /api/disease/dashboard/hlb-risk/ which returns a list of assessments
 * (already sorted highest-risk first) plus a level_counts summary. Each
 * row is expandable to reveal the component breakdown, contributing
 * factors, and recommended actions.
 */
const LEVEL_STYLES = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', border: 'border-red-500', badge: 'bg-red-600' },
  high: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-500', badge: 'bg-orange-600' },
  moderate: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500', badge: 'bg-amber-500' },
  low: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500', badge: 'bg-emerald-600' },
};

const COMPONENT_LABELS = {
  proximity: 'HLB proximity',
  vector_pressure: 'ACP pressure',
  host_vulnerability: 'Tree stress',
  zone_exposure: 'Quarantine zone',
  climate: 'Climate',
};

function HLBRiskPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await diseaseDashboardAPI.getHLBRisk();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load HLB risk data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex items-center gap-3 text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Scoring HLB risk…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 p-6 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  const fields = data?.fields || [];
  const counts = data?.level_counts || { critical: 0, high: 0, moderate: 0, low: 0 };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-600" />
          HLB Risk by Field
        </h3>
        <div className="flex items-center gap-2 text-xs">
          {['critical', 'high', 'moderate', 'low'].map(level => (
            <span
              key={level}
              className={`px-2 py-0.5 rounded ${LEVEL_STYLES[level].bg} ${LEVEL_STYLES[level].text} font-medium`}
            >
              {counts[level] || 0} {level}
            </span>
          ))}
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="p-6 text-center text-gray-500 text-sm">
          No fields to score. Add field GPS coordinates to enable HLB risk.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {fields.slice(0, 10).map(f => {
            const style = LEVEL_STYLES[f.risk_level] || LEVEL_STYLES.low;
            const isOpen = expanded === f.field_id;
            return (
              <div key={f.field_id}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : f.field_id)}
                  className={`w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 ${style.border}`}
                >
                  <div className="flex-1 min-w-0 text-left">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {f.field_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {f.nearest_hlb_miles != null
                        ? `Nearest HLB ${f.nearest_hlb_miles.toFixed(1)}mi`
                        : 'No nearby HLB detection'}
                      {f.acp_detections_90d > 0 && ` · ${f.acp_detections_90d} ACP in 90d`}
                      {f.inside_hlb_zone && ' · inside HLB zone'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-white text-xs font-semibold uppercase px-2 py-1 rounded ${style.badge}`}>
                      {f.risk_level}
                    </span>
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-100 w-12 text-right">
                      {f.risk_score.toFixed(0)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-900/40 text-sm">
                    {/* Component breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                      {Object.entries(f.components || {}).map(([key, val]) => (
                        <div
                          key={key}
                          className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {COMPONENT_LABELS[key] || key}
                          </div>
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {val.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Factors */}
                    {f.factors?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Risk factors
                        </div>
                        <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                          {f.factors.map((factor, i) => (
                            <li key={i}>{factor}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {f.recommendations?.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                          Recommended actions
                        </div>
                        <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                          {f.recommendations.map((rec, i) => (
                            <li key={i}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Data gaps */}
                    {f.data_gaps?.length > 0 && (
                      <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <div>{f.data_gaps.join(' · ')}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HLBRiskPanel;
