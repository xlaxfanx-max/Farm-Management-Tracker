import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Plus, Search } from 'lucide-react';
import { pickHaulInvoicesAPI, PICKHAUL_CONSTANTS } from '../../services/api';
import { PermissionGate } from '../../contexts/AuthComponents';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import DataTable from '../ui/DataTable';
import Badge from '../ui/Badge';
import { inputClasses, selectClasses } from '../ui/FormField';
import InvoiceModal from './InvoiceModal';
import { derivedCellClasses, formatCurrency, formatDate, rows } from './pickhaulUtils';
import { useEntities, useHouses } from './hooks';

/**
 * The invoice register. Column order mirrors the Excel sheet; the three
 * derived columns render grey with a lock in the header — the matcher owns
 * them, the accountant owns everything else.
 */
export default function InvoicesTab({ season, refresh }) {
  const houses = useHouses();
  const entities = useEntities();
  const confirm = useConfirm();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_pick_haul');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [house, setHouse] = useState('');
  const [kind, setKind] = useState('');
  const [matched, setMatched] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = { season };
    if (house) params.house = house;
    if (kind) params.kind = kind;
    if (matched) params.matched = matched;
    if (search) params.search = search;
    pickHaulInvoicesAPI
      .getAll(params)
      .then((res) => {
        if (!cancelled) setData(rows(res));
      })
      .catch((err) => console.error('Error loading invoices:', err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [season, house, kind, matched, search]);

  useEffect(load, [load]);

  const onSaved = () => {
    load();
    refresh();
  };

  const handleDelete = async (invoice) => {
    const isMatched = Boolean(invoice.charge_posted);
    const ok = await confirm({
      title: 'Delete invoice?',
      message: isMatched
        ? `This invoice is matched to house charge ${invoice.ap_reference}. Deleting it will orphan that charge and it will reappear as unmatched.`
        : `Delete ${invoice.kind} invoice #${invoice.invoice_no} (${formatCurrency(invoice.amount)})?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await pickHaulInvoicesAPI.delete(invoice.id);
      toast.success(`Invoice #${invoice.invoice_no} deleted`);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete invoice');
    }
  };

  const lockedHeader = (label) => (
    <span className="inline-flex items-center gap-1" title="Computed by the matcher — not editable">
      {label}
      <Lock className="w-3 h-3" />
    </span>
  );

  const columns = [
    { key: 'house_code', label: 'House' },
    { key: 'entity_code', label: 'Entity' },
    {
      key: 'kind', label: 'Kind',
      render: (v) => <Badge color={v === 'PICK' ? 'green' : 'blue'} size="xs">{v}</Badge>,
    },
    { key: 'contractor', label: 'Contractor' },
    { key: 'invoice_no', label: 'Invoice #' },
    {
      key: 'billing', label: 'Billing',
      render: (v) => (
        <Badge color={v === 'house_billed' ? 'purple' : 'gray'} size="xs">
          {v === 'house_billed' ? 'House-billed' : 'Grower-paid'}
        </Badge>
      ),
    },
    { key: 'amount', label: 'Amount', align: 'right', render: (v) => formatCurrency(v) },
    { key: 'block_raw', label: 'Block' },
    { key: 'date_from', label: 'From', render: (v) => formatDate(v) },
    { key: 'date_to', label: 'To', render: (v) => formatDate(v) },
    { key: 'date_paid', label: 'Paid', render: (v) => formatDate(v) },
    { key: 'date_emailed', label: 'Emailed', render: (v) => formatDate(v) },
    { key: 'date_rec_from_ph', label: "Rec'd from PH", render: (v) => formatDate(v) },
    {
      key: 'charge_posted', label: lockedHeader('Charged back'), sortable: false,
      render: (v) => <span className={derivedCellClasses}>{formatDate(v)}</span>,
    },
    {
      key: 'ap_reference', label: lockedHeader('AP Ref'), sortable: false,
      render: (v) => <span className={derivedCellClasses}>{v || '—'}</span>,
    },
    {
      key: 'match_method', label: lockedHeader('Matched'), sortable: false,
      render: (v) => {
        const info = PICKHAUL_CONSTANTS.MATCH_METHODS[v];
        return v ? (
          <Badge color={info?.color || 'gray'} size="xs">{info?.label || v}</Badge>
        ) : (
          <span className={derivedCellClasses}>—</span>
        );
      },
    },
    {
      key: '_actions', label: '', sortable: false,
      render: (_, row) => (
        <PermissionGate permission="manage_pick_haul">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            className="text-xs text-red-600 hover:underline"
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
        </select>
        <select value={matched} onChange={(e) => setMatched(e.target.value)} className={`${selectClasses} !w-auto`}>
          <option value="">All invoices</option>
          <option value="true">Matched</option>
          <option value="false">Unmatched</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Contractor, invoice #, block…"
            className={`${inputClasses} pl-8`}
          />
        </div>
        <PermissionGate permission="manage_pick_haul">
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-button bg-primary text-white text-sm hover:bg-primary-hover"
          >
            <Plus className="w-4 h-4" /> Add Invoice
          </button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        emptyTitle="No invoices"
        emptyMessage="Key contractor invoices here — one row per invoice, however many receipts it covers."
        onRowClick={canManage ? (row) => {
          setEditing(row);
          setModalOpen(true);
        } : undefined}
        defaultSort={{ key: 'date_from', dir: 'desc' }}
      />

      <InvoiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={onSaved}
        invoice={editing}
        season={season}
        houses={houses}
        entities={entities}
      />
    </div>
  );
}
