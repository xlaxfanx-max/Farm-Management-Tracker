import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, DollarSign, Package, Plus, Truck, Wheat } from 'lucide-react';
import {
  pickHaulInvoicesAPI, pickHaulStatusAPI,
} from '../../services/api';
import { PermissionGate } from '../../contexts/AuthComponents';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';
import MetricCard from '../ui/MetricCard';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import ChaseList from './ChaseList';
import InvoiceModal from './InvoiceModal';
import ManualPickModal from './ManualPickModal';
import InvoiceDetailModal from './InvoiceDetailModal';
import MarkReceivedModal from './MarkReceivedModal';
import {
  formatCurrency, formatDate, formatNumber, rows,
} from './pickhaulUtils';
import { useEntities, useHouses } from './hooks';

/**
 * The season's real deliveries — receipts ARE the harvest record.
 *
 * Portal receipts and hand-keyed manual picks, grouped by block, each carrying
 * its share of the matched contractor invoices. The money strip above answers
 * the accountant's daily question: what have the houses not paid back yet.
 */
export default function DeliveriesView({ season, refresh }) {
  const houses = useHouses();
  const entities = useEntities();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_pick_haul');

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [owedOpen, setOwedOpen] = useState(false);
  const [owedInvoices, setOwedInvoices] = useState([]);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [pickModal, setPickModal] = useState({ open: false, pick: null });
  const [detail, setDetail] = useState(null);
  const [marking, setMarking] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    pickHaulStatusAPI
      .getHarvestActivity({ season })
      .then((res) => {
        if (!cancelled) setActivity(res.data);
      })
      .catch((err) => console.error('Error loading harvest activity:', err))
      .finally(() => !cancelled && setLoading(false));
    pickHaulInvoicesAPI
      .getAll({ season, outstanding: 'true' })
      .then((res) => {
        if (!cancelled) setOwedInvoices(rows(res));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [season]);

  useEffect(load, [load]);

  const onSaved = () => {
    load();
    refresh?.();
  };

  if (loading && !activity) {
    return <div className="flex justify-center py-16"><Spinner size="lg" label="Loading deliveries…" /></div>;
  }

  const stats = activity?.stats || {};
  const blocks = activity?.blocks || [];

  return (
    <div className="space-y-4">
      {/* Money + volume strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        <MetricCard
          title="Bins delivered"
          value={formatNumber(stats.bins_delivered)}
          subtitle={`${stats.deliveries ?? 0} deliveries`}
          icon={Package}
          color="green"
        />
        <MetricCard
          title="Pick cost"
          value={formatCurrency(stats.pick_cost)}
          icon={Wheat}
          color="blue"
        />
        <MetricCard
          title="Haul cost"
          value={formatCurrency(stats.haul_cost)}
          icon={Truck}
          color="blue"
        />
        <MetricCard
          title="Cost / bin"
          value={stats.cost_per_bin != null ? formatCurrency(stats.cost_per_bin) : '—'}
          color="gray"
        />
        <MetricCard
          title="Owed by houses"
          value={formatCurrency(stats.owed_total)}
          subtitle={`${stats.owed_count ?? 0} grower-paid invoices — ${owedOpen ? 'hide' : 'show'} chase list`}
          icon={DollarSign}
          color={(stats.owed_count ?? 0) > 0 ? 'amber' : 'gray'}
          onClick={() => setOwedOpen((v) => !v)}
          className={owedOpen ? 'ring-2 ring-primary' : ''}
        />
        <MetricCard
          title="Unmatched charges"
          value={formatCurrency(stats.unmatched_charges?.total)}
          subtitle={`${stats.unmatched_charges?.rows ?? 0} house row${(stats.unmatched_charges?.rows ?? 0) === 1 ? '' : 's'}, no invoice keyed`}
          color={(stats.unmatched_charges?.rows ?? 0) > 0 ? 'orange' : 'gray'}
        />
      </div>

      {/* Chase list, expanded from the Owed tile */}
      {owedOpen && (
        <div className="space-y-2">
          <h3 className="text-sm text-bark-700">
            Owed by houses — paid &amp; emailed, not yet charged back
          </h3>
          <ChaseList
            invoices={owedInvoices}
            onSelect={setDetail}
            onMarkReceived={setMarking}
          />
        </div>
      )}

      {/* Entry actions */}
      <PermissionGate permission="manage_pick_haul">
        <div className="flex gap-2">
          <button
            onClick={() => setInvoiceModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-button bg-primary text-white text-sm hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" /> Record Invoice
          </button>
          <button
            onClick={() => setPickModal({ open: true, pick: null })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-button border border-primary text-primary text-sm hover:bg-primary-light"
          >
            <ClipboardList className="w-4 h-4" /> Record Manual Pick
          </button>
        </div>
      </PermissionGate>

      {/* Deliveries, grouped by block */}
      {blocks.length === 0 ? (
        <EmptyState
          title="No deliveries yet"
          message="Portal receipts arrive with the local pipeline's daily push; picks for no-portal houses are keyed here."
        />
      ) : (
        blocks.map((block) => (
          <div
            key={`${block.house_code}-${block.block}`}
            className="bg-surface-raised rounded-card border border-border overflow-hidden"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-cream-50">
              <div className="flex items-center gap-2">
                <span className="font-medium text-heading">{block.block}</span>
                <Badge color="gray" size="xs">{block.house_code}/{block.entity_code}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-bark-600">
                <span>{formatNumber(block.bins)} bins</span>
                <span>pick {formatCurrency(block.pick_cost)}</span>
                <span>haul {formatCurrency(block.haul_cost)}</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary uppercase tracking-wider">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Ticket</th>
                  <th className="px-4 py-2 text-right">Bins</th>
                  <th className="px-4 py-2 text-right">Pick $</th>
                  <th className="px-4 py-2 text-right">Haul $</th>
                  <th className="px-4 py-2">Invoices</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {block.deliveries.map((d) => (
                  <tr
                    key={`${d.kind}-${d.id}`}
                    className={`${d.kind === 'manual' && canManage ? 'cursor-pointer hover:bg-surface-sunken' : ''} ${!d.is_active ? 'opacity-60' : ''}`}
                    onClick={
                      d.kind === 'manual' && canManage
                        ? () => setPickModal({ open: true, pick: { id: d.id } })
                        : undefined
                    }
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
                      {d.date_label || formatDate(d.pick_date) || d.pick_date_raw || '—'}
                    </td>
                    <td className="px-4 py-2">
                      {d.kind === 'receipt' ? (
                        <>#{d.receipt_no}</>
                      ) : (
                        <Badge color="purple" size="xs">{d.sheet || 'manual'}</Badge>
                      )}
                      {!d.is_active && (
                        <Badge color="amber" size="xs" className="ml-1.5">vanished from portal</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{formatNumber(d.bins)}</td>
                    <td className="px-4 py-2 text-right" title={d.cost_basis === 'allocated' ? 'Allocated from the matched invoice, proportional to bins' : undefined}>
                      <span className={d.count_cost === false ? 'line-through text-text-muted' : ''}>
                        {formatCurrency(d.pick_cost)}
                      </span>
                      {d.cost_basis === 'allocated' && d.pick_cost != null && (
                        <span className="text-text-muted text-xs align-super">*</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={d.count_haul === false ? 'line-through text-text-muted' : ''}>
                        {formatCurrency(d.haul_cost)}
                      </span>
                      {d.cost_basis === 'allocated' && d.haul_cost != null && (
                        <span className="text-text-muted text-xs align-super">*</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        {(d.invoice_refs || []).slice(0, 3).map((ref) => (
                          <button
                            key={`${ref.kind}-${ref.invoice_id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              pickHaulInvoicesAPI.get(ref.invoice_id)
                                .then((res) => setDetail(res.data))
                                .catch(() => {});
                            }}
                            title={`${ref.contractor || ''} ${ref.kind} invoice`}
                          >
                            <Badge color={ref.kind === 'PICK' ? 'green' : 'blue'} size="xs">
                              #{ref.invoice_no}
                            </Badge>
                          </button>
                        ))}
                        {(d.invoice_refs || []).length > 3 && (
                          <span className="text-xs text-text-muted">
                            +{d.invoice_refs.length - 3} more
                          </span>
                        )}
                        {d.kind === 'manual' && d.invoice_no && (
                          <Badge color="gray" size="xs">#{d.invoice_no}</Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-text-muted">
                      {d.kind === 'manual' && canManage ? 'edit' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <p className="text-xs text-text-muted">
        * cost allocated from the matched contractor invoice, proportional to bins.
        The invoice remains the money record.
      </p>

      <InvoiceModal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        onSave={onSaved}
        invoice={null}
        season={season}
        houses={houses}
        entities={entities}
      />
      <ManualPickEditLoader
        state={pickModal}
        onClose={() => setPickModal({ open: false, pick: null })}
        onSave={onSaved}
        season={season}
        houses={houses}
        entities={entities}
      />
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

/** Loads the full manual pick before opening the modal (activity rows are slim). */
function ManualPickEditLoader({ state, onClose, onSave, season, houses, entities }) {
  const [full, setFull] = useState(null);

  useEffect(() => {
    if (state.open && state.pick?.id) {
      import('../../services/api').then(({ pickHaulManualPicksAPI }) =>
        pickHaulManualPicksAPI.get(state.pick.id)
          .then((res) => setFull(res.data))
          .catch(() => setFull(null))
      );
    } else {
      setFull(null);
    }
  }, [state]);

  if (state.open && state.pick?.id && !full) return null;

  return (
    <ManualPickModal
      isOpen={state.open}
      onClose={onClose}
      onSave={onSave}
      pick={full}
      season={season}
      houses={houses}
      entities={entities}
      sourceSheets={[]}
    />
  );
}
