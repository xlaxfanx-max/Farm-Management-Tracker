// Shared helpers for the Pick & Haul screens.
//
// Provenance culture: a dash is never a zero, and machine-derived cells are
// visibly machine-owned (grey + lock), matching the EFEFEF treatment the old
// Excel entry workbook used.

export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
  }).format(value);
};

export const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

export const relativeTime = (value) => {
  if (!value) return 'never';
  const ms = Date.now() - new Date(value).getTime();
  const hours = ms / 36e5;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 6e4))} min ago`;
  if (hours < 48) return `${Math.round(hours)} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
};

export const agingBucket = (days) => {
  if (days == null) return null;
  if (days <= 30) return '0_30';
  if (days <= 60) return '31_60';
  if (days <= 90) return '61_90';
  return '90_plus';
};

export const AGING_BADGE_COLORS = {
  '0_30': 'gray',
  '31_60': 'amber',
  '61_90': 'orange',
  '90_plus': 'red',
};

export const SEVERITY_COLORS = { error: 'red', warn: 'amber', info: 'blue' };

// The EFEFEF equivalent: derived, machine-owned table cells.
export const derivedCellClasses =
  'inline-block rounded px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 italic';

// Tolerate both paginated ({results}) and bare-array list responses.
export const rows = (res) => {
  const data = res.data;
  return Array.isArray(data) ? data : data?.results || [];
};
