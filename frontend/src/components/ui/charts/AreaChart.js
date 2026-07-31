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
import { CHART_SERIES, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '../../../theme/finchChartTheme';

export default function AreaChart({
  data = [],
  dataKeys = [],
  xKey = 'date',
  height = 300,
  colors = CHART_SERIES,
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
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          )}
          <XAxis
            dataKey={xKey}
            tickFormatter={xFormatter}
            tick={CHART_TICK}
          />
          <YAxis
            tickFormatter={valueFormatter}
            tick={CHART_TICK}
          />
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            labelFormatter={xFormatter}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
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
