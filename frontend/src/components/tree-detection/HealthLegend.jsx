import React from 'react';

const HEALTH_CATEGORIES = [
  { key: 'healthy', color: '#22c55e', label: 'Healthy' },
  { key: 'moderate', color: '#eab308', label: 'Moderate' },
  { key: 'stressed', color: '#f97316', label: 'Stressed' },
  { key: 'critical', color: '#ef4444', label: 'Critical' },
  { key: 'unknown', color: '#9ca3af', label: 'Unknown' },
];

const HealthLegend = ({ healthSummary }) => {
  return (
    <div className="bg-white bg-opacity-95 rounded-lg shadow-md px-3 py-2.5 text-xs">
      <p className="font-semibold text-slate-700 mb-1.5">Tree Health</p>
      <div className="space-y-1">
        {HEALTH_CATEGORIES.map(({ key, color, label }) => {
          // healthSummary can be: { healthy: 10, moderate: 5, ... }
          // or: { healthy: { count: 10 }, moderate: { count: 5 }, ... }
          const rawVal = healthSummary?.[key];
          const count =
            rawVal != null
              ? typeof rawVal === 'object'
                ? rawVal.count || 0
                : rawVal
              : null;

          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-600">{label}</span>
              {count != null && (
                <span className="ml-auto font-medium text-slate-800">{count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HealthLegend;
