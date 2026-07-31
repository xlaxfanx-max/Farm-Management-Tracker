// Shared helpers for the Rentals screens.
//
// The provenance rule from Pick & Haul carries over: a dash is never a zero.
// An empty cell means "not measured", and must not render as $0.00 — several
// of these properties genuinely have an expense line and no income line at
// all (Saticoy 1096 Orange books -$282.54 of utilities against no rent).

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatCurrency0 = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatCount = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US').format(value);
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Tolerate both paginated ({results}) and bare-array list responses.
export const rows = (res) => {
  const data = res.data;
  return Array.isArray(data) ? data : data?.results || [];
};

export const LOCATION_BADGE = {
  on_ranch:
    'bg-green-100 text-green-700',
  off_ranch:
    'bg-green-100 text-green-700',
};

export const GRAIN_BADGE = {
  annual: 'bg-sand-200 text-bark-600',
  monthly: 'bg-sand-200 text-bark-600',
  mixed: 'bg-yellow-200 text-yellow-700',
};

export const cardClasses =
  'rounded-card border border-border bg-surface-raised p-5';

export const mutedText = 'text-sm text-text-secondary';

/**
 * Split ledger rows by the location rule.
 *
 * On-ranch and off-ranch are returned separately and are never added together
 * by anything in this module. They are different grains (annual P&L vs monthly
 * manager statement) measuring different books, and one blended total would be
 * a number with no defensible meaning.
 */
export function splitByLocation(ledgerRows) {
  const empty = () => ({
    income: 0,
    expense: 0,
    charged: 0,
    paid: 0,
    flagged: 0,
    grains: new Set(),
    rows: [],
  });
  const out = { on_ranch: empty(), off_ranch: empty() };

  ledgerRows.forEach((row) => {
    const bucket = out[row.property_location_type];
    if (!bucket) return;
    const amount = num(row.amount_charged);
    if (row.category_kind === 'income') {
      bucket.income += amount;
      bucket.charged += amount;
      bucket.paid += num(row.amount_paid);
    } else {
      bucket.expense += amount;
    }
    if (row.is_flagged) bucket.flagged += 1;
    bucket.grains.add(row.grain);
    bucket.rows.push(row);
  });

  Object.values(out).forEach((b) => {
    b.net = b.income - b.expense;
    b.outstanding = b.charged - b.paid;
    b.grain = b.grains.size > 1 ? 'mixed' : [...b.grains][0] || 'annual';
  });

  return out;
}
