import React from 'react';
import {
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const defaultColors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

export default function PieChart({
  data = [],
  dataKey = 'value',
  nameKey = 'name',
  height = 300,
  colors = defaultColors,
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
            stroke="var(--bg-card, #fff)"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={valueFormatter ? (val) => [valueFormatter(val)] : undefined}
            contentStyle={{
              backgroundColor: 'var(--bg-card, #fff)',
              border: '1px solid var(--border-primary, #e5e7eb)',
              borderRadius: '8px',
              fontSize: '13px',
            }}
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
