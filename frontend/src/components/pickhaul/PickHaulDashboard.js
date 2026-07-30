import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { pickHaulStatusAPI } from '../../services/api';
import Breadcrumbs from '../navigation/Breadcrumbs';
import { VIEW_TO_PATH } from '../../routes';
import SyncFreshnessBanner from './SyncFreshnessBanner';
import OwedTab from './OwedTab';
import InvoicesTab from './InvoicesTab';
import ManualPicksTab from './ManualPicksTab';
import ReceiptsTab from './ReceiptsTab';
import HouseChargesTab from './HouseChargesTab';
import ChecksTab from './ChecksTab';

const TABS = [
  { id: 'owed', label: 'Owed', view: 'pick-haul-owed' },
  { id: 'invoices', label: 'Invoices', view: 'pick-haul-invoices' },
  { id: 'manual-picks', label: 'Manual Picks', view: 'pick-haul-manual-picks' },
  { id: 'receipts', label: 'Receipts', view: 'pick-haul-receipts' },
  { id: 'charges', label: 'House Charges', view: 'pick-haul-charges' },
  { id: 'checks', label: 'Checks', view: 'pick-haul-checks' },
];

/**
 * Pick & Haul — contractor invoices vs. packinghouse charge-backs.
 *
 * Receipts and house charges are pushed daily from the local pipeline (the
 * portal credentials never leave that machine); invoices and manual picks are
 * entered here. The Owed tab is the accountant's daily chase list.
 */
export default function PickHaulDashboard({ initialTab = 'owed', onNavigate }) {
  const navigate = useNavigate();
  const [season, setSeason] = useState(null); // null = backend default (latest)
  const [summary, setSummary] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = TABS.some((t) => t.id === initialTab) ? initialTab : 'owed';

  // Bumped by tabs after any mutation, so badges and the summary stay honest.
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    const params = season ? { season } : {};
    Promise.all([
      pickHaulStatusAPI.getSummary(params),
      pickHaulStatusAPI.getSyncStatus(params),
    ])
      .then(([summaryRes, statusRes]) => {
        if (cancelled) return;
        setSummary(summaryRes.data);
        setSyncStatus(statusRes.data);
        if (!season && summaryRes.data?.season) {
          setSeason(summaryRes.data.season);
        }
      })
      .catch((err) => console.error('Error loading pick & haul status:', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, refreshKey]);

  const seasonOptions = useMemo(() => {
    const current = season || new Date().getFullYear();
    const base = Math.max(current, new Date().getFullYear());
    return [base - 3, base - 2, base - 1, base].filter((y) => y > 2000);
  }, [season]);

  const checkCounts = syncStatus?.check_counts || {};
  const badgeFor = (tabId) => {
    if (tabId === 'owed' && summary?.outstanding_count) {
      const has90 = (summary.buckets?.['90_plus']?.count || 0) > 0;
      return { count: summary.outstanding_count, color: has90 ? 'red' : 'gray' };
    }
    if (tabId === 'checks') {
      if (checkCounts.error) return { count: checkCounts.error, color: 'red' };
      if (checkCounts.warn) return { count: checkCounts.warn, color: 'amber' };
    }
    return null;
  };

  const badgeClasses = {
    red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    gray: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  };

  const tabProps = { season, refresh, summary, syncStatus };

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs currentView={activeTab === 'owed' ? 'pick-haul' : `pick-haul-${activeTab}`} onNavigate={onNavigate} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-light dark:bg-primary-light">
            <Truck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pick &amp; Haul</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Contractor invoices vs. house charge-backs
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          Season
          <select
            value={season || ''}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
          >
            {seasonOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>

      <SyncFreshnessBanner syncStatus={syncStatus} />

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((tab) => {
            const badge = badgeFor(tab.id);
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => navigate(VIEW_TO_PATH[tab.view])}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {badge && (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${badgeClasses[badge.color]}`}>
                      {badge.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {season !== null && (
        <>
          {activeTab === 'owed' && <OwedTab {...tabProps} />}
          {activeTab === 'invoices' && <InvoicesTab {...tabProps} />}
          {activeTab === 'manual-picks' && <ManualPicksTab {...tabProps} />}
          {activeTab === 'receipts' && <ReceiptsTab {...tabProps} />}
          {activeTab === 'charges' && <HouseChargesTab {...tabProps} />}
          {activeTab === 'checks' && <ChecksTab {...tabProps} />}
        </>
      )}
    </div>
  );
}
