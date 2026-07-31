import React from 'react';
import { FileSearch } from 'lucide-react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import DerivedFieldsPanel from './DerivedFieldsPanel';
import { formatCurrency, formatDate, formatNumber } from './pickhaulUtils';

function Item({ label, children }) {
  return (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="text-sm text-heading">{children}</div>
    </div>
  );
}

/**
 * Read-only invoice inspection: the human-keyed fields, the machine-derived
 * block, the receipts the invoice covers, and the house charge that pays it.
 */
export default function InvoiceDetailModal({ isOpen, onClose, invoice }) {
  if (!invoice) return null;

  const receipts = invoice.matched_receipts || [];
  const charges = invoice.matched_charges || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${invoice.kind} invoice #${invoice.invoice_no || '?'}`}
      subtitle={`${invoice.contractor || 'No contractor'} · ${invoice.house_code}/${invoice.entity_code}`}
      icon={FileSearch}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Item label="Amount">{formatCurrency(invoice.amount)}</Item>
          <Item label="Block">{invoice.block_raw || '—'}</Item>
          <Item label="Covers picks">{formatDate(invoice.date_from)} – {formatDate(invoice.date_to)}</Item>
          <Item label="Kind"><Badge color={invoice.kind === 'PICK' ? 'green' : 'blue'} size="xs">{invoice.kind}</Badge></Item>
          <Item label="Paid">{formatDate(invoice.date_paid)}</Item>
          <Item label="Emailed to house">{formatDate(invoice.date_emailed)}</Item>
          <Item label="Rec'd from PH">{formatDate(invoice.date_rec_from_ph)}</Item>
          <Item label="Outstanding">
            {invoice.days_outstanding != null ? `${invoice.days_outstanding} days` : '—'}
          </Item>
        </div>

        <DerivedFieldsPanel invoice={invoice} />

        <div>
          <h4 className="text-sm text-bark-700 mb-1.5">
            Matched house charge{charges.length === 1 ? '' : 's'}
          </h4>
          {charges.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="py-1 pr-3">AP Reference</th>
                  <th className="py-1 pr-3">Kind</th>
                  <th className="py-1 pr-3">Posted</th>
                  <th className="py-1 text-right">Debit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {charges.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-3">{c.ap_reference || '—'}</td>
                    <td className="py-1.5 pr-3">{c.kind}</td>
                    <td className="py-1.5 pr-3">{formatDate(c.charge_date)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(c.debit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-text-secondary italic">
              No house charge matched yet — that's why this row is on the chase list.
            </p>
          )}
        </div>

        <div>
          <h4 className="text-sm text-bark-700 mb-1.5">
            Linked receipts ({receipts.length})
          </h4>
          {receipts.length ? (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary">
                    <th className="py-1 pr-3">Receipt #</th>
                    <th className="py-1 pr-3">Pick date</th>
                    <th className="py-1 pr-3">Block</th>
                    <th className="py-1 text-right">Bins</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="py-1.5 pr-3">{r.receipt_no}</td>
                      <td className="py-1.5 pr-3">{formatDate(r.pick_date)}</td>
                      <td className="py-1.5 pr-3">{r.block_raw || '—'}</td>
                      <td className="py-1.5 text-right">{formatNumber(r.bins)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-secondary italic">
              No receipts linked — set a block and date range, or this may be a no-portal house.
            </p>
          )}
        </div>

        {invoice.notes && (
          <div>
            <h4 className="text-sm text-bark-700 mb-1">Notes</h4>
            <p className="text-sm text-bark-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
