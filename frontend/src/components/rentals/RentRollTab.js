import React, { useEffect, useMemo, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import {
  rentalLeasesAPI,
  rentalSummaryAPI,
  rentalUnitsAPI,
} from '../../services/api';
import {
  cardClasses,
  formatCount,
  formatCurrency,
  formatCurrency0,
  formatDate,
  mutedText,
  rows,
} from './rentalUtils';

const LOCATION_FILTERS = [
  { value: '', label: 'All property' },
  { value: 'off_ranch', label: 'Off-ranch' },
  { value: 'on_ranch', label: 'On-ranch' },
];

/**
 * Portfolio rent roll.
 *
 * Gross potential rent is counted from units and their active leases. The
 * distinction matters: the May 2026 rent-roll workbook prints a portfolio
 * total of $60,563 by summing 31 occupant rows against 19 actual units —
 * Harrison unit 363 appears three times at $1,575. This screen reports unit
 * count and occupied count as separate figures so the two can never be
 * conflated into one inflated number.
 */
export default function RentRollTab() {
  const [locationType, setLocationType] = useState('off_ranch');
  const [summary, setSummary] = useState(null);
  const [units, setUnits] = useState([]);
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = locationType ? { location_type: locationType } : {};
    Promise.all([
      rentalSummaryAPI.getRentRoll(params),
      rentalUnitsAPI.getAll(params),
      rentalLeasesAPI.getAll({ is_active: true }),
    ])
      .then(([summaryRes, unitsRes, leasesRes]) => {
        if (cancelled) return;
        setSummary(summaryRes.data);
        setUnits(rows(unitsRes));
        setLeases(rows(leasesRes));
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error loading rent roll:', err);
        setError(err?.response?.status === 403
          ? 'Your role does not include access to rental data.'
          : 'Could not load the rent roll.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [locationType]);

  const leaseByUnit = useMemo(() => {
    const map = new Map();
    leases.forEach((l) => {
      if (!map.has(l.unit)) map.set(l.unit, l);
    });
    return map;
  }, [leases]);

  if (error) {
    return (
      <div className="rounded-card border border-danger/25 bg-danger-bg p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  const vacant = summary
    ? Math.max(0, summary.unit_count - summary.occupied_count)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`flex items-center gap-2 ${mutedText}`}>
          Show
          <select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
            className="rounded-lg border border-border-strong bg-surface-raised px-2 py-1.5 text-sm text-heading"
          >
            {LOCATION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className={mutedText}>Loading rent roll…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Units"
              value={formatCount(summary?.unit_count)}
              hint="Physical lettable units — the denominator that matters"
            />
            <MetricCard
              label="Occupied"
              value={formatCount(summary?.occupied_count)}
              hint={`${formatCount(vacant)} without a named occupant on an active lease`}
            />
            <MetricCard
              label="Monthly GPR"
              value={formatCurrency0(summary?.monthly_gross_potential_rent)}
              hint="Sum of contract rent on active leases"
            />
            <MetricCard
              label="Annual GPR"
              value={formatCurrency0(summary?.annual_gross_potential_rent)}
              hint="Monthly × 12"
            />
          </div>

          <div className="flex items-start gap-2 rounded-card border border-border bg-cream-50 p-3">
            <Info className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <p className={mutedText}>
              Units and occupants are counted separately and deliberately. Rent
              is held once per lease, against a unit — so a unit shared by two
              named occupants contributes its rent once, not twice.
            </p>
          </div>

          <UnitTable units={units} leaseByUnit={leaseByUnit} />
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint }) {
  return (
    <div className={cardClasses}>
      <p className="text-xs uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-heading">
        {value}
      </p>
      {hint && <p className={`${mutedText} mt-1`}>{hint}</p>}
    </div>
  );
}

function UnitTable({ units, leaseByUnit }) {
  if (!units.length) {
    return (
      <div className={`${cardClasses} text-center`}>
        <p className={mutedText}>No units recorded for this filter.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cream-50">
            <tr className="text-left text-text-secondary">
              <th className="px-4 py-2.5 font-medium">Property</th>
              <th className="px-4 py-2.5 font-medium">Unit</th>
              <th className="px-4 py-2.5 font-medium">Occupant</th>
              <th className="px-4 py-2.5 font-medium text-right">Monthly rent</th>
              <th className="px-4 py-2.5 font-medium">Lease start</th>
              <th className="px-4 py-2.5 font-medium">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {units.map((u) => {
              const lease = leaseByUnit.get(u.id);
              return (
                <tr key={u.id} className="bg-surface-raised">
                  <td className="px-4 py-2.5 text-bark-600">
                    {u.property_name}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-heading">
                    {u.unit_label}
                  </td>
                  <td className="px-4 py-2.5 text-bark-600">
                    {u.occupant_label || (
                      <span className="text-text-muted">vacant</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-heading">
                    {formatCurrency(lease?.monthly_rent ?? u.current_rent)}
                  </td>
                  {/* Nullable on purpose: not one lease date exists in any
                      source file, and inventing one would be worse. */}
                  <td className="px-4 py-2.5 text-bark-600">
                    {formatDate(lease?.start_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.is_rent_controlled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sand-200 text-bark-700">
                        <Lock className="w-3 h-3" />
                        Rent controlled
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
