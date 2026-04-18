// =============================================================================
// CROP REPORTS — one card per (Ranch × Crop) combination
// Built around the reality that growers typically have data at the ranch-crop
// level, not per-block. Block detail is a bonus drill-down when the data
// supports it.
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  RefreshCw, DollarSign, TrendingUp, TrendingDown, Minus,
  Wheat, MapPin, AlertTriangle, CheckCircle2, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cropReportsAPI } from '../../services/api';

function formatCurrency(value, decimals = 0) {
  if (value == null) return '—';
  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })}`;
}

function formatNumber(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function TrendIndicator({ current, prior }) {
  if (prior == null || current == null) return null;
  const diff = current - prior;
  if (Math.abs(diff) < 1) {
    return <Minus className="w-3 h-3 text-gray-400" />;
  }
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  const color = diff > 0 ? 'text-emerald-600' : 'text-red-600';
  return (
    <span className={`inline-flex items-center text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3 mr-0.5" />
      {formatCurrency(Math.abs(diff))}/ac vs prior
    </span>
  );
}

function MetricCell({ label, value, hint, highlight }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span
        className={`text-lg font-semibold ${
          highlight === 'positive' ? 'text-emerald-700 dark:text-emerald-300'
          : highlight === 'negative' ? 'text-red-700 dark:text-red-300'
          : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</span>}
    </div>
  );
}

function CropCard({ card }) {
  const [expanded, setExpanded] = useState(false);
  const netPerAcre = card.net_per_acre;
  const showNegative = netPerAcre != null && netPerAcre < 0;

  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-800 ${
        showNegative
          ? 'border-red-300 dark:border-red-700'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      data-testid="crop-report-card"
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3 border-b border-gray-100 dark:border-gray-700">
        <Wheat className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white truncate">
            {card.crop_variety_display}
            <span className="text-gray-500 font-normal"> · {card.farm_name}</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
            <span>{card.season_label}</span>
            <span>·</span>
            <span>{formatNumber(card.total_acres)} acres</span>
            {card.field_count > 1 && (
              <>
                <span>·</span>
                <span>{card.field_count} blocks</span>
              </>
            )}
            {card.has_block_level_data && (
              <span
                className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium"
                title="Settlement or field data is tagged by block"
              >
                block detail
              </span>
            )}
          </div>
        </div>
        {netPerAcre != null && (
          <div className="text-right">
            <div className={`text-xl font-bold ${
              showNegative ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}>
              {formatCurrency(netPerAcre)}/ac
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">net per acre</div>
            <TrendIndicator current={netPerAcre} prior={card.prior_season_net_per_acre} />
          </div>
        )}
      </div>

      {/* Core metrics grid */}
      <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCell
          label="Revenue"
          value={formatCurrency(card.total_revenue)}
          hint={`${card.applicable_settlements} settlement${card.applicable_settlements !== 1 ? 's' : ''}`}
          highlight="positive"
        />
        <MetricCell
          label="Spray cost"
          value={formatCurrency(card.total_spray_cost)}
          hint={card.total_acres > 0 ? `${formatCurrency(card.total_spray_cost / card.total_acres)}/ac` : null}
        />
        <MetricCell
          label="Bins"
          value={formatNumber(card.total_bins)}
          hint={card.total_acres > 0 ? `${formatNumber(card.total_bins / card.total_acres)}/ac` : null}
        />
        <MetricCell
          label="Net return"
          value={formatCurrency(card.net_return)}
          highlight={showNegative ? 'negative' : 'positive'}
        />
      </div>

      {/* Compliance + health pills */}
      <div className="px-4 pb-3 flex flex-wrap gap-2 text-xs">
        {card.phi_compliant === true && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> PHI clean
          </span>
        )}
        {card.phi_compliant === false && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertTriangle className="w-3 h-3" /> PHI needs review
          </span>
        )}
        {card.moa_rotation_warnings > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            {card.moa_rotation_warnings} MOA rotation warning{card.moa_rotation_warnings !== 1 ? 's' : ''}
          </span>
        )}
        {card.hlb_risk_max != null && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
              card.hlb_risk_max >= 60 ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : card.hlb_risk_max >= 40 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            }`}
            title="Highest HLB risk across blocks in this ranch+crop"
          >
            HLB risk max: {Math.round(card.hlb_risk_max)}
          </span>
        )}
        {card.avg_health_score != null && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            Avg NDVI × 100: {card.avg_health_score}
          </span>
        )}
      </div>

      {/* Drill-down: per-block detail when available */}
      {card.fields.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 border-t border-gray-100 dark:border-gray-700"
        >
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Block-level breakdown ({card.fields.length})
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}

      {expanded && card.fields.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 text-left">Block</th>
                <th className="px-4 py-2 text-right">Acres</th>
                <th className="px-4 py-2 text-right">Bins</th>
                <th className="px-4 py-2 text-right">Spray cost</th>
                <th className="px-4 py-2 text-right">HLB risk</th>
                <th className="px-4 py-2 text-right">NDVI</th>
              </tr>
            </thead>
            <tbody>
              {card.fields.map(f => (
                <tr key={f.field_id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">
                    {f.field_name}
                    {!f.has_harvest && !f.has_applications && (
                      <span className="ml-2 text-[10px] text-gray-400">no data</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(f.acres)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(f.bins)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {formatCurrency(f.spray_cost)}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {f.hlb_risk_score != null ? Math.round(f.hlb_risk_score) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">
                    {f.avg_ndvi != null ? f.avg_ndvi.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Data gaps footer — always visible, nudge the user to improve data */}
      {card.data_gaps.length > 0 && (
        <div className="px-4 py-2 text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-start gap-1">
          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span>{card.data_gaps.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}

function CropReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await cropReportsAPI.list();
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load crop reports');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 p-6">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Aggregating crop reports…
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }
  const cards = data?.cards || [];
  const season = data?.season;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Ranch × Crop Report
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {season ? (
              <>Season {season.label} · {cards.length} ranch-crop combination{cards.length !== 1 ? 's' : ''}</>
            ) : 'Loading…'}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <Wheat className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No crop activity in this window. Add harvests, spray records, or pool settlements to populate this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map(card => (
            <CropCard
              key={`${card.farm_id}-${card.crop_variety}`}
              card={card}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CropReports;
