import React from 'react';
import { PermissionGate } from '../../contexts/AuthComponents';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import {
  AGING_BADGE_COLORS, agingBucket, formatCurrency, formatDate,
} from './pickhaulUtils';

/**
 * The owed-by-houses chase list: outstanding invoices grouped per house,
 * oldest first. A row leaves this list only when the matcher posts the
 * charge-back; 'Mark received' records the money arriving but keeps the row.
 */
export default function ChaseList({ invoices, agingDays = 45, onSelect, onMarkReceived }) {
  if (!invoices.length) {
    return (
      <EmptyState
        title="Nothing owed"
        message="Every emailed invoice has been charged back. The chase list is clear."
      />
    );
  }

  const houseGroups = [];
  const byHouse = new Map();
  for (const inv of invoices) {
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
      {houseGroups.map((group) => (
        <div key={group.key} className="bg-white rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-cream-50">
            <div className="flex items-center gap-2">
              <span className="font-medium text-heading">{group.house}</span>
              <Badge color="gray" size="xs">{group.entity}</Badge>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-text-secondary">
                {group.invoices.length} outstanding
              </span>
              <Badge color={AGING_BADGE_COLORS[agingBucket(group.oldest)]} size="xs">
                oldest {group.oldest}d
              </Badge>
              <span className="font-semibold text-heading">
                {formatCurrency(group.total)}
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {group.invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onSelect?.(inv)}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 cursor-pointer hover:bg-surface-sunken transition-colors"
              >
                <Badge color={inv.kind === 'PICK' ? 'green' : 'blue'} size="xs">{inv.kind}</Badge>
                <span className="text-sm text-heading min-w-[7rem]">
                  {inv.contractor || '—'} #{inv.invoice_no}
                </span>
                <span className="text-sm font-medium text-heading min-w-[6rem]">
                  {formatCurrency(inv.amount)}
                </span>
                <span className="text-xs text-text-secondary flex-1">
                  {inv.block_raw || ''}
                </span>
                <span className="text-xs text-text-secondary">
                  paid {formatDate(inv.date_paid)} · emailed {formatDate(inv.date_emailed)}
                </span>
                <Badge color={AGING_BADGE_COLORS[agingBucket(inv.days_outstanding)]} size="xs">
                  {inv.days_outstanding}d
                </Badge>
                {inv.days_outstanding >= agingDays && (
                  <Badge color="red" size="xs">{agingDays}d+</Badge>
                )}
                {inv.date_rec_from_ph ? (
                  <span className="text-xs text-text-secondary italic"
                        title="Money received; still awaiting the house's posted charge to match.">
                    rec'd {formatDate(inv.date_rec_from_ph)}, awaiting charge-back match
                  </span>
                ) : (
                  <PermissionGate permission="manage_pick_haul">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkReceived?.(inv);
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
      ))}
    </div>
  );
}
