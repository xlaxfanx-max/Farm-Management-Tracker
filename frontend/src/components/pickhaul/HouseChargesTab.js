import React, { useCallback, useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { pickHaulChargesAPI } from '../../services/api';
import { PermissionGate } from '../../contexts/AuthComponents';
import { useToast } from '../../contexts/ToastContext';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { inputClasses, selectClasses } from '../ui/FormField';
import { formatCurrency, formatDate, formatNumber, rows } from './pickhaulUtils';
import { useHouses } from './hooks';

/**
 * The house's own posted picking/hauling charges — read-only rows. Every
 * charge should be accounted for one of two ways: matched to a contractor
 * invoice in the register, or acknowledged as expected house-billed work
 * (the contractor bills the house directly, so no grower invoice exists).
 * Anything else is gate-11 money.
 */
export default function HouseChargesTab({ season }) {
  const houses = useHouses();
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [house, setHouse] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetchCharges = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = { season };
    if (house) params.house = house;
    if (kind) params.kind = kind;
    if (status === 'matched') params.matched = 'true';
    else if (status === 'needs_action') { params.matched = 'false'; params.acked = 'false'; }
    else if (status === 'acked') params.acked = 'true';
    if (search) params.search = search;
    pickHaulChargesAPI
      .getAll(params)
      .then((res) => {
        if (!cancelled) setData(rows(res));
      })
      .catch((err) => console.error('Error loading house charges:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [season, house, kind, status, search]);

  useEffect(() => fetchCharges(), [fetchCharges]);

  const handleAck = async (row) => {
    try {
      await pickHaulChargesAPI.ack(row.id, { reason: 'house_billed' });
      toast.success('Marked as expected house-billed');
      fetchCharges();
    } catch (err) {
      console.error('Error acking charge:', err);
      toast.error('Failed to mark charge');
    }
  };

  const handleUnack = async (row) => {
    try {
      await pickHaulChargesAPI.unack(row.id);
      toast.success('Acknowledgment removed');
      fetchCharges();
    } catch (err) {
      console.error('Error removing ack:', err);
      toast.error('Failed to remove acknowledgment');
    }
  };

  const columns = [
    { key: 'house_code', label: 'House' },
    { key: 'entity_code', label: 'Entity' },
    { key: 'charge_date', label: 'Date', render: (v, row) => (v ? formatDate(v) : row.charge_date_raw || '—') },
    { key: 'kind', label: 'Kind', render: (v) => <Badge color={v === 'PICK' ? 'green' : v === 'HAUL' ? 'blue' : 'gray'} size="xs">{v}</Badge> },
    { key: 'charge_desc', label: 'Description' },
    { key: 'ap_reference', label: 'AP Reference' },
    { key: 'block_raw', label: 'Block' },
    { key: 'debit', label: 'Debit', align: 'right', render: (v) => formatCurrency(v) },
    { key: 'qty', label: 'Qty', align: 'right', render: (v) => formatNumber(v) },
    {
      key: 'matched_invoice_id', label: 'Matched', sortable: false,
      render: (v, row) => {
        if (v) return <Badge color="green" size="xs">invoice #{v}</Badge>;
        if (row.acked) {
          return (
            <span className="inline-flex items-center gap-1">
              <Badge color="gray" size="xs" title={row.ack_note || undefined}>
                {row.ack_reason === 'disputed' ? 'disputed' : 'expected house-billed'}
              </Badge>
              <PermissionGate permission="manage_pick_haul">
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnack(row); }}
                  title="Remove acknowledgment"
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </PermissionGate>
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-2">
            <Badge color="amber" size="xs">no invoice</Badge>
            <PermissionGate permission="manage_pick_haul">
              <button
                onClick={(e) => { e.stopPropagation(); handleAck(row); }}
                title="The contractor bills the house directly — no grower invoice will exist"
                className="text-xs text-blue-600 hover:underline whitespace-nowrap"
              >
                Mark expected
              </button>
            </PermissionGate>
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={house} onChange={(e) => setHouse(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">All houses</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.short_code || h.name}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">Pick &amp; haul</option>
          <option value="PICK">Pick</option>
          <option value="HAUL">Haul</option>
          <option value="OTHER">Other</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">All charges</option>
          <option value="matched">Matched</option>
          <option value="needs_action">Unmatched (needs action)</option>
          <option value="acked">Acknowledged</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="AP reference or block…"
            className={`${inputClasses} pl-8`}
          />
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          {data.length} charge{data.length === 1 ? '' : 's'}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyTitle="No house charges"
        emptyMessage="House charges arrive with the local pipeline's daily push."
        defaultSort={{ key: 'charge_date', dir: 'desc' }}
      />
    </div>
  );
}
