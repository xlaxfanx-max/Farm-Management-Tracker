// =============================================================================
// SEASON OVERVIEW — the deliveries-first landing for Harvest & Packing
//
// Leads with the delivery side (bins, pick & haul cost, owed) which is live
// all season, then cash received, then per-commodity cards that carry the
// settlement stage as the downstream step it really is. A commodity card
// drills into the settlement pipeline (PipelineOverview Mode B).
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Banknote, Building2, ClipboardList, DollarSign,
  Package, RefreshCw, Shuffle, Truck, Wheat, AlertTriangle,
} from 'lucide-react';
import { packinghouseAnalyticsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import MetricCard from '../ui/MetricCard';
import Spinner from '../ui/Spinner';
import CollapsibleSection from '../ui/CollapsibleSection';
import PipelineOverview from './PipelineOverview';
import SeasonPlanPanel from './SeasonPlanPanel';
import { currentPickhaulSeason, formatCurrency, formatNumber } from '../pickhaul/pickhaulUtils';

const CATEGORY_COLORS = {
  citrus: 'border-orange-200 dark:border-orange-800',
  subtropical: 'border-green-200 dark:border-green-800',
  other: 'border-gray-200 dark:border-gray-700',
};

export default function SeasonOverview() {
  const { hasPermission } = useAuth();
  const hasPickHaul = hasPermission('view_pick_haul');
  const season = currentPickhaulSeason();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drillCommodity, setDrillCommodity] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    packinghouseAnalyticsAPI
      .getSeasonOverview({ season })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Error fetching season overview:', err);
        setError('Failed to load season overview');
      })
      .finally(() => setLoading(false));
  }, [season]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (drillCommodity) {
    return (
      <PipelineOverview
        initialCommodity={drillCommodity}
        onBack={() => setDrillCommodity(null)}
      />
    );
  }

  if (loading && !data) {
    return <div className="flex justify-center py-16"><Spinner size="lg" label="Loading season…" /></div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400 mb-3">{error}</p>
        <button onClick={fetchData} className="text-primary hover:underline text-sm">Retry</button>
      </div>
    );
  }

  const delivery = data?.delivery;
  const cash = data?.cash_received;
  const cards = data?.commodities || [];
  const hasAnyData = cards.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Season {season - 1}–{season}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Field to packinghouse — deliveries lead, settlements follow as pools close
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 1. Delivery strip — live all season */}
      {hasPickHaul && delivery && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            title="Bins delivered"
            value={formatNumber(delivery.bins_delivered)}
            subtitle={`${delivery.deliveries ?? 0} deliveries`}
            icon={Package}
            color="green"
          />
          <MetricCard
            title="Pick cost"
            value={formatCurrency(delivery.pick_cost)}
            icon={Wheat}
            color="blue"
          />
          <MetricCard
            title="Haul cost"
            value={formatCurrency(delivery.haul_cost)}
            icon={Truck}
            color="blue"
          />
          <MetricCard
            title="Cost / bin"
            value={delivery.cost_per_bin != null ? formatCurrency(delivery.cost_per_bin) : '—'}
            icon={DollarSign}
            color="purple"
          />
          <MetricCard
            title="Owed by houses"
            value={formatCurrency(delivery.owed_total)}
            subtitle={`${delivery.owed_count ?? 0} grower-paid invoices`}
            icon={ClipboardList}
            color={(delivery.owed_count ?? 0) > 0 ? 'amber' : 'gray'}
          />
          <MetricCard
            title="Cash received"
            value={cash ? formatCurrency(cash.total) : '—'}
            subtitle={cash
              ? `${formatCurrency(cash.advances)} advances · ${formatCurrency(cash.reimbursements)} reimbursed`
              : undefined}
            icon={Banknote}
            color="green"
          />
        </div>
      )}

      {/* 2. Commodity cards — delivered -> settled */}
      {hasAnyData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.commodity}
              onClick={() => card.commodity !== 'UNMAPPED' && setDrillCommodity(card.commodity)}
              className={`text-left bg-white dark:bg-gray-800 border-2 rounded-xl p-4 transition-all hover:shadow-md ${CATEGORY_COLORS[card.crop_category] || CATEGORY_COLORS.other}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{card.commodity}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Season {card.season_label}</p>
                </div>
                {card.commitment_mismatch && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs"
                    title="Fruit went to a house outside the season plan"
                  >
                    <AlertTriangle className="w-3 h-3" /> off-plan
                  </span>
                )}
              </div>

              {/* Delivered -> settled flow */}
              <div className="flex items-center gap-2 text-sm mb-2">
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {card.delivered_bins != null ? formatNumber(card.delivered_bins) : '—'}
                  </div>
                  <div className="text-xs text-gray-500">bins delivered</div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {card.unit === 'LBS'
                      ? (card.settled_lbs ? `${formatNumber(card.settled_lbs)} lbs` : '—')
                      : (card.settled_bins ? formatNumber(card.settled_bins) : '—')}
                  </div>
                  <div className="text-xs text-gray-500">settled</div>
                </div>
                {card.settlement_percent != null && (
                  <div className="ml-auto text-right">
                    <div className="text-lg font-bold text-primary">{card.settlement_percent}%</div>
                    <div className="text-xs text-gray-500">of delivered</div>
                  </div>
                )}
              </div>

              {card.settlement_percent != null && (
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-3">
                  <div
                    className="bg-primary h-1.5 rounded-full"
                    style={{ width: `${Math.min(card.settlement_percent, 100)}%` }}
                  />
                </div>
              )}

              {/* Money lines */}
              <div className="space-y-1 text-sm">
                {card.net_return != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Settlement net</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(card.net_return)}</span>
                  </div>
                )}
                {card.pickhaul_cost != null && Number(card.pickhaul_cost) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Pick &amp; haul</span>
                    <span className="font-medium text-gray-900 dark:text-white">−{formatCurrency(card.pickhaul_cost)}</span>
                  </div>
                )}
                {card.net_to_grower != null && (
                  <div className="flex justify-between border-t border-gray-100 dark:border-gray-700 pt-1">
                    <span className="text-gray-600 dark:text-gray-300 font-medium">Net to grower</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(card.net_to_grower)}
                      {card.net_to_grower_per_bin != null && (
                        <span className="font-normal text-xs text-gray-500 ml-1">
                          ({formatCurrency(card.net_to_grower_per_bin)}/bin)
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {card.awaiting_settlement && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                    Awaiting settlement — pools have not closed yet
                  </div>
                )}
              </div>

              {/* Committed vs actual houses */}
              {(card.committed || (card.actual_houses || []).length > 0) && (
                <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {card.committed?.default && (
                    <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      plan: {card.committed.default.packinghouse}
                      {card.committed.flex && <Shuffle className="inline w-3 h-3 ml-1" />}
                    </span>
                  )}
                  {(card.actual_houses || []).map((h) => (
                    <span key={h} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">No season data yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Deliveries appear when the pick &amp; haul pipeline pushes receipts;
            settlements appear when packinghouse statements are uploaded.
          </p>
        </div>
      )}

      {/* 3. Season plan */}
      <CollapsibleSection title="Season plan — packer commitments">
        <SeasonPlanPanel season={season} />
      </CollapsibleSection>
    </div>
  );
}
