import React from 'react';
import { Trees, Activity, MapPin, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

const HEALTH_COLORS = {
  healthy: { bg: '#22c55e', label: 'Healthy' },
  moderate: { bg: '#eab308', label: 'Moderate' },
  stressed: { bg: '#f97316', label: 'Stressed' },
  critical: { bg: '#ef4444', label: 'Critical' },
  unknown: { bg: '#9ca3af', label: 'Unknown' },
};

const SurveyResultsPanel = ({ survey, healthSummary }) => {
  // Processing state
  if (survey.status === 'processing') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <RefreshCw size={36} className="animate-spin text-blue-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          Detection in Progress
        </h3>
        <p className="text-slate-500 text-sm">
          Analyzing imagery to detect and classify trees. This may take several minutes
          depending on image size.
        </p>
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Processing...
          </div>
        </div>
      </div>
    );
  }

  // Failed state
  if (survey.status === 'failed') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <AlertTriangle size={36} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-800 mb-1">Detection Failed</h3>
        <p className="text-slate-500 text-sm">
          {survey.error_message ||
            'An error occurred during tree detection. Please try again or upload a different image.'}
        </p>
      </div>
    );
  }

  // Pending state
  if (survey.status === 'pending') {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <Trees size={36} className="text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-700 mb-1">Ready to Detect</h3>
        <p className="text-slate-500 text-sm">
          Click "Run Detection" above to analyze this image for trees.
        </p>
      </div>
    );
  }

  // Completed state -- extract stats
  const treeCount = survey.tree_count || healthSummary?.total_trees || 0;
  const treesPerAcre = survey.trees_per_acre || healthSummary?.trees_per_acre || 0;
  const avgNdvi = healthSummary?.avg_ndvi ?? survey.avg_ndvi ?? null;
  const canopyCoverage = healthSummary?.canopy_coverage_pct ?? survey.canopy_coverage_pct ?? null;
  const avgConfidence = healthSummary?.avg_confidence ?? survey.avg_confidence ?? null;

  // Health breakdown data
  const categories = healthSummary?.categories || healthSummary?.health_breakdown || {};
  const totalForBar = Object.values(categories).reduce((sum, val) => sum + (val.count || val || 0), 0);

  // Build bar segments
  const barSegments = Object.entries(HEALTH_COLORS)
    .map(([key, config]) => {
      const catData = categories[key];
      const count = typeof catData === 'object' ? catData.count || 0 : catData || 0;
      const pct = totalForBar > 0 ? (count / totalForBar) * 100 : 0;
      return { key, ...config, count, pct };
    })
    .filter((seg) => seg.count > 0);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Trees size={18} className="text-green-600" />}
          label="Total Trees"
          value={treeCount.toLocaleString()}
        />
        <StatCard
          icon={<MapPin size={18} className="text-blue-600" />}
          label="Trees / Acre"
          value={typeof treesPerAcre === 'number' ? treesPerAcre.toFixed(1) : '--'}
        />
        <StatCard
          icon={<Activity size={18} className="text-emerald-600" />}
          label="Avg NDVI"
          value={avgNdvi != null ? avgNdvi.toFixed(3) : '--'}
        />
        <StatCard
          icon={
            <svg
              className="w-[18px] h-[18px] text-teal-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 0 1 0 20" fill="currentColor" opacity="0.3" />
            </svg>
          }
          label="Canopy Coverage"
          value={canopyCoverage != null ? `${canopyCoverage.toFixed(1)}%` : '--'}
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-indigo-600" />}
          label="Avg Confidence"
          value={avgConfidence != null ? `${(avgConfidence * 100).toFixed(0)}%` : '--'}
        />
      </div>

      {/* Health Breakdown Bar */}
      {barSegments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Health Breakdown</h4>

          {/* Stacked Horizontal Bar */}
          <div className="w-full h-6 rounded-full overflow-hidden flex bg-slate-100">
            {barSegments.map((seg) => (
              <div
                key={seg.key}
                className="h-full transition-all duration-500 relative group"
                style={{
                  width: `${seg.pct}%`,
                  backgroundColor: seg.bg,
                  minWidth: seg.pct > 0 ? '4px' : '0',
                }}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {seg.label}: {seg.count} ({seg.pct.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>

          {/* Legend below bar */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {barSegments.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.bg }}
                />
                <span>
                  {seg.label}: {seg.count} ({seg.pct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="bg-white rounded-lg shadow-sm p-3">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </span>
    </div>
    <p className="text-xl font-bold text-slate-800">{value}</p>
  </div>
);

export default SurveyResultsPanel;
