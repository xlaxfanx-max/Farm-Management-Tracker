import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import Breadcrumbs from '../navigation/Breadcrumbs';
import { VIEW_TO_PATH } from '../../routes';
import OverviewTab from './OverviewTab';
import RentRollTab from './RentRollTab';
import { mutedText } from './rentalUtils';

const TABS = [
  { id: 'overview', label: 'Overview', view: 'rentals' },
  { id: 'rent-roll', label: 'Rent Roll', view: 'rentals-rent-roll' },
];

/**
 * Rental Income — on-ranch houses and off-ranch investment property.
 *
 * Rental dollars sit next to a ranch and never inside its farming margin.
 * Nothing on these screens divides rent by acres, and the API they read from
 * does not return acreage, so a per-acre rental figure cannot be produced here
 * even by accident.
 */
export default function RentalsDashboard({ initialTab = 'overview', onNavigate }) {
  const navigate = useNavigate();
  const [year, setYear] = useState(null);
  const [years, setYears] = useState([]);

  const activeTab = TABS.some((t) => t.id === initialTab) ? initialTab : 'overview';

  const handleYearsLoaded = useCallback((loaded) => {
    setYears(loaded);
    setYear((current) => (current == null ? loaded[0] ?? null : current));
  }, []);

  const yearOptions = useMemo(() => {
    if (years.length) return years;
    const now = new Date().getFullYear();
    return [now, now - 1, now - 2];
  }, [years]);

  return (
    <div className="p-6 space-y-4">
      <Breadcrumbs
        currentView={activeTab === 'overview' ? 'rentals' : `rentals-${activeTab}`}
        onNavigate={onNavigate}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-light dark:bg-primary-light">
            <KeyRound className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Rental Income
            </h1>
            <p className={mutedText}>
              On-ranch houses and off-ranch property, kept out of every farming margin
            </p>
          </div>
        </div>

        {activeTab === 'overview' && (
          <label className={`flex items-center gap-2 ${mutedText}`}>
            Year
            <select
              value={year ?? ''}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto -mb-px">
          {TABS.map((tab) => {
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
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <OverviewTab year={year} onYearsLoaded={handleYearsLoaded} />
      )}
      {activeTab === 'rent-roll' && <RentRollTab />}
    </div>
  );
}
