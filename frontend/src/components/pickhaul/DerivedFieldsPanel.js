import React from 'react';
import { Lock } from 'lucide-react';
import Badge from '../ui/Badge';
import { PICKHAUL_CONSTANTS } from '../../services/api';
import { formatDate } from './pickhaulUtils';

/**
 * The machine-owned block of an invoice: charged-back date, AP reference,
 * match method. Grey and locked — the modern EFEFEF. These update when house
 * charges sync or the invoice is re-reconciled; nothing here is editable.
 */
export default function DerivedFieldsPanel({ invoice }) {
  if (!invoice) return null;
  const method = invoice.match_method || '';
  const methodInfo = PICKHAUL_CONSTANTS.MATCH_METHODS[method];

  return (
    <div className="rounded-lg bg-gray-100 border border-gray-200 p-3">
      <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <Lock className="w-3 h-3" />
        Owned by the matcher — updates when house charges sync
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500">
            {invoice.billing === 'house_billed'
              ? 'Charge confirmed against sales'
              : 'House charged back'}
          </div>
          <div className="text-gray-600 italic">
            {formatDate(invoice.charge_posted)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">AP Reference</div>
          <div className="text-gray-600 italic">
            {invoice.ap_reference || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Match method</div>
          {method ? (
            <Badge color={methodInfo?.color || 'gray'} size="xs">
              {methodInfo?.label || method}
            </Badge>
          ) : (
            <span className="text-gray-600 italic">not yet run</span>
          )}
        </div>
      </div>
      {methodInfo?.explanation && (
        <p className="mt-2 text-xs text-gray-500">{methodInfo.explanation}</p>
      )}
      {invoice.billing === 'house_billed' && (
        <p className="mt-2 text-xs text-gray-500">
          House-billed invoice: the charge above confirms the deduction against
          sales — it is not a reimbursement event, and nothing is chased.
        </p>
      )}
    </div>
  );
}
