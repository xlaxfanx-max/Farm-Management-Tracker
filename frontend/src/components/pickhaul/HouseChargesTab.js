import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { pickHaulChargesAPI } from '../../services/api';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { inputClasses, selectClasses } from '../ui/FormField';
import { formatCurrency, formatDate, formatNumber, rows } from './pickhaulUtils';
import { useHouses } from './hooks';

/**
 * The house's own posted picking/hauling charges — read-only. Every invoice
 * should eventually match one of these; an unmatched charge is money the house
 * says it billed with nothing in the register accounting for it (gate 11).
 */
export default function HouseChargesTab({ season }) {
  const houses = useHouses();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [house, setHouse] = useState('');
  const [kind, setKind] = useState('');
  const [matched, setMatched] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { season };
    if (house) params.house = house;
    if (kind) params.kind = kind;
    if (matched) params.matched = matched;
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
  }, [season, house, kind, matched, search]);

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
      key: 'matched_invoice_id', label: 'Matched',
      render: (v) =>
        v ? <Badge color="green" size="xs">invoice #{v}</Badge>
          : <Badge color="amber" size="xs">no invoice</Badge>,
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
        <select value={matched} onChange={(e) => setMatched(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">All charges</option>
          <option value="true">Matched</option>
          <option value="false">Unmatched (needs an invoice)</option>
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
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
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
