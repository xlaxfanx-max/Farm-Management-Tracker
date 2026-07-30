import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { pickHaulReceiptsAPI } from '../../services/api';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { inputClasses, selectClasses } from '../ui/FormField';
import { formatDate, formatNumber, rows } from './pickhaulUtils';
import { useHouses } from './hooks';

/**
 * Portal receipts — read-only. One row per bin delivery ticket, exactly as the
 * house's export printed it. A receipt that vanishes from a later portal pull
 * is flagged, never deleted.
 */
export default function ReceiptsTab({ season }) {
  const houses = useHouses();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [house, setHouse] = useState('');
  const [active, setActive] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { season };
    if (house) params.house = house;
    if (active) params.active = active;
    if (search) params.search = search;
    pickHaulReceiptsAPI
      .getAll(params)
      .then((res) => {
        if (!cancelled) setData(rows(res));
      })
      .catch((err) => console.error('Error loading receipts:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [season, house, active, search]);

  const columns = [
    { key: 'house_code', label: 'House' },
    { key: 'entity_code', label: 'Entity' },
    { key: 'receipt_no', label: 'Receipt #' },
    {
      key: 'pick_date', label: 'Pick Date',
      render: (v, row) => (v ? formatDate(v) : row.pick_date_raw || '—'),
    },
    { key: 'block_raw', label: 'Block' },
    { key: 'variety_code', label: 'Variety' },
    { key: 'bins', label: 'Bins', align: 'right', render: (v) => formatNumber(v) },
    {
      key: 'is_active', label: 'Status',
      render: (v) =>
        v ? (
          <Badge color="green" size="xs">active</Badge>
        ) : (
          <Badge color="amber" size="xs">vanished from portal</Badge>
        ),
    },
    {
      key: 'covered', label: 'Pick Invoice',
      render: (v) =>
        v ? <Badge color="gray" size="xs">covered</Badge>
          : <Badge color="blue" size="xs">not yet</Badge>,
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
        <select value={active} onChange={(e) => setActive(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">All receipts</option>
          <option value="true">Active only</option>
          <option value="false">Vanished only</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Receipt # or block…"
            className={`${inputClasses} pl-8`}
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
          {data.length} receipt{data.length === 1 ? '' : 's'}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyTitle="No receipts"
        emptyMessage="Receipts arrive with the local pipeline's daily push."
        defaultSort={{ key: 'pick_date', dir: 'desc' }}
      />
    </div>
  );
}
