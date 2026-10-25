import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Sparkles,
  Award,
  ChevronRight
} from './Icons';
import { hrs, pay, money, fmtT, pad, cleanWard } from '../lib/utils';
import './AttendanceCalendarMap.css';

const WEEKDAYS = [
  { key: 'mon', en: 'Mon', hi: 'सोम', fullEn: 'Monday', fullHi: 'सोमवार' },
  { key: 'tue', en: 'Tue', hi: 'मंगल', fullEn: 'Tuesday', fullHi: 'मंगलवार' },
  { key: 'wed', en: 'Wed', hi: 'बुध', fullEn: 'Wednesday', fullHi: 'बुधवार' },
  { key: 'thu', en: 'Thu', hi: 'गुरु', fullEn: 'Thursday', fullHi: 'गुरुवार' },
  { key: 'fri', en: 'Fri', hi: 'शुक्र', fullEn: 'Friday', fullHi: 'शुक्रवार' },
  { key: 'sat', en: 'Sat', hi: 'शनि', fullEn: 'Saturday', fullHi: 'शनिवार' },
  { key: 'sun', en: 'Sun', hi: 'रवि', fullEn: 'Sunday', fullHi: 'रविवार', isSun: true },
];

const MONTH_NAMES_HI = {
  '01': 'जनवरी',
  '02': 'फ़रवरी',
  '03': 'मार्च',
  '04': 'अप्रैल',
  '05': 'मई',
  '06': 'जून',
  '07': 'जुलाई',
  '08': 'अगस्त',
  '09': 'सितंबर',
  '10': 'अक्टूबर',
  '11': 'नवंबर',
  '12': 'दिसंबर'
};

export default function AttendanceCalendarMap({
  monthKey,
  records = [],
  todayDate,
  dutyWard = 'Ward 12 (Bank More)'
}) {
  const [yearNum, monthNum] = useMemo(() => {
    const parts = (monthKey || '').split('-').map(Number);
    return [parts[0] || 2026, parts[1] || 10];
  }, [monthKey]);

  const monthStr = pad(monthNum);
  const monthNameEn = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [yearNum, monthNum]);

  const monthNameHi = MONTH_NAMES_HI[monthStr] || '';

  // Index records by YYYY-MM-DD
  const recsByDate = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (r.date) map[r.date] = r;
    }
    return map;
  }, [records]);

  // Compute total days and calendar layout
  const daysInMonth = useMemo(() => new Date(yearNum, monthNum, 0).getDate(), [yearNum, monthNum]);
  const startCol = useMemo(() => {
    const firstDow = new Date(yearNum, monthNum - 1, 1).getDay(); // 0 = Sun
    return (firstDow + 6) % 7; // 0 = Mon ... 6 = Sun
  }, [yearNum, monthNum]);

  // Build cells array
  const cells = useMemo(() => {
    const list = [];
    // Prefix empty cells
    for (let i = 0; i < startCol; i++) {
      list.push({ type: 'empty', id: `empty-${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearNum}-${monthStr}-${pad(d)}`;
      const dt = new Date(yearNum, monthNum - 1, d);
      const dow = dt.getDay();
      const isSun = dow === 0;
      const isToday = dateStr === todayDate;
      const isFuture = dateStr > todayDate;
      const rec = recsByDate[dateStr];

      let status = 'none';
      let hours = 0;
      let dayWage = 0;

      if (rec) {
        if (!rec.out_time) {
          status = isToday ? 'active' : 'unclosed';
        } else {
          hours = hrs(rec.in_time, rec.out_time);
          dayWage = pay(hours);
          status = hours >= 8 ? 'full' : 'short';
        }
      } else if (isSun) {
        status = 'sunday';
      } else if (isFuture) {
        status = 'upcoming';
      } else {
        status = 'absent';
      }

      list.push({
        type: 'day',
        id: dateStr,
        dayNum: d,
        dateStr,
        dow,
        dowObj: WEEKDAYS[(dow + 6) % 7],
        isToday,
        isSunday: isSun,
        isFuture,
        rec,
        status,
        hours,
        dayWage
      });
    }
    return list;
  }, [yearNum, monthNum, monthStr, daysInMonth, startCol, todayDate, recsByDate]);

  // Selected Day state (default to today if in current month, or the latest record)
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    if (recsByDate[todayDate]) return todayDate;
    const sortedDates = Object.keys(recsByDate).sort();
    return sortedDates[sortedDates.length - 1] || `${yearNum}-${monthStr}-01`;
  });

  // Ensure selected day is valid when month changes
  const activeSelectedCell = useMemo(() => {
    const match = cells.find(c => c.type === 'day' && c.dateStr === selectedDateStr);
    if (match) return match;
    const firstDayCell = cells.find(c => c.type === 'day' && c.rec);
    return firstDayCell || cells.find(c => c.type === 'day') || null;
  }, [cells, selectedDateStr]);

  // Summary counts for this month
  const counts = useMemo(() => {
    let full = 0;
    let short = 0;
    let active = 0;
    let unclosed = 0;
    let sundays = 0;
    let absent = 0;

    cells.forEach(c => {
      if (c.type !== 'day') return;
      if (c.status === 'full') full++;
      else if (c.status === 'short') short++;
      else if (c.status === 'active') active++;
      else if (c.status === 'unclosed') unclosed++;
      else if (c.status === 'sunday') sundays++;
      else if (c.status === 'absent') absent++;
    });

    return { full, short, active, unclosed, sundays, absent };
  }, [cells]);

  return (
    <div className="attendance-calendar-map-root">
      {/* ── Metric Snapshot Banner ── */}
      <div className="cal-snapshot-banner">
        <div className="cal-stat-pill pill-present">
          <span className="pill-dot dot-emerald" />
          <span className="pill-label">Working Shifts:</span>
          <span className="pill-val font-mono">{counts.full + counts.short + counts.active}</span>
        </div>
        <div className="cal-stat-pill pill-full">
          <span className="pill-dot dot-teal" />
          <span className="pill-label">Full (8h+ • ₹450):</span>
          <span className="pill-val font-mono">{counts.full}</span>
        </div>
        {counts.short > 0 && (
          <div className="cal-stat-pill pill-short">
            <span className="pill-dot dot-amber" />
            <span className="pill-label">Short (&lt;8h):</span>
            <span className="pill-val font-mono">{counts.short}</span>
          </div>
        )}
        {counts.active > 0 && (
          <div className="cal-stat-pill pill-active">
            <span className="pill-dot dot-pulse-active" />
            <span className="pill-label">Live Today:</span>
            <span className="pill-val font-mono">1 Active</span>
          </div>
        )}
        <div className="cal-stat-pill pill-sunday">
          <span className="pill-dot dot-slate" />
          <span className="pill-label">Weekly Offs:</span>
          <span className="pill-val font-mono">{counts.sundays}</span>
        </div>
      </div>

      {/* ── 7-Column Day Header Row ── */}
      <div className="cal-weekdays-row">
        {WEEKDAYS.map(w => (
          <div key={w.key} className={`cal-weekday-col ${w.isSun ? 'col-sunday' : ''}`}>
            <span className="weekday-hi">{w.hi}</span>
            <span className="weekday-en">{w.en}</span>
          </div>
        ))}
      </div>

      {/* ── 7-Column Calendar Map Matrix ── */}
      <div className="cal-grid-matrix">
        {cells.map(c => {
          if (c.type === 'empty') {
            return <div key={c.id} className="cal-cell-empty" />;
          }

          const isSelected = activeSelectedCell?.dateStr === c.dateStr;

          return (
            <motion.div
              key={c.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedDateStr(c.dateStr)}
              className={`cal-day-cell cell-${c.status} ${isSelected ? 'cell-selected' : ''} ${c.isToday ? 'cell-today' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Attendance for ${c.dateStr}`}
            >
              {/* Day Header Row */}
              <div className="day-cell-top">
                <span className="day-num font-mono">{c.dayNum}</span>
                {c.isToday && <span className="today-micro-badge">आज</span>}
              </div>

              {/* Status Visual Indicator */}
              <div className="day-cell-content">
                {c.status === 'full' && (
                  <div className="cell-shift-tag tag-full">
                    <span className="shift-hours-micro">{c.hours.toFixed(1)}h</span>
                    <span className="shift-pay-micro">₹450</span>
                  </div>
                )}

                {c.status === 'short' && (
                  <div className="cell-shift-tag tag-short">
                    <span className="shift-hours-micro">{c.hours.toFixed(1)}h</span>
                    <span className="shift-pay-micro">{money(c.dayWage)}</span>
                  </div>
                )}

                {c.status === 'active' && (
                  <div className="cell-shift-tag tag-active">
                    <span className="active-dot-live" />
                    <span className="shift-hours-micro">LIVE</span>
                  </div>
                )}

                {c.status === 'unclosed' && (
                  <div className="cell-shift-tag tag-unclosed">
                    <AlertCircle size={10} />
                    <span className="shift-hours-micro">Audit</span>
                  </div>
                )}

                {c.status === 'sunday' && (
                  <div className="cell-shift-tag tag-sunday">
                    <span>Off</span>
                  </div>
                )}

                {c.status === 'absent' && (
                  <div className="cell-shift-tag tag-absent">
                    <span>—</span>
                  </div>
                )}

                {c.status === 'upcoming' && (
                  <div className="cell-shift-tag tag-upcoming">
                    <span>•</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Legend Bar ── */}
      <div className="cal-legend-bar">
        <div className="legend-item">
          <span className="legend-chip chip-full" />
          <span>8h+ Full Shift (पूर्ण शिफ्ट • ₹450)</span>
        </div>
        <div className="legend-item">
          <span className="legend-chip chip-short" />
          <span>&lt;8h Short Shift (अल्पकालिक)</span>
        </div>
        <div className="legend-item">
          <span className="legend-chip chip-active" />
          <span>Active Shift (आज सक्रिय)</span>
        </div>
        <div className="legend-item">
          <span className="legend-chip chip-sunday" />
          <span>Sunday (रविवार अवकाश)</span>
        </div>
        <div className="legend-item">
          <span className="legend-chip chip-absent" />
          <span>Absent / Off (अनुपस्थित)</span>
        </div>
      </div>

      {/* ── Interactive Day Shift Inspector Drawer/Card ── */}
      <AnimatePresence mode="wait">
        {activeSelectedCell && (
          <motion.div
            key={activeSelectedCell.dateStr}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="cal-day-inspector-card"
          >
            <div className="inspector-header">
              <div className="inspector-title-area">
                <div className="inspector-day-avatar font-mono">
                  <span className="avatar-day-num">{activeSelectedCell.dayNum}</span>
                  <span className="avatar-day-str">{activeSelectedCell.dowObj?.en?.toUpperCase()}</span>
                </div>
                <div>
                  <h4 className="inspector-date-hi">
                    {activeSelectedCell.dowObj?.fullHi}, {activeSelectedCell.dayNum} {monthNameHi} {yearNum}
                  </h4>
                  <p className="inspector-date-en font-mono">
                    {activeSelectedCell.dowObj?.fullEn}, {activeSelectedCell.dateStr}
                    {activeSelectedCell.isToday && <span className="inspector-today-tag">Today • आज</span>}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="inspector-status-badge-wrapper">
                {activeSelectedCell.status === 'full' && (
                  <span className="inspector-badge badge-full">
                    <CheckCircle2 size={14} />
                    <span>पूर्ण शिफ्ट (Full Shift • 8.0h+)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'short' && (
                  <span className="inspector-badge badge-short">
                    <Clock size={14} />
                    <span>अल्पकालिक शिफ्ट (Short Shift)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'active' && (
                  <span className="inspector-badge badge-active">
                    <span className="pulse-ping-ring" />
                    <span>सक्रिय ड्यूटी (On Active Duty)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'unclosed' && (
                  <span className="inspector-badge badge-unclosed">
                    <AlertCircle size={14} />
                    <span>Missing Exit Punch (चेकआउट अपूर्ण)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'sunday' && (
                  <span className="inspector-badge badge-sunday">
                    <Award size={14} />
                    <span>साप्ताहिक अवकाश (Sunday Holiday)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'absent' && (
                  <span className="inspector-badge badge-absent">
                    <span>अनुपस्थित (No Shift Recorded)</span>
                  </span>
                )}
                {activeSelectedCell.status === 'upcoming' && (
                  <span className="inspector-badge badge-upcoming">
                    <span>आगामी कार्य दिवस (Scheduled)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Inspector Details Body */}
            {activeSelectedCell.rec ? (
              <div className="inspector-details-grid">
                {/* Punch In */}
                <div className="inspector-detail-box">
                  <span className="box-sub">आगमन समय (Check-in)</span>
                  <div className="box-val font-mono text-emerald">
                    <Clock size={15} />
                    <span>{fmtT(activeSelectedCell.rec.in_time)}</span>
                  </div>
                  <span className="box-hint">Biometric In-gate</span>
                </div>

                {/* Punch Out */}
                <div className="inspector-detail-box">
                  <span className="box-sub">प्रस्थान समय (Check-out)</span>
                  <div className="box-val font-mono">
                    <Clock size={15} />
                    <span>
                      {activeSelectedCell.rec.out_time ? (
                        fmtT(activeSelectedCell.rec.out_time)
                      ) : (
                        <span className="text-amber">सक्रिय (In Duty)</span>
                      )}
                    </span>
                  </div>
                  <span className="box-hint">{activeSelectedCell.rec.out_time ? 'Biometric Out-gate' : 'Punch out pending'}</span>
                </div>

                {/* Duration */}
                <div className="inspector-detail-box">
                  <span className="box-sub">कुल कार्य अवधि (Hours)</span>
                  <div className="box-val font-mono text-navy">
                    <span>{activeSelectedCell.rec.out_time ? `${activeSelectedCell.hours.toFixed(2)}h` : 'Running'}</span>
                  </div>
                  <div className="progress-micro-bar">
                    <div
                      className="progress-micro-fill"
                      style={{
                        width: `${Math.min(100, Math.round(((activeSelectedCell.hours || 0) / 8) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                {/* Wage Earned */}
                <div className="inspector-detail-box">
                  <span className="box-sub">अर्जित मानदेय (Daily Wage)</span>
                  <div className="box-val font-mono text-emerald" style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    <IndianRupee size={15} />
                    <span>{activeSelectedCell.rec.out_time ? money(activeSelectedCell.dayWage).replace('₹', '') : '450.00 (est)'}</span>
                  </div>
                  <span className="box-hint">
                    {activeSelectedCell.hours >= 8 ? 'Full Statutory ₹450 Rate' : 'Pro-rated at ₹56.25/hr'}
                  </span>
                </div>
              </div>
            ) : activeSelectedCell.isSunday ? (
              <div className="inspector-empty-message">
                <Award size={20} className="text-amber" />
                <span>
                  साप्ताहिक सवेतन अवकाश (Statutory DMC Sunday Weekly Off). Workers earn weekly rest per municipal service terms.
                </span>
              </div>
            ) : activeSelectedCell.isFuture ? (
              <div className="inspector-empty-message">
                <Calendar size={20} className="text-muted" />
                <span>आगामी कार्य दिवस (Scheduled working day). Daily biometric window opens at 06:00 AM IST.</span>
              </div>
            ) : (
              <div className="inspector-empty-message">
                <AlertCircle size={20} className="text-muted" />
                <span>इस दिवस पर कोई हाजिरी दर्ज नहीं है (No attendance recorded for this working day).</span>
              </div>
            )}

            {/* Additional Metadata / Regularization Banner */}
            {activeSelectedCell.rec && (
              <div className="inspector-footer-bar">
                <div className="inspector-ward-badge">
                  <MapPin size={13} className="text-muted" />
                  <span>{cleanWard(activeSelectedCell.rec.ward || dutyWard)}</span>
                </div>

                {activeSelectedCell.rec.is_corrected ? (
                  <div className="inspector-corrected-badge">
                    <ShieldCheck size={13} />
                    <span>प्रमाणित सुधार (Supervisor Regularized): {activeSelectedCell.rec.remarks || 'Field log verified'}</span>
                  </div>
                ) : (
                  <div className="inspector-verified-badge">
                    <ShieldCheck size={13} />
                    <span>DMC Biometric & GPS Verified Record</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
