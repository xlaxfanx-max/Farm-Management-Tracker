// =============================================================================
// WELL USAGE CHART COMPONENTS
// =============================================================================

import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

// =============================================================================
// HELPERS
// =============================================================================

const aggregateByYear = (readings) => {
  const yearMap = {};
  readings.forEach(r => {
    const year = new Date(r.reading_date).getFullYear();
    if (!yearMap[year]) yearMap[year] = 0;
    yearMap[year] += parseFloat(r.extraction_acre_feet) || 0;
  });
  return Object.entries(yearMap)
    .map(([year, total]) => ({ year: parseInt(year), total: Math.round(total * 10000) / 10000 }))
    .sort((a, b) => a.year - b.year);
};

const selectLabelIndices = (length, maxLabels) => {
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
};

const shortDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
};

const formatAF = (val) => {
  const n = parseFloat(val);
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
};

// =============================================================================
// EXTRACTION LINE CHART
// =============================================================================

const ExtractionLineChart = ({ readings }) => {
  const chartWidth = 600;
  const chartHeight = 160;
  const pad = { top: 15, right: 20, bottom: 28, left: 55 };
  const plotW = chartWidth - pad.left - pad.right;
  const plotH = chartHeight - pad.top - pad.bottom;

  const values = readings.map(r => parseFloat(r.extraction_acre_feet) || 0);
  const maxVal = Math.max(...values, 0.001);

  const points = readings.map((r, i) => {
    const x = pad.left + (readings.length === 1 ? plotW / 2 : (i / (readings.length - 1)) * plotW);
    const y = pad.top + plotH - (values[i] / maxVal) * plotH;
    return { x, y, reading: r, val: values[i] };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const yTicks = [0, maxVal / 2, maxVal];
  const xLabels = selectLabelIndices(readings.length, 6);

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ maxHeight: '200px' }}>
      {yTicks.map((val, i) => {
        const y = pad.top + plotH - (val / maxVal) * plotH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={chartWidth - pad.right} y2={y}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
              {formatAF(val)} AF
            </text>
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH}
        stroke="#e5e7eb" strokeWidth="1" />
      {points.length > 1 && (
        <polygon
          points={`${points[0].x},${pad.top + plotH} ${polyline} ${points[points.length - 1].x},${pad.top + plotH}`}
          fill="#0891b2" fillOpacity="0.06"
        />
      )}
      {points.length > 1 && (
        <polyline points={polyline} fill="none"
          stroke="#0891b2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5"
          fill="#0891b2" stroke="white" strokeWidth="2" className="cursor-pointer">
          <title>{`${new Date(p.reading.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${formatAF(p.val)} AF`}</title>
        </circle>
      ))}
      {xLabels.map(i => (
        <text key={i} x={points[i].x} y={chartHeight - 4}
          textAnchor="middle" fontSize="9" fill="#9ca3af">
          {shortDate(readings[i].reading_date)}
        </text>
      ))}
    </svg>
  );
};

// =============================================================================
// ANNUAL BAR CHART
// =============================================================================

const AnnualBarChart = ({ readings }) => {
  const yearData = aggregateByYear(readings);
  if (yearData.length === 0) return null;

  const maxVal = Math.max(...yearData.map(d => d.total), 0.001);
  const barHeight = 140;

  return (
    <div className="flex items-end gap-3" style={{ height: `${barHeight + 30}px` }}>
      <div className="flex flex-col justify-between text-right pr-1" style={{ height: `${barHeight}px`, minWidth: '45px' }}>
        <span className="text-xs text-gray-400">{formatAF(maxVal)}</span>
        <span className="text-xs text-gray-400">{formatAF(maxVal / 2)}</span>
        <span className="text-xs text-gray-400">0</span>
      </div>
      <div className="flex-1 flex items-end gap-2 relative" style={{ height: `${barHeight + 24}px` }}>
        <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-200" style={{ height: '1px' }} />
        <div className="absolute left-0 right-0 border-t border-dashed border-gray-200" style={{ top: `${barHeight / 2}px`, height: '1px' }} />
        <div className="absolute left-0 right-0 border-t border-gray-200" style={{ top: `${barHeight}px`, height: '1px' }} />
        {yearData.map((item) => {
          const pct = (item.total / maxVal) * barHeight;
          return (
            <div key={item.year} className="flex-1 flex flex-col items-center justify-end" style={{ height: `${barHeight + 24}px`, maxWidth: '80px' }}>
              <span className="text-xs text-cyan-700 font-medium mb-1">{formatAF(item.total)}</span>
              <div
                className="w-full bg-cyan-500 rounded-t-md hover:bg-cyan-400 transition-colors cursor-pointer"
                style={{ height: `${Math.max(pct, 3)}px` }}
                title={`${item.year}: ${formatAF(item.total)} AF`}
              />
              <span className="text-xs text-gray-500 mt-1.5 font-medium">{item.year}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// WELL USAGE CHART (MAIN EXPORT)
// =============================================================================

const WellUsageChart = ({ readings }) => {
  const [chartMode, setChartMode] = useState('line');

  const validReadings = (readings || [])
    .filter(r => r.extraction_acre_feet != null && parseFloat(r.extraction_acre_feet) > 0)
    .sort((a, b) => new Date(a.reading_date) - new Date(b.reading_date));

  if (validReadings.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          Extraction History
        </h4>
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setChartMode('line')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartMode === 'line'
                ? 'bg-white dark:bg-gray-600 text-cyan-700 dark:text-cyan-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Per Reading
          </button>
          <button
            onClick={() => setChartMode('bar')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartMode === 'bar'
                ? 'bg-white dark:bg-gray-600 text-cyan-700 dark:text-cyan-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Annual Total
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {chartMode === 'line' ? (
          <ExtractionLineChart readings={validReadings} />
        ) : (
          <AnnualBarChart readings={validReadings} />
        )}
      </div>
    </div>
  );
};

export default WellUsageChart;
