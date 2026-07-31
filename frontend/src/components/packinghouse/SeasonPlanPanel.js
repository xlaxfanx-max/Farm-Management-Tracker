// =============================================================================
// SEASON PLAN PANEL — where each commodity's fruit is committed to go
// Commodity-level defaults with block-level overrides; flex commodities
// (avocados) choose their house pick by pick.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Pencil, Trash2, Shuffle } from 'lucide-react';
import { packerCommitmentsAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useHouses } from '../pickhaul/hooks';
import CommitmentModal from './CommitmentModal';

const SeasonPlanPanel = ({ season }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const houses = useHouses();
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCommitment, setEditCommitment] = useState(null);

  const fetchCommitments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await packerCommitmentsAPI.getAll({ season });
      const data = res.data;
      setCommitments(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      console.error('Error fetching commitments:', error);
    } finally {
      setLoading(false);
    }
  }, [season]);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  const handleDelete = async (c) => {
    const proceed = await confirm({
      title: 'Remove commitment?',
      message: `Remove ${c.commodity} → ${c.packinghouse_short_code || c.packinghouse_name}${c.field_name ? ` (${c.field_name})` : ''}?`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (!proceed) return;
    try {
      await packerCommitmentsAPI.delete(c.id);
      toast.success('Commitment removed');
      fetchCommitments();
    } catch (error) {
      console.error('Error deleting commitment:', error);
      toast.error('Failed to remove commitment');
    }
  };

  // Group: commodity -> { default, overrides[] }
  const byCommodity = {};
  for (const c of commitments) {
    const key = c.commodity;
    if (!byCommodity[key]) byCommodity[key] = { default: null, overrides: [] };
    if (c.field) byCommodity[key].overrides.push(c);
    else byCommodity[key].default = c;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Where each commodity goes this season. Receipts showing a different
          house get flagged — unless the commodity is marked flex.
        </p>
        <button
          onClick={() => { setEditCommitment(null); setShowModal(true); }}
          className="flex items-center px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover whitespace-nowrap"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-gray-500">Loading…</div>
      ) : commitments.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">
            No commitments recorded for the {season} season yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(byCommodity).map(([commodity, group]) => (
            <div
              key={commodity}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{commodity}</span>
                  {group.default ? (
                    <>
                      <span className="text-gray-400">→</span>
                      <span className="text-sm font-medium text-primary">
                        {group.default.packinghouse_short_code || group.default.packinghouse_name}
                      </span>
                      {group.default.flex && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                          <Shuffle className="w-3 h-3" /> flex
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">(block overrides only)</span>
                  )}
                </div>
                {group.default && (
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditCommitment(group.default); setShowModal(true); }}
                      className="p-1 text-gray-400 hover:text-gray-600" title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.default)}
                      className="p-1 text-gray-400 hover:text-red-500" title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>
              {group.overrides.length > 0 && (
                <div className="mt-2 ml-4 space-y-1">
                  {group.overrides.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-300">
                        {o.farm_name ? `${o.farm_name} · ` : ''}{o.field_name}
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="font-medium">{o.packinghouse_short_code || o.packinghouse_name}</span>
                        {o.flex && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                            <Shuffle className="w-3 h-3" /> flex
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditCommitment(o); setShowModal(true); }}
                          className="p-1 text-gray-400 hover:text-gray-600" title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(o)}
                          className="p-1 text-gray-400 hover:text-red-500" title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CommitmentModal
          season={season}
          houses={houses}
          commitment={editCommitment}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchCommitments();
          }}
        />
      )}
    </div>
  );
};

export default SeasonPlanPanel;
