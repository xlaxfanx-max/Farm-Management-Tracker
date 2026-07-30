import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { pickHaulManualPicksAPI } from '../../services/api';
import { PermissionGate } from '../../contexts/AuthComponents';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import ManualPickModal from './ManualPickModal';
import { formatCurrency, formatDate, formatNumber, rows } from './pickhaulUtils';
import { useEntities, useHouses } from './hooks';

/**
 * Hand-keyed picks for the no-portal houses (Limoneira, Mission, Sun Pac,
 * FPCA, the Avo sheets). The eight legacy sheets become one table with a
 * sheet-label facet.
 */
export default function ManualPicksTab({ season, refresh }) {
  const houses = useHouses();
  const entities = useEntities();
  const confirm = useConfirm();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_pick_haul');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState([]);
  const [sheetFilter, setSheetFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = { season };
    if (sheetFilter) params.sheet = sheetFilter;
    pickHaulManualPicksAPI
      .getAll(params)
      .then((res) => {
        if (!cancelled) setData(rows(res));
      })
      .catch((err) => console.error('Error loading manual picks:', err))
      .finally(() => !cancelled && setLoading(false));
    pickHaulManualPicksAPI
      .getSourceSheets()
      .then((res) => {
        if (!cancelled) setSheets(res.data || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [season, sheetFilter]);

  useEffect(load, [load]);

  const onSaved = () => {
    load();
    refresh();
  };

  const handleDelete = async (pick) => {
    const ok = await confirm({
      title: 'Delete manual pick?',
      message: `Delete the ${pick.sheet} row for ${pick.ranch || '?'} ${pick.block || ''} (${formatDate(pick.pick_date)})?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await pickHaulManualPicksAPI.delete(pick.id);
      toast.success('Manual pick deleted');
      onSaved();
    } catch (error) {
      toast.error('Failed to delete manual pick');
    }
  };

  const columns = [
    { key: 'sheet', label: 'Sheet', render: (v) => (v ? <Badge color="purple" size="xs">{v}</Badge> : '—') },
    { key: 'house_code', label: 'House' },
    { key: 'ranch', label: 'Ranch' },
    { key: 'block', label: 'Block' },
    { key: 'varietal', label: 'Varietal' },
    {
      key: 'pick_date', label: 'Pick Date',
      render: (v, row) => row.date_label || formatDate(v),
    },
    { key: 'bins', label: 'Bins', align: 'right', render: (v) => formatNumber(v) },
    { key: 'lbs', label: 'Lbs', align: 'right', render: (v) => formatNumber(v, 0) },
    { key: 'harvester', label: 'Harvester' },
    { key: 'invoice_no', label: 'Invoice #' },
    {
      key: 'cost', label: 'Pick $', align: 'right',
      render: (v, row) => (
        <span className={row.count_cost ? '' : 'line-through text-gray-400'}
              title={row.count_cost ? undefined : 'Repeat of the invoice above — not counted in totals'}>
          {formatCurrency(v)}
        </span>
      ),
    },
    {
      key: 'haul_cost', label: 'Haul $', align: 'right',
      render: (v, row) => (
        <span className={row.count_haul ? '' : 'line-through text-gray-400'}>
          {formatCurrency(v)}
        </span>
      ),
    },
    { key: 'net_amount', label: 'Net', align: 'right', render: (v) => formatCurrency(v) },
    { key: 'date_paid', label: 'Paid', render: (v) => formatDate(v) },
    {
      key: '_actions', label: '', sortable: false,
      render: (_, row) => (
        <PermissionGate permission="manage_pick_haul">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Delete
          </button>
        </PermissionGate>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSheetFilter('')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
            sheetFilter === ''
              ? 'bg-primary text-white border-primary'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          All sheets
        </button>
        {sheets.map((s) => (
          <button
            key={s}
            onClick={() => setSheetFilter(sheetFilter === s ? '' : s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
              sheetFilter === s
                ? 'bg-primary text-white border-primary'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
        <PermissionGate permission="manage_pick_haul">
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-button bg-primary text-white text-sm hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" /> Add Manual Pick
          </button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyTitle="No manual picks"
        emptyMessage="Picks for the no-portal houses (Limoneira, Mission, Sun Pac, FPCA) are keyed here."
        onRowClick={canManage ? (row) => {
          setEditing(row);
          setModalOpen(true);
        } : undefined}
      />

      <ManualPickModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={onSaved}
        pick={editing}
        season={season}
        houses={houses}
        entities={entities}
        sourceSheets={sheets}
      />
    </div>
  );
}
