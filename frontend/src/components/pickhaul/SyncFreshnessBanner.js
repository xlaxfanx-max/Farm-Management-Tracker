import React, { useState } from 'react';
import { ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDateTime, relativeTime } from './pickhaulUtils';

/**
 * Freshness of the portal data, on every tab.
 *
 * Quiet when fresh; amber past the stale threshold; red when very stale or a
 * source errored. Expands to per-source provenance (file, sha, pulled time).
 */
export default function SyncFreshnessBanner({ syncStatus }) {
  const [expanded, setExpanded] = useState(false);

  if (!syncStatus) return null;

  const { last_push_at, stale, sources = [] } = syncStatus;
  const hasErrorSource = sources.some((s) => s.status !== 'ok');
  const hoursSince = last_push_at
    ? (Date.now() - new Date(last_push_at).getTime()) / 36e5
    : Infinity;
  const severity = hasErrorSource || hoursSince >= 72 ? 'red' : stale ? 'amber' : 'quiet';

  const styles = {
    quiet: 'text-text-secondary',
    amber:
      'bg-yellow-100 border border-yellow-200 text-yellow-800 rounded-card px-3 py-2',
    red: 'bg-danger-bg border border-danger/25 text-danger rounded-card px-3 py-2',
  };

  const label = last_push_at
    ? `Portal data last pushed ${relativeTime(last_push_at)} · ${sources.length} source${sources.length === 1 ? '' : 's'}`
    : 'No portal data has been pushed yet — receipts and house charges are empty until the local pipeline runs.';

  return (
    <div className={`text-sm ${styles[severity]}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        {severity === 'quiet' ? (
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="flex-1">
          {severity !== 'quiet' && last_push_at
            ? `Portal data is stale — last push ${relativeTime(last_push_at)}.`
            : label}
        </span>
        {sources.length > 0 && (
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {expanded && sources.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="py-1 pr-3">Account</th>
                <th className="py-1 pr-3">File</th>
                <th className="py-1 pr-3">Pulled</th>
                <th className="py-1 pr-3">Rows</th>
                <th className="py-1 pr-3">SHA-256</th>
                <th className="py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={`${s.house_code}-${s.entity_code}`} className="border-t border-border/50">
                  <td className="py-1 pr-3 whitespace-nowrap">{s.house_code}/{s.entity_code}</td>
                  <td className="py-1 pr-3">{s.file_name}</td>
                  <td className="py-1 pr-3 whitespace-nowrap">{formatDateTime(s.pulled_at)}</td>
                  <td className="py-1 pr-3">{s.row_count ?? '—'}</td>
                  <td className="py-1 pr-3 font-mono">{(s.sha256 || '').slice(0, 12)}</td>
                  <td className="py-1">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
