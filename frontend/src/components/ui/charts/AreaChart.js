import React from 'react';
import {
  ResponsiveContainer,
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const defaultColors = ['#2D5016', '#3b82f6', '#E8791D', '#8b5cf6', '#22c55e', '#ef4444'];

export default function AreaChart({
  data = [],
  dataKeys = [],
  xKey = 'date',
  height = 300,
  colors = defaultColors,
  showGrid = true,
  showLegend = false,
  valueFormatter,
  xFormatter,
  stacked = false,
  className = '',
}) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsArea data={data}>
          {showGrid && (
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          )}
          <XAxis
            dataKey={xKey}
            tickFormatter={xFormatter}
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <YAxis
            tickFormatter={valueFormatter}
            tick={{ fontSize: 12 }}
            className="text-gray-500 dark:text-gray-400"
          />
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            labelFormatter={xFormatter}
            contentStyle={{
              backgroundColor: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-primary, #e5e7eb)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          {showLegend && <Legend />}
          {dataKeys.map((key, i) => (
            <Area
              key={typeof key === 'string' ? key : key.key}
              type="monotone"
              dataKey={typeof key === 'string' ? key : key.key}
              name={typeof key === 'string' ? key : key.label}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.15}
              strokeWidth={2}
              stackId={stacked ? 'stack' : undefined}
              dot={false}
            />
          ))}
        </RechartsArea>
      </ResponsiveContainer>
    </div>
  );
}
