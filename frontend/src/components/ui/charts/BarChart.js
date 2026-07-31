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
import { CHART_SERIES, CHART_GRID, CHART_TICK, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '../../../theme/finchChartTheme';

export default function BarChart({
  data = [],
  dataKeys = [],
  xKey = 'name',
  height = 300,
  colors = CHART_SERIES,
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
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
          )}
          {horizontal ? (
            <>
              <YAxis
                dataKey={xKey}
                type="category"
                tick={CHART_TICK}
                width={100}
              />
              <XAxis type="number" tickFormatter={valueFormatter} tick={CHART_TICK} />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tickFormatter={xFormatter}
                tick={CHART_TICK}
              />
              <YAxis tickFormatter={valueFormatter} tick={CHART_TICK} />
            </>
          )}
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
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
