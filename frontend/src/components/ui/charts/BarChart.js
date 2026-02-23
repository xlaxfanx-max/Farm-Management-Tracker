import React from 'react';
import {
  ResponsiveContainer,
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

const defaultColors = ['#2D5016', '#3b82f6', '#E8791D', '#8b5cf6', '#22c55e', '#ef4444'];

export default function BarChart({
  data = [],
  dataKeys = [],
  xKey = 'name',
  height = 300,
  colors = defaultColors,
  showGrid = true,
  showLegend = false,
  valueFormatter,
  xFormatter,
  stacked = false,
  horizontal = false,
  barColors,
  className = '',
}) {
  const Layout = horizontal ? 'vertical' : undefined;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar data={data} layout={Layout}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          )}
          {horizontal ? (
            <>
              <YAxis
                dataKey={xKey}
                type="category"
                tick={{ fontSize: 12 }}
                width={100}
              />
              <XAxis type="number" tickFormatter={valueFormatter} tick={{ fontSize: 12 }} />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tickFormatter={xFormatter}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickFormatter={valueFormatter} tick={{ fontSize: 12 }} />
            </>
          )}
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            contentStyle={{
              backgroundColor: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-primary, #e5e7eb)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          {showLegend && <Legend />}
          {dataKeys.map((key, i) => (
            <Bar
              key={typeof key === 'string' ? key : key.key}
              dataKey={typeof key === 'string' ? key : key.key}
              name={typeof key === 'string' ? key : key.label}
              fill={colors[i % colors.length]}
              stackId={stacked ? 'stack' : undefined}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            >
              {barColors &&
                data.map((_, idx) => (
                  <Cell key={idx} fill={barColors[idx % barColors.length]} />
                ))}
            </Bar>
          ))}
        </RechartsBar>
      </ResponsiveContainer>
    </div>
  );
}
