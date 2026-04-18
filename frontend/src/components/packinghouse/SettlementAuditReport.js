// =============================================================================
// SETTLEMENT AUDIT REPORT
// Calls /api/pool-settlements/{id}/audit/ and surfaces anomalies the grower
// would miss skimming a 5-page VPOA/SLA PDF.
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, CheckCircle2, ShieldAlert, ChevronDown, ChevronUp,
  RefreshCw, DollarSign, Info,
} from 'lucide-react';
import { poolSettlementsAPI } from '../../services/api';

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-500',
    text: 'text-red-800 dark:text-red-200',
    icon: 'text-red-600',
    badge: 'bg-red-600',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-500',
    text: 'text-amber-800 dark:text-amber-200',
    icon: 'text-amber-600',
    badge: 'bg-amber-500',
  },
  info: {
    bg: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-500',
    text: 'text-sky-800 dark:text-sky-200',
    icon: 'text-sky-600',
    badge: 'bg-sky-500',
  },
};

const STATUS_BANNER = {
  clean: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    title: 'Clean',
    message: 'No anomalies detected on this settlement.',
  },
  review: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    title: 'Needs review',
    message: null,
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-500',
    icon: ShieldAlert,
    iconColor: 'text-red-600',
    title: 'Critical variance',
    message: null,
  },
};

function formatDollarImpact(value) {
  if (value == null) return null;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function FindingCard({ finding, reviewedSet, onToggleReviewed }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLES[finding.severity] || SEVERITY_STYLES.info;
  const reviewed = reviewedSet.has(finding.code);
  const impactStr = formatDollarImpact(finding.dollar_impact);

  return (
    <div
      className={`border-l-4 rounded-md ${style.border} ${style.bg} ${
        reviewed ? 'opacity-60' : ''
      }`}
      data-testid="audit-finding"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
      >
        <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.icon}`} />
        <div className="flex-1 min-w-0">
          <div className={`font-medium text-sm ${style.text}`}>
            {finding.title}
          </div>
          {!expanded && (
            <div className="text-xs mt-0.5 text-gray-600 dark:text-gray-400 line-clamp-2">
              {finding.message}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {impactStr && (
            <span className={`text-xs font-semibold ${style.text}`}>
              {impactStr}
            </span>
          )}
          <span
            className={`text-white text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${style.badge}`}
          >
            {finding.severity}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-200 dark:border-gray-700">
          <p className={`text-sm ${style.text} mb-3`}>{finding.message}</p>

          {finding.details && Object.keys(finding.details).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {Object.entries(finding.details).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {typeof val === 'number'
                      ? Math.abs(val) < 1 && Math.abs(val) > 0
                        ? val.toFixed(4)
                        : val.toFixed(2)
                      : String(val)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Source: {finding.source_ref || 'settlement'}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReviewed(finding.code);
              }}
              className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {reviewed ? 'Unmark reviewed' : 'Mark reviewed'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettlementAuditReport({ settlementId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewedSet, setReviewedSet] = useState(new Set());

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await poolSettlementsAPI.audit(settlementId);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run audit');
    } finally {
      setLoading(false);
    }
  }

  function toggleReviewed(code) {
    setReviewedSet(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Running audit…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!report) return null;

  const status = report.summary?.overall_status || 'clean';
  const banner = STATUS_BANNER[status];
  const BannerIcon = banner.icon;
  const counts = report.summary?.counts || { critical: 0, warning: 0, info: 0 };
  const totalImpact = report.summary?.total_abs_dollar_impact;
  const flaggedCount = (counts.critical || 0) + (counts.warning || 0);

  const bannerMessage = banner.message
    || `${flaggedCount} ${flaggedCount === 1 ? 'item' : 'items'} to review`
      + (counts.info ? ` · ${counts.info} informational` : '');

  return (
    <div className="space-y-3" data-testid="audit-report">
      {/* Status banner */}
      <div className={`border-l-4 rounded-md p-4 ${banner.bg}`}>
        <div className="flex items-start gap-3">
          <BannerIcon className={`w-6 h-6 ${banner.iconColor} flex-shrink-0`} />
          <div className="flex-1">
            <div className="font-semibold text-gray-900 dark:text-white">
              {banner.title}
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
              {bannerMessage}
            </div>
          </div>
          {totalImpact > 0 && (
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              <DollarSign className="w-4 h-4" />
              <span>
                {totalImpact.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {' '}total impact
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={load}
            className="p-2 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Re-run audit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Findings */}
      {report.findings.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-4 flex items-center justify-center gap-2">
          <Info className="w-4 h-4" />
          No findings. The settlement reconciles cleanly against your history
          and the packinghouse average.
        </div>
      ) : (
        <div className="space-y-2">
          {report.findings.map((f, idx) => (
            <FindingCard
              key={`${f.code}-${idx}`}
              finding={f}
              reviewedSet={reviewedSet}
              onToggleReviewed={toggleReviewed}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default SettlementAuditReport;
