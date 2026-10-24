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
      <div
        style={{
          background: 'var(--neu-bg, #e9eef5)',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: 'var(--neu-flat, 6px 6px 14px rgba(164, 178, 198, 0.7), -6px -6px 14px rgba(255, 255, 255, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          fontFamily: 'var(--font)',
        }}
      >
        <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--mono-900, #0f172a)', marginBottom: 6 }}>
          {label}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {payload.map((item, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  boxShadow: `0 0 6px ${item.color}`,
                }}
              />
              <span style={{ color: 'var(--mono-600, #475569)', fontWeight: 600 }}>{item.name}:</span>
              <span style={{ fontWeight: 800, color: 'var(--mono-900, #0f172a)', fontFamily: 'var(--font-mono)' }}>
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
            <span className="chart-legend-color" style={{ backgroundColor: '#0f172a' }} />
            <span>Present Staff</span>
          </div>
          <div className="chart-legend-item">
            <span className="chart-legend-color" style={{ backgroundColor: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)' }} />
            <span>Total Hours</span>
          </div>
        </div>
      </div>
      <div className="chart-container" style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f172a" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(164, 178, 198, 0.4)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: 'rgba(164, 178, 198, 0.5)' }}
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
              stroke="#0f172a"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorPresent)"
            />
            <Area
              type="monotone"
              dataKey="hours"
              name="Hours"
              stroke="#10b981"
              strokeWidth={2.2}
              fillOpacity={1}
              fill="url(#colorHours)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
