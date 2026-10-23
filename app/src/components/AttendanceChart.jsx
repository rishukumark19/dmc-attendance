import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <div className="chart-tooltip-items">
          {payload.map((item, index) => (
            <div key={index} className="chart-tooltip-item">
              <span className="chart-tooltip-dot" style={{ backgroundColor: item.color }} />
              <span className="chart-tooltip-name">{item.name}:</span>
              <span className="chart-tooltip-val">
                {item.name.toLowerCase().includes('hours') ? `${item.value}h` : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function AttendanceChart({ data, title = "Attendance Trends", subtitle = "Daily attendance & shift activity" }) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3 className="chart-title">{title}</h3>
          <p className="chart-subtitle">{subtitle}</p>
        </div>
        <div className="chart-legend-wrap">
          <div className="chart-legend-item">
            <span className="chart-legend-color chart-legend-blue" />
            <span>Present Staff</span>
          </div>
          <div className="chart-legend-item">
            <span className="chart-legend-color chart-legend-saff" />
            <span>Total Hours</span>
          </div>
        </div>
      </div>
      <div className="chart-container" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1e4a7a" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#1e4a7a" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8761a" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#e8761a" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="present"
              name="Present"
              stroke="#1e4a7a"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorPresent)"
            />
            <Area
              type="monotone"
              dataKey="hours"
              name="Hours"
              stroke="#e8761a"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorHours)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
