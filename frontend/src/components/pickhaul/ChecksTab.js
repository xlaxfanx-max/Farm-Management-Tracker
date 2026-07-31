import React, { useEffect, useState } from 'react';
import { pickHaulInvoicesAPI, pickHaulStatusAPI } from '../../services/api';
import StatusBadge from '../ui/StatusBadge';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import InvoiceDetailModal from './InvoiceDetailModal';
import { formatDateTime, rows, SEVERITY_COLORS } from './pickhaulUtils';

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };
const SEVERITY_LABELS = { error: 'Errors', warn: 'Warnings', info: 'Info' };

/**
 * The reconciliation gates, verbatim. Local gates (season, freshness, file
 * integrity) run on the machine that holds the files and arrive with each
 * push; platform gates (orphans, coverage, sanity, aging, hauling cover,
 * unmatched charges) run here after every push and edit.
 */
export default function ChecksTab({ season, syncStatus }) {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pickHaulStatusAPI
      .getChecks({ season })
      .then((res) => {
        if (!cancelled) setChecks(rows(res));
      })
      .catch((err) => console.error('Error loading checks:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [season]);

  const openInvoice = async (invoiceId) => {
    try {
      const res = await pickHaulInvoicesAPI.get(invoiceId);
      setDetail(res.data);
    } catch (err) {
      console.error('Error loading invoice:', err);
    }
  };

  // Group: severity -> gate -> findings.
  const bySeverity = { error: [], warn: [], info: [] };
  checks.forEach((c) => (bySeverity[c.severity] || bySeverity.info).push(c));
  Object.values(bySeverity).forEach((list) =>
    list.sort((a, b) => a.gate - b.gate || String(a.subject).localeCompare(String(b.subject)))
  );

  if (loading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" label="Loading…" /></div>;
  }

  return (
    <div className="space-y-5">
      {checks.length === 0 && (
        <EmptyState title="All gates clear" message="No findings for this season." />
      )}

      {Object.keys(SEVERITY_ORDER).map((severity) => {
        const list = bySeverity[severity];
        if (!list.length) return null;
        return (
          <div key={severity}>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={severity} label={SEVERITY_LABELS[severity]} colorScheme={{
                error: 'red', warn: 'amber', info: 'blue',
              }[severity]} />
              <span className="text-sm text-text-secondary">{list.length}</span>
            </div>
            <div className="space-y-1.5">
              {list.map((c) => (
                <div
                  key={c.id}
                  onClick={c.invoice ? () => openInvoice(c.invoice) : undefined}
                  className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-card border px-3 py-2 text-sm bg-surface-raised border-border ${
                    c.invoice ? 'cursor-pointer hover:bg-surface-sunken' : ''
                  }`}
                >
                  <Badge color={SEVERITY_COLORS[c.severity]} size="xs">
                    gate {c.gate} · {c.gate_name}
                  </Badge>
                  <Badge color={c.origin === 'local' ? 'purple' : 'gray'} size="xs">
                    {c.origin}
                  </Badge>
                  {(c.house_code || c.entity_code) && (
                    <span className="text-xs text-text-secondary">
                      {c.house_code || '—'}/{c.entity_code || '—'}
                    </span>
                  )}
                  <span className="flex-1 text-bark-700 basis-full md:basis-auto">
                    {c.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div>
        <h3 className="text-sm text-bark-700 mb-2">Data sources</h3>
        {syncStatus?.sources?.length ? (
          <div className="overflow-x-auto bg-surface-raised rounded-card border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-50 text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Pulled</th>
                  <th className="px-4 py-2">Rows</th>
                  <th className="px-4 py-2">SHA-256</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {syncStatus.sources.map((s) => (
                  <tr key={`${s.house_code}-${s.entity_code}`}>
                    <td className="px-4 py-2 whitespace-nowrap">{s.house_code}/{s.entity_code}</td>
                    <td className="px-4 py-2">{s.file_name}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(s.pulled_at)}</td>
                    <td className="px-4 py-2">{s.row_count ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{(s.sha256 || '').slice(0, 12)}</td>
                    <td className="px-4 py-2">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary italic">
            No portal pulls recorded yet for this season.
          </p>
        )}
      </div>

      <InvoiceDetailModal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        invoice={detail}
      />
    </div>
  );
}
