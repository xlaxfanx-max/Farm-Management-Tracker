// =============================================================================
// POOL LEDGER TAB — Advances & Payments
// The dated record of cash the house has sent for this pool: advances during
// the season, the pool-close check, adjustments. Reconciled at pool close
// against the settlement's "prior advances" figure by the settlement audit.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2 } from 'lucide-react';
import { growerLedgerAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import LedgerEntryModal from './LedgerEntryModal';

const TYPE_COLORS = {
  advance: 'bg-green-100 text-green-700',
  pool_close: 'bg-orange-100 text-orange-700',
  payment: 'bg-green-100 text-green-800',
  adjustment: 'bg-yellow-200 text-yellow-800',
  refund: 'bg-sand-200 text-bark-800',
  capital_equity: 'bg-cream-100 text-text',
};

const PoolLedgerTab = ({ pool }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await growerLedgerAPI.getAll({ pool: pool.id });
      const data = res.data;
      setEntries(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Error fetching ledger entries:', error);
    } finally {
      setLoading(false);
    }
  }, [pool.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = async (entry) => {
    const proceed = await confirm({
      title: 'Delete entry?',
      message: `Delete ${entry.entry_type_display || entry.entry_type} of $${entry.credit || entry.debit} on ${entry.entry_date}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!proceed) return;
    try {
      await growerLedgerAPI.delete(entry.id);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  // Oldest first for the running total; API returns newest first.
  const chronological = [...entries].sort(
    (a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : a.id - b.id)
  );
  let running = 0;
  const withRunning = chronological.map((e) => {
    running += Number(e.credit || 0) - Number(e.debit || 0);
    return { ...e, running_total: running };
  });

  const advancesTotal = entries
    .filter((e) => e.entry_type === 'advance')
    .reduce((sum, e) => sum + Number(e.credit || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-bark-600">
          {entries.length > 0 && (
            <>
              <span className="font-semibold">{formatCurrency(advancesTotal)}</span>
              {' '}in recorded advances — reconciled against the settlement's
              “prior advances” at pool close
            </>
          )}
        </div>
        <button
          onClick={() => { setEditEntry(null); setShowModal(true); }}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Record Advance
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 bg-cream-50 rounded-lg">
          <DollarSign className="w-12 h-12 mx-auto text-sand-300 mb-3" />
          <p className="text-text-secondary">No advances or payments recorded for this pool yet.</p>
          <p className="text-sm text-text-muted mt-1">
            Record each check as it arrives so the pool-close settlement can be
            reconciled against what was actually received.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-border overflow-hidden">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-cream-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Running Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withRunning.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-primary-light cursor-pointer transition-colors"
                  onClick={() => { setEditEntry(entry); setShowModal(true); }}
                >
                  <td className="px-4 py-3 text-sm">
                    {new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[entry.entry_type] || 'bg-cream-100 text-text'}`}>
                      {entry.entry_type_display || entry.entry_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-bark-600">{entry.reference || '—'}</td>
                  <td className="px-4 py-3 text-sm text-bark-600">{entry.description || '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {formatCurrency(entry.credit || entry.debit)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-text-secondary">
                    {formatCurrency(entry.running_total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(entry); }}
                      className="p-1 text-text-muted hover:text-danger rounded"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <LedgerEntryModal
          packinghouseId={pool.packinghouse}
          poolId={pool.id}
          entry={editEntry}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchEntries();
          }}
        />
      )}
    </div>
  );
};

export default PoolLedgerTab;
