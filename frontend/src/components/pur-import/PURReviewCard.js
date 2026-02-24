// =============================================================================
// PUR REVIEW CARD — Single parsed PUR report for review and farm mapping
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, MapPin, Package, Calendar,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';

export default function PURReviewCard({ report, index, farms, onChange }) {
  const [expanded, setExpanded] = useState(true);

  const matchInfo = report._match_info || {};
  const farmMatches = matchInfo.farm_matches || [];
  const productMatches = matchInfo.product_matches || [];

  // Determine farm match status
  const farmStatus = useMemo(() => {
    if (report._farmId) return 'mapped';
    if (farmMatches.length > 0 && farmMatches[0].match_type === 'exact_site_id') return 'auto';
    return 'unmatched';
  }, [report._farmId, farmMatches]);

  // Count product matches
  const productStats = useMemo(() => {
    const products = report.products || [];
    const matched = productMatches.filter(m => m.match_type !== 'none').length;
    return { total: products.length, matched };
  }, [report.products, productMatches]);

  const handleFarmChange = (farmId) => {
    onChange({ ...report, _farmId: farmId ? parseInt(farmId) : null });
  };

  const handleToggleSelected = () => {
    onChange({ ...report, _selected: !report._selected });
  };

  const handleRememberMapping = (val) => {
    onChange({ ...report, _rememberMapping: val });
  };

  const statusColor = report._selected
    ? (farmStatus === 'unmatched' ? 'border-amber-300' : 'border-green-300')
    : 'border-gray-200 opacity-60';

  return (
    <div className={`border-2 rounded-lg transition-colors ${statusColor}`}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleSelected(); }}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            report._selected
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 bg-white'
          }`}
        >
          {report._selected && <CheckCircle className="w-3.5 h-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              PUR #{report.pur_number || `Report ${index + 1}`}
            </span>
            {report.date_started && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {report.date_started}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {report.site_id || 'No site ID'}
            </span>
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              {productStats.total} product{productStats.total !== 1 ? 's' : ''}
              {productStats.matched > 0 && (
                <span className="text-green-600">
                  ({productStats.matched} matched)
                </span>
              )}
            </span>
            {report.commodity_name && (
              <span>{report.commodity_name}</span>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {farmStatus === 'auto' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              Farm matched
            </span>
          )}
          {farmStatus === 'mapped' && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
              Farm set
            </span>
          )}
          {farmStatus === 'unmatched' && report._selected && (
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
              Needs farm
            </span>
          )}
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Farm mapping */}
          <div className="bg-gray-50 rounded-lg p-3">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Map to Farm
            </label>
            <select
              value={report._farmId || ''}
              onChange={(e) => handleFarmChange(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm ${
                !report._farmId && report._selected
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <option value="">-- Select a farm --</option>
              {(farms || []).map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.pur_site_id ? `(${f.pur_site_id})` : ''} — {f.county || ''}
                </option>
              ))}
            </select>

            {/* Auto-match suggestion */}
            {!report._farmId && farmMatches.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Suggestion:</span>
                {farmMatches.slice(0, 3).map(m => (
                  <button
                    key={m.farm_id}
                    onClick={() => handleFarmChange(m.farm_id)}
                    className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                  >
                    {m.farm_name}
                  </button>
                ))}
              </div>
            )}

            {/* Remember mapping checkbox */}
            {report._farmId && report.site_id && (
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={report._rememberMapping || false}
                  onChange={(e) => handleRememberMapping(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Remember: map &quot;{report.site_id}&quot; to this farm for future imports
              </label>
            )}
          </div>

          {/* Report details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Detail label="Applicator" value={report.applicator_name || report.applied_by} />
            <Detail label="Method" value={report.application_method} />
            <Detail label="Treated Area" value={report.treated_area_acres ? `${report.treated_area_acres} ac` : '-'} />
            <Detail label="County" value={report.county} />
            <Detail label="Section/Twn/Rng" value={[report.section, report.township, report.range].filter(Boolean).join(' / ')} />
            <Detail label="Permit #" value={report.permit_number} />
            <Detail label="Recommendation #" value={report.recommendation_number} />
            <Detail label="Wind" value={report.wind_velocity_mph ? `${report.wind_velocity_mph} mph` : '-'} />
          </div>

          {/* Products table */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Products ({(report.products || []).length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 pr-3">Product</th>
                    <th className="pb-2 pr-3">EPA Reg #</th>
                    <th className="pb-2 pr-3">Amount</th>
                    <th className="pb-2 pr-3">Rate</th>
                    <th className="pb-2 pr-3">Active Ingredient</th>
                    <th className="pb-2">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.products || []).map((prod, pIdx) => {
                    const pm = productMatches[pIdx] || {};
                    return (
                      <tr key={pIdx} className="border-b border-gray-50">
                        <td className="py-2 pr-3 font-medium text-gray-900">
                          {prod.product_name}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 font-mono text-xs">
                          {prod.epa_registration_number || '-'}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {prod.total_amount} {prod.amount_unit}
                        </td>
                        <td className="py-2 pr-3 text-gray-600">
                          {prod.rate} {prod.rate_unit}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 max-w-[200px] truncate">
                          {prod.active_ingredient || '-'}
                        </td>
                        <td className="py-2">
                          {pm.match_type === 'exact_epa' && (
                            <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                              <CheckCircle className="w-3.5 h-3.5" />
                              EPA match
                            </span>
                          )}
                          {pm.match_type === 'fuzzy_name' && (
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Name match
                            </span>
                          )}
                          {pm.match_type === 'none' && (
                            <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                              <XCircle className="w-3.5 h-3.5" />
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comments/restrictions */}
          {(report.comments || report.restrictions) && (
            <div className="text-sm">
              {report.comments && (
                <p className="text-gray-600"><span className="font-medium">Comments:</span> {report.comments}</p>
              )}
              {report.restrictions && (
                <p className="text-amber-700"><span className="font-medium">Restrictions:</span> {report.restrictions}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  if (!value || value === '-') return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="text-gray-300">-</p>
    </div>
  );
  return (
    <div>
      <span className="text-gray-400 text-xs">{label}</span>
      <p className="text-gray-700">{value}</p>
    </div>
  );
}
