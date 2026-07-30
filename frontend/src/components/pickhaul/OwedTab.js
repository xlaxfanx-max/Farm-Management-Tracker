import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { pickHaulInvoicesAPI, PICKHAUL_CONSTANTS } from '../../services/api';
import { PermissionGate } from '../../contexts/AuthComponents';
import Badge from '../ui/Badge';
import MetricCard from '../ui/MetricCard';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import InvoiceDetailModal from './InvoiceDetailModal';
import MarkReceivedModal from './MarkReceivedModal';
import {
  AGING_BADGE_COLORS, agingBucket, formatCurrency, formatDate, rows,
} from './pickhaulUtils';

const BUCKETS = PICKHAUL_CONSTANTS.AGING_BUCKETS;
const TILE_COLORS = { '0_30': 'gray', '31_60': 'amber', '61_90': 'orange', '90_plus': 'red' };

/**
 * The chase list — the screen the accountant opens daily.
 *
 * Definition: invoices paid and emailed to the house that the house has not
 * yet charged back. Grouped per house, oldest first. A row leaves this list
 * only when the matcher posts the charge-back; 'Mark received' records the
 * money arriving but keeps the row (different events, kept apart on purpose).
 */
export default function OwedTab({ season, summary, refresh }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bucketFilter, setBucketFilter] = useState(null);
  const [detail, setDetail] = useState(null);
  const [marking, setMarking] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    pickHaulInvoicesAPI
      .getAll({ season, outstanding: 'true' })
      .then((res) => {
        if (!cancelled) setInvoices(rows(res));
      })
      .catch((err) => console.error('Error loading chase list:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [season]);

  useEffect(load, [load]);

  const onSaved = () => {
    load();
    refresh();
  };

  const buckets = summary?.buckets || {};
  const agingDays = summary?.aging_threshold_days || 45;

  const visible = bucketFilter
    ? invoices.filter((inv) => agingBucket(inv.days_outstanding) === bucketFilter)
    : invoices;

  // Group by house, ordered by each house's oldest outstanding invoice.
  const houseGroups = [];
  const byHouse = new Map();
  for (const inv of visible) {
    const key = `${inv.house_code}/${inv.entity_code}`;
    if (!byHouse.has(key)) {
      const group = { key, house: inv.house_name, entity: inv.entity_code, invoices: [], total: 0, oldest: 0 };
      byHouse.set(key, group);
      houseGroups.push(group);
    }
    const group = byHouse.get(key);
    group.invoices.push(inv);
    group.total += Number(inv.amount || 0);
    group.oldest = Math.max(group.oldest, inv.days_outstanding || 0);
  }
  houseGroups.sort((a, b) => b.oldest - a.oldest);
  houseGroups.forEach((g) =>
    g.invoices.sort((a, b) => (b.days_outstanding || 0) - (a.days_outstanding || 0))
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          title="Total owed by houses"
          value={formatCurrency(summary?.total_owed)}
          subtitle={`${summary?.outstanding_count ?? 0} invoices across ${summary?.houses?.length ?? 0} account${(summary?.houses?.length ?? 0) === 1 ? '' : 's'}`}
          icon={DollarSign}
          color="green"
          onClick={() => setBucketFilter(null)}
          className={bucketFilter === null ? 'ring-2 ring-primary' : ''}
        />
        {BUCKETS.map((b) => (
          <MetricCard
            key={b.key}
            title={b.label}
            value={formatCurrency(buckets[b.key]?.amount ?? 0)}
            subtitle={`${buckets[b.key]?.count ?? 0} invoice${(buckets[b.key]?.count ?? 0) === 1 ? '' : 's'}`}
            color={TILE_COLORS[b.key]}
            onClick={() => setBucketFilter(bucketFilter === b.key ? null : b.key)}
            className={bucketFilter === b.key ? 'ring-2 ring-primary' : ''}
          />
        ))}
      </div>

      {summary?.unmatched_charges?.rows > 0 && (
        <div className="text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-lg px-3 py-2">
          Separately: the houses have posted{' '}
          <strong>{formatCurrency(summary.unmatched_charges.total)}</strong> across{' '}
          {summary.unmatched_charges.rows} charge row{summary.unmatched_charges.rows === 1 ? '' : 's'}{' '}
          with no invoice keyed against them — see House Charges → Unmatched.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" label="Loading…" /></div>
      ) : houseGroups.length === 0 ? (
        <EmptyState
          title="Nothing owed"
          message={bucketFilter ? 'No outstanding invoices in this bucket.' : 'Every emailed invoice has been charged back. The chase list is clear.'}
        />
      ) : (
        houseGroups.map((group) => (
          <div key={group.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-white">{group.house}</span>
                <Badge color="gray" size="xs">{group.entity}</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  {group.invoices.length} outstanding
                </span>
                <Badge color={AGING_BADGE_COLORS[agingBucket(group.oldest)]} size="xs">
                  oldest {group.oldest}d
                </Badge>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(group.total)}
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {group.invoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => setDetail(inv)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 cursor-pointer hover:bg-surface-sunken dark:hover:bg-gray-700/30 transition-colors"
                >
                  <Badge color={inv.kind === 'PICK' ? 'green' : 'blue'} size="xs">{inv.kind}</Badge>
                  <span className="text-sm text-gray-900 dark:text-gray-100 min-w-[7rem]">
                    {inv.contractor || '—'} #{inv.invoice_no}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[6rem]">
                    {formatCurrency(inv.amount)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">
                    {inv.block_raw || ''}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    paid {formatDate(inv.date_paid)} · emailed {formatDate(inv.date_emailed)}
                  </span>
                  <Badge color={AGING_BADGE_COLORS[agingBucket(inv.days_outstanding)]} size="xs">
                    {inv.days_outstanding}d
                  </Badge>
                  {inv.days_outstanding >= agingDays && (
                    <Badge color="red" size="xs">{agingDays}d+</Badge>
                  )}
                  {inv.date_rec_from_ph ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400 italic"
                          title="Money received; still awaiting the house's posted charge to match.">
                      rec'd {formatDate(inv.date_rec_from_ph)}, awaiting charge-back match
                    </span>
                  ) : (
                    <PermissionGate permission="manage_pick_haul">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMarking(inv);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Mark received
                      </button>
                    </PermissionGate>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <InvoiceDetailModal
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        invoice={detail}
      />
      <MarkReceivedModal
        isOpen={Boolean(marking)}
        onClose={() => setMarking(null)}
        onSave={onSaved}
        invoice={marking}
      />
    </div>
  );
}
