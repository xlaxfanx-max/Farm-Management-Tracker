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
    bg: 'bg-danger-bg',
    border: 'border-danger',
    text: 'text-danger',
    icon: 'text-danger',
    badge: 'bg-danger',
  },
  warning: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-500',
    text: 'text-yellow-800',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-500',
  },
  info: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    text: 'text-green-800',
    icon: 'text-green-600',
    badge: 'bg-green-500',
  },
};

const STATUS_BANNER = {
  clean: {
    bg: 'bg-green-50 border-green-500',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    title: 'Clean',
    message: 'No anomalies detected on this settlement.',
  },
  review: {
    bg: 'bg-yellow-100 border-yellow-500',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    title: 'Needs review',
    message: null,
  },
  critical: {
    bg: 'bg-danger-bg border-danger',
    icon: ShieldAlert,
    iconColor: 'text-danger',
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
      className={`border-l-4 rounded-lg ${style.border} ${style.bg} ${
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
            <div className="text-xs mt-0.5 text-bark-600 line-clamp-2">
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
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <p className={`text-sm ${style.text} mb-3`}>{finding.message}</p>

          {finding.details && Object.keys(finding.details).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
              {Object.entries(finding.details).map(([key, val]) => (
                <div
                  key={key}
                  className="bg-surface-raised rounded p-2 border border-border"
                >
                  <div className="text-[11px] text-text-secondary">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm font-medium text-text">
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

          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>Source: {finding.source_ref || 'settlement'}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReviewed(finding.code);
              }}
              className="px-2 py-1 rounded border border-border-strong hover:bg-cream-100"
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
      <div className="flex items-center gap-2 text-sm text-text-secondary p-4">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Running audit…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-danger-bg border border-danger/25 rounded p-3 text-sm text-danger">
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
      <div className={`border-l-4 rounded-lg p-4 ${banner.bg}`}>
        <div className="flex items-start gap-3">
          <BannerIcon className={`w-6 h-6 ${banner.iconColor} flex-shrink-0`} />
          <div className="flex-1">
            <div className="font-semibold text-heading">
              {banner.title}
            </div>
            <div className="text-sm text-bark-700 mt-0.5">
              {bannerMessage}
            </div>
          </div>
          {totalImpact > 0 && (
            <div className="flex items-center gap-1 text-sm font-medium text-bark-700">
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
            className="p-2 text-text-secondary hover:text-bark-700 rounded hover:bg-cream-100"
            title="Re-run audit"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Findings */}
      {report.findings.length === 0 ? (
        <div className="text-sm text-text-secondary text-center py-4 flex items-center justify-center gap-2">
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
