import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Home as HomeIcon } from 'lucide-react';
import {
  rentalLedgerAPI,
  rentalPropertiesAPI,
  RENTAL_CONSTANTS,
} from '../../services/api';
import {
  cardClasses,
  formatCount,
  formatCurrency,
  formatCurrency0,
  GRAIN_BADGE,
  LOCATION_BADGE,
  mutedText,
  rows,
  splitByLocation,
} from './rentalUtils';

/**
 * Where the rental book earns.
 *
 * The two halves are rendered side by side and never combined. On-ranch houses
 * exist in the books only as annual P&L totals; off-ranch property is reported
 * monthly by a manager. A single "total rental income" figure spanning both
 * would be summing two different measurements of two different books, so this
 * screen does not offer one.
 */
export default function OverviewTab({ year, onYearsLoaded }) {
  const [properties, setProperties] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      rentalPropertiesAPI.getAll({ is_active: true }),
      rentalLedgerAPI.getAll(year ? { year } : {}),
    ])
      .then(([propRes, ledgerRes]) => {
        if (cancelled) return;
        const ledgerRows = rows(ledgerRes);
        setProperties(rows(propRes));
        setLedger(ledgerRows);
        setError(null);

        // Year options come from the data itself — there is no point offering
        // 2019 if nothing was ever booked in it. Derived only from the initial
        // unfiltered load: once the request carries ?year=, the response can
        // only contain that one year and would collapse the list to it.
        if (year == null && onYearsLoaded) {
          const years = [...new Set(ledgerRows.map((r) => r.period_year))];
          onYearsLoaded(years.sort((a, b) => b - a));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading rentals overview:', err);
        setError(err?.response?.status === 403
          ? 'Your role does not include access to rental data.'
          : 'Could not load rental data.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year]);

  const split = useMemo(() => splitByLocation(ledger), [ledger]);

  const propsByLocation = useMemo(() => {
    const out = { on_ranch: [], off_ranch: [] };
    properties.forEach((p) => out[p.location_type]?.push(p));
    return out;
  }, [properties]);

  if (loading) {
    return <div className={mutedText}>Loading rental book…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/25 bg-danger-bg p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!properties.length) {
    return (
      <div className={`${cardClasses} text-center`}>
        <p className="text-heading font-medium">
          No rental property recorded yet
        </p>
        <p className={`${mutedText} mt-1`}>
          On-ranch houses and off-ranch investment property will appear here
          once they are added.
        </p>
      </div>
    );
  }

  const totalFlagged = split.on_ranch.flagged + split.off_ranch.flagged;

  return (
    <div className="space-y-5">
      {totalFlagged > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-100 p-3">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{totalFlagged}</strong>{' '}
            {totalFlagged === 1 ? 'row is' : 'rows are'} flagged from import and
            could not be fully trusted. They are included in these totals and
            badged in the ledger — they are not silently dropped.
          </p>
        </div>
      )}

      {/* The two books, side by side, never blended. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BookCard
          icon={HomeIcon}
          title="On-ranch"
          subtitle="Houses standing on ground we farm"
          locationType="on_ranch"
          stats={split.on_ranch}
          properties={propsByLocation.on_ranch}
        />
        <BookCard
          icon={Building2}
          title="Off-ranch"
          subtitle="Standalone investment property"
          locationType="off_ranch"
          stats={split.off_ranch}
          properties={propsByLocation.off_ranch}
        />
      </div>

      <p className={mutedText}>
        These two are reported separately on purpose. On-ranch figures are
        annual P&amp;L totals; off-ranch figures come from monthly manager
        statements. Adding them together would sum two different measurements
        of two different books, so no combined total is shown.
      </p>

      <PropertyTable properties={properties} />
    </div>
  );
}

function BookCard({ icon: Icon, title, subtitle, locationType, stats, properties }) {
  const grainMeta = RENTAL_CONSTANTS.GRAIN_LABELS[stats.grain] || {};
  const hasData = stats.rows.length > 0;

  return (
    <div className={cardClasses}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cream-100">
            <Icon className="w-5 h-5 text-bark-600" />
          </div>
          <div>
            <h3 className="font-semibold text-heading">{title}</h3>
            <p className={mutedText}>{subtitle}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LOCATION_BADGE[locationType]}`}>
          {properties.length} {properties.length === 1 ? 'property' : 'properties'}
        </span>
      </div>

      {hasData ? (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-heading">
              {formatCurrency0(stats.net)}
            </span>
            <span className={mutedText}>net</span>
            <span
              className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${GRAIN_BADGE[stats.grain]}`}
              title={grainMeta.hint}
            >
              {grainMeta.label || stats.grain}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat label="Income" value={formatCurrency(stats.income)} />
            <Stat label="Expense" value={formatCurrency(stats.expense)} />
            <Stat label="Collected" value={formatCurrency(stats.paid)} />
            <Stat
              label="Outstanding"
              value={formatCurrency(stats.outstanding)}
              emphasis={stats.outstanding > 0}
            />
          </dl>
        </>
      ) : (
        <p className={`${mutedText} mt-4`}>
          No ledger rows for this year. Not measured — not zero.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, emphasis }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </dt>
      <dd
        className={`font-medium ${
          emphasis
            ? 'text-yellow-700'
            : 'text-heading'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function PropertyTable({ properties }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-50">
            <tr className="text-left text-text-secondary">
              <th className="px-4 py-2.5 font-medium">Property</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Ranch</th>
              <th className="px-4 py-2.5 font-medium">Entity</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium text-right">Units</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {properties.map((p) => (
              <tr key={p.id} className="bg-white">
                <td className="px-4 py-2.5 font-medium text-heading">
                  {p.name}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LOCATION_BADGE[p.location_type]}`}>
                    {p.location_type_display?.split('—')[0]?.trim() || p.location_type}
                  </span>
                </td>
                {/* A dash, not a blank and not a zero: off-ranch property has
                    no ranch by definition. */}
                <td className="px-4 py-2.5 text-bark-600">
                  {p.farm_name || '—'}
                </td>
                <td className="px-4 py-2.5 text-bark-600">
                  {p.entity_code || p.entity_name || '—'}
                </td>
                <td className="px-4 py-2.5 text-bark-600">
                  {p.property_type_display || p.property_type}
                </td>
                <td className="px-4 py-2.5 text-right text-bark-600">
                  {formatCount(p.unit_count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
