import React from 'react';
import {
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { CHART_SERIES, CHART_TOOLTIP_STYLE, CHART_TOOLTIP_LABEL_STYLE } from '../../../theme/finchChartTheme';

export default function PieChart({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  height = 300,
  colors = CHART_SERIES,
  showLegend = true,
  innerRadius = 0,
  valueFormatter,
  className = '',
}) {
  const isDoughnut = innerRadius > 0;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPie>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={isDoughnut ? innerRadius : 0}
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={2}
            stroke="#FFFFFF"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
          />
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px' }}
            />
          )}
        </RechartsPie>
      </ResponsiveContainer>
    </div>
  );
}
