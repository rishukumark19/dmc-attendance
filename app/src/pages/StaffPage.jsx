import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import MagicCard from '../components/MagicCard';
import BorderBeam from '../components/BorderBeam';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, monthIST, hrs, pay, money, fmtT, pad, getISTParts } from '../lib/utils';
import { triggerCelebration, springPhysics } from '../lib/animations';
import AnimatedCheckmark from '../components/AnimatedCheckmark';
import {
  Clock,
  CheckCircle2,
  Calendar,
  IndianRupee,
  AlertCircle,
  Timer,
  Check,
  ChevronRight,
  Sparkles,
  History,
  TrendingUp,
  Award,
  RefreshCw,
} from '../components/Icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './StaffPage.css';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function StaffPage() {
  const { profile } = useAuth();
  const now = useClock();
  const [todayRec, setTodayRec] = useState(null);
  const [monthRecs, setMonthRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState('');

  const dutyWard = profile?.ward || 'Ward 12 (Bank More / बैंक मोड़)';

  const ist = getISTParts(now) || {
    year: '2026', month: '01', day: '01', hour: '00', minute: '00', second: '00'
  };
  const timeStr = `${ist.hour}:${ist.minute}:${ist.second}`;
  const dateStr = now.toLocaleDateString('hi-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const istDateObj = new Date(`${ist.year}-${ist.month}-${ist.day}T${ist.hour}:${ist.minute}:${ist.second}+05:30`);
  const isSunday = istDateObj.getDay() === 0;
  const mins = Number(ist.hour) * 60 + Number(ist.minute);
  const inWindow = mins >= 360 && mins <= 480; // 6:00 AM to 8:00 AM IST
  const checkedOut = !!todayRec?.out_time;
  const checkedIn = !!todayRec && !checkedOut;

  const canCheckIn  = !isSunday && inWindow && !todayRec;
  const canCheckOut = checkedIn;

  const loadData = useCallback(async () => {
    if (!profile) return;
    const uid = profile.user_id;
    try {
      const [{ data: today, error: tErr }, { data: month, error: mErr }] = await Promise.all([
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('date', todayIST()).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('month_key', monthIST()).order('in_time', { ascending: false }),
      ]);
      if (tErr) {
        console.error('Today record fetch error:', tErr);
        toast.error('Unable to fetch today attendance from server.');
      } else {
        let mockRec = null;
        if (import.meta.env.DEV) {
          const stateParam = new URLSearchParams(window.location.search).get('state');
          if (stateParam === 'active') {
            mockRec = { id: 'test-1', staff_user_id: uid, date: todayIST(), in_time: new Date(Date.now() - 4.5 * 3600000).toISOString(), out_time: null };
          } else if (stateParam === 'checked_out') {
            mockRec = { id: 'test-2', staff_user_id: uid, date: todayIST(), in_time: new Date(Date.now() - 8.5 * 3600000).toISOString(), out_time: new Date().toISOString() };
          }
        }
        setTodayRec(mockRec || (today && today.length > 0 ? today[0] : null));
      }
      if (mErr) {
        console.error('Month records fetch error:', mErr);
      } else {
        setMonthRecs(month || []);
      }
    } catch (err) {
      console.error('Error loading attendance data:', err);
      toast.error('Network error loading attendance data.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  // Check for past unclosed shifts (missing check-out)
  const unclosedShift = useMemo(() => {
    return monthRecs.find(r => r.in_time && !r.out_time && r.date !== todayIST());
  }, [monthRecs]);

  // Live timer for active shift (handles ISO timestamptz and legacy HH:MM)
  const liveHoursWorked = useMemo(() => {
    if (!checkedIn || !todayRec?.in_time) return null;
    const inMs = new Date(todayRec.in_time).getTime();
    if (isNaN(inMs)) {
      const parts = String(todayRec.in_time).split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const startMins = parts[0] * 60 + parts[1] + (parts[2] || 0) / 60;
        const currentMins = Number(ist.hour) * 60 + Number(ist.minute) + Number(ist.second) / 60;
        return Math.max(0, (currentMins - startMins) / 60).toFixed(2);
      }
      return '0.00';
    }
    const elapsed = Math.max(0, (now.getTime() - inMs) / 3600000);
    return elapsed.toFixed(2);
  }, [checkedIn, todayRec, now, ist.hour, ist.minute, ist.second]);

  const statusPill = () => {
    if (isSunday) return { type: 'neutral', text: 'Sunday Holiday / अवकाश', sub: 'Weekly off' };
    if (checkedOut) {
      const h = hrs(todayRec.in_time, todayRec.out_time);
      return { type: 'success', text: `${h.toFixed(2)}h Completed`, sub: 'Shift ended' };
    }
    if (checkedIn) return { type: 'warning', text: 'On Active Duty', sub: `Since ${fmtT(todayRec.in_time)}` };
    if (!inWindow) return { type: 'neutral', text: 'Check-in Closed', sub: 'Window: 6:00 – 8:00 AM' };
    return { type: 'pulse', text: 'Window Open', sub: 'Check in now' };
  };
  const pill = statusPill();

  const completed = monthRecs.filter(r => r.out_time);
  const totalH    = completed.reduce((a, r) => a + hrs(r.in_time, r.out_time), 0);
  const fullDays  = completed.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const shortDays = completed.filter(r => hrs(r.in_time, r.out_time) < 8).length;
  const earned    = completed.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);

  // Staff Personal Chart Data
  const personalChartData = useMemo(() => {
    const sorted = [...completed].reverse().slice(-10);
    return sorted.map(r => ({
      date: r.date.slice(5),
      hours: Math.round(hrs(r.in_time, r.out_time) * 10) / 10,
    }));
  }, [completed]);

  async function doCheckIn() {
    if (btnLoading || todayRec) return;
    setBtnLoading('in');
    const tId = toast.loading('Marking attendance with DMC server...');
    try {
      const { data, error } = await supabase.rpc('do_check_in', {
        p_emp_id: profile.emp_id,
        p_staff_name: profile.name,
        p_ward: dutyWard,
      });
      if (error) {
        if (error.message?.includes('already been recorded') || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
          await loadData();
          toast.success('Attendance is already recorded for today!', { id: tId });
          return;
        }
        throw error;
      }
      if (!data) throw new Error('No attendance record returned from server.');
      setTodayRec(data);
      await loadData();
      triggerCelebration();
      toast.success('Check-in recorded successfully!', { id: tId });
    } catch (e) {
      console.error('Check-in failure:', e);
      toast.error('Check-in failed: ' + (e.message || 'Server error'), { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  async function doCheckOut() {
    if (btnLoading || !todayRec || todayRec.out_time) return;
    setBtnLoading('out');
    const tId = toast.loading('Recording checkout...');
    try {
      const { data, error } = await supabase.rpc('do_check_out', { p_id: todayRec.id });
      if (error) throw error;
      if (!data) throw new Error('No checkout confirmation returned from server.');
      setTodayRec(data);
      await loadData();
      triggerCelebration();
      const h = hrs(data.in_time, data.out_time);
      toast.success(`${h.toFixed(2)}h shift saved · ${money(pay(h))} earned`, { id: tId });
    } catch (e) {
      console.error('Check-out failure:', e);
      toast.error('Check-out failed: ' + (e.message || 'Server error'), { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  if (loading) {
    return (
      <div className="staff-layout">
        <Header title="धनबाद नगर निगम" subtitle="Employee Self-Service Portal" />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span className="page-loader-text">Loading Employee Portal...</span>
          </div>
        </div>
      </div>
    );
  }

  if (profile && profile.active === false) {
    return (
      <div className="staff-layout">
        <Header title="धनबाद नगर निगम" subtitle="Employee Self-Service Portal" />
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '32px 24px', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #fee2e2', boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.1)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
            Account Inactive / खाता निष्क्रिय है
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: 12 }}>
            Your municipal employee account (<strong>{profile.emp_id}</strong>) has been marked inactive by Dhanbad Municipal Corporation administration.
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Attendance submission is disabled. Please contact your supervisor or ward nodal officer for assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-layout">
      <Header
        title="धनबाद नगर निगम — Staff Portal"
        subtitle="Daily Attendance & Wage Tracker"
      />

      <main className="staff-main-container">
        <motion.div
          className="staff-content-wrap"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {/* ── Employee Hero Profile Card ── */}
          <motion.div variants={fadeUp}>
            <BorderBeam duration={12} size={250}>
              <div className="staff-hero-card">
                <div className="hero-top-row">
                  <div className="hero-badge-wrap">
                    <span className="hero-tag">DMC Employee</span>
                    <span className="hero-id-tag font-mono">{profile?.emp_id}</span>
                  </div>
                  <div className={`hero-status-pill status-${pill.type}`}>
                    <span className="status-dot" />
                    <span>{pill.text}</span>
                  </div>
                </div>

                <div className="ward-selector-row">
                  <span className="ward-selector-label">📍 Duty Ward:</span>
                  <span className="ward-assigned-val">{dutyWard}</span>
                </div>

                {/* Unclosed Shift Warning Banner */}
                {unclosedShift && (
                  <div className="unclosed-shift-alert" style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    color: '#92400e',
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <AlertCircle size={18} color="#d97706" />
                    <div>
                      <strong>Missing Checkout from {unclosedShift.date}:</strong> Shift has no exit punch. Please notify your Ward Supervisor or Admin to regularize.
                    </div>
                  </div>
                )}

                <div className="hero-center">
                  <div className="digital-clock font-mono">{timeStr}</div>
                  <div className="digital-date">{dateStr}</div>
                </div>

                {/* 2. Goal Gradient Effect: 3-step shift progress (never start at 0%) */}
                <div className="shift-goal-gradient-card">
                  <div className="goal-gradient-header">
                    <span className="goal-step-label">
                      {!todayRec && 'Shift Step 1 of 3: Check-in Ready'}
                      {checkedIn && `Shift Step 2 of 3: Active Shift (${Math.min(100, Math.round(((Number(liveHoursWorked) || 0) / 8) * 100))}% towards ₹450)`}
                      {checkedOut && 'Shift Step 3 of 3: Shift Complete'}
                    </span>
                    <span className="goal-step-badge">
                      {!todayRec ? '33% initiated' : checkedIn ? `${Math.max(33, Math.min(95, Math.round(33 + ((Number(liveHoursWorked) || 0) / 8) * 60)))}%` : '100% complete'}
                    </span>
                  </div>
                  <div className="goal-progress-track">
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: !todayRec ? '33%' : checkedIn ? `${Math.max(33, Math.min(95, Math.round(33 + ((Number(liveHoursWorked) || 0) / 8) * 60)))}%` : '100%'
                      }}
                    />
                  </div>
                </div>

                {/* Shift Details or Live Timer */}
                {checkedIn && (
                  <div className="live-shift-banner">
                    <div className="live-banner-left">
                      <Timer size={18} className="live-banner-icon" />
                      <div>
                        <div className="live-banner-title">Active Shift in Progress</div>
                        <div className="live-banner-sub">Check-in time: {fmtT(todayRec.in_time)}</div>
                      </div>
                    </div>
                    <div className="live-banner-hours font-mono">
                      {liveHoursWorked}h
                    </div>
                  </div>
                )}

                {/* 5. Loss Aversion: Alert when checking out before 8 hours */}
                {checkedIn && Number(liveHoursWorked) > 0.05 && Number(liveHoursWorked) < 8 && (
                  <div className="loss-aversion-alert">
                    <AlertCircle size={16} className="loss-alert-icon" />
                    <div className="loss-alert-text">
                      <strong>Prevent Wage Loss:</strong> You have completed {liveHoursWorked}h. Checking out now pays {money(pay(Number(liveHoursWorked)))} instead of ₹450. Complete {(8 - Number(liveHoursWorked)).toFixed(1)}h more to claim your full guaranteed ₹450 wage!
                    </div>
                  </div>
                )}

                {checkedOut && (
                  <div className="shift-completed-banner">
                    <CheckCircle2 size={18} />
                    <span>Today's shift complete ({hrs(todayRec.in_time, todayRec.out_time).toFixed(2)}h logged)</span>
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="hero-actions">
                  {!todayRec && (
                    <motion.button
                      className="btn-shift-primary"
                      onClick={doCheckIn}
                      disabled={!canCheckIn || btnLoading === 'in'}
                      whileHover={canCheckIn ? { scale: 1.02 } : {}}
                      whileTap={canCheckIn ? { scale: 0.96 } : {}}
                      transition={springPhysics.snappy}
                    >
                      {btnLoading === 'in' ? <RefreshCw size={18} className="spin" /> : <Clock size={18} />}
                      <span>{canCheckIn ? 'Check In / उपस्थिति दर्ज करें' : 'Check-In Window (6:00 – 8:00 AM)'}</span>
                    </motion.button>
                  )}

                  {checkedIn && (
                    <motion.button
                      className="btn-shift-checkout"
                      onClick={doCheckOut}
                      disabled={btnLoading === 'out'}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      transition={springPhysics.snappy}
                    >
                      {btnLoading === 'out' ? <RefreshCw size={18} className="spin" /> : <CheckCircle2 size={18} />}
                      <span>Check Out / कार्य समाप्त करें</span>
                    </motion.button>
                  )}

                  {checkedOut && (
                    <div className="shift-done-pill">
                      <AnimatedCheckmark size={24} color="#15803d" />
                      <span>Shift Logged for Today</span>
                    </div>
                  )}
                </div>
              </div>
            </BorderBeam>
          </motion.div>

          {/* ── Monthly Summary KPI Cards ── */}
          <motion.div className="staff-metrics-grid" variants={fadeUp}>
            <MagicCard className="staff-stat-card" gradientColor="rgba(22, 163, 74, 0.2)">
              <div className="stat-card-icon icon-emerald">
                <Award size={18} />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-label">Full Shifts (8h)</span>
                <span className="stat-card-val"><AnimatedNumber value={fullDays} /></span>
                <span className="stat-card-sub">₹450 per shift</span>
              </div>
            </MagicCard>

            <MagicCard className="staff-stat-card" gradientColor="rgba(232, 118, 26, 0.2)">
              <div className="stat-card-icon icon-saff">
                <Clock size={18} />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-label">Total Hours</span>
                <span className="stat-card-val"><AnimatedNumber value={totalH} suffix="h" decimals={1} /></span>
                <span className="stat-card-sub">{completed.length} shifts logged</span>
              </div>
            </MagicCard>

            <MagicCard className="staff-stat-card" gradientColor="rgba(30, 74, 122, 0.2)">
              <div className="stat-card-icon icon-navy">
                <IndianRupee size={18} />
              </div>
              <div className="stat-card-body">
                <span className="stat-card-label">Estimated Salary</span>
                <span className="stat-card-val font-bold text-emerald">
                  <AnimatedNumber value={earned} prefix="₹" decimals={0} />
                </span>
                <span className="stat-card-sub font-semibold text-navy">
                  Anchor: ₹11,700 max ({fullDays}/26 shifts)
                </span>
              </div>
            </MagicCard>
          </motion.div>

          {/* ── Personal Shift Hours Mini Chart ── */}
          {personalChartData.length > 2 && (
            <motion.div className="staff-panel-card" variants={fadeUp}>
              <div className="staff-panel-header">
                <div>
                  <h3 className="staff-panel-title">Recent Shift Hours</h3>
                  <p className="staff-panel-subtitle">Hours recorded per day this month</p>
                </div>
                <div className="trend-badge">
                  <TrendingUp size={13} />
                  <span>Activity</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={personalChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPersonalHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1e4a7a" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#1e4a7a" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 9]} />
                    <Tooltip
                      formatter={(val) => [`${val} hrs`, 'Work Hours']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#1e4a7a"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorPersonalHours)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {/* ── Shift History Log ── */}
          <motion.div className="staff-panel-card" variants={fadeUp}>
            <div className="staff-panel-header">
              <div className="panel-title-with-icon">
                <History size={17} className="text-muted" />
                <h3 className="staff-panel-title">Monthly Shift History</h3>
              </div>
              <span className="badge-count">{monthRecs.length} records</span>
            </div>

            <div className="history-list">
              {monthRecs.length === 0 ? (
                <div className="empty-history">
                  <Calendar size={28} className="empty-icon" />
                  <p>No attendance records logged for this month yet.</p>
                </div>
              ) : (
                monthRecs.map(r => {
                  const h = hrs(r.in_time, r.out_time);
                  const isFull = h >= 8;
                  const isToday = r.date === todayIST();
                  return (
                    <div key={r.id} className="history-item">
                      <div className="history-left">
                        <div className={`history-dot ${!r.out_time ? 'dot-active' : isFull ? 'dot-success' : 'dot-warn'}`} />
                        <div>
                          <div className="history-date">
                            <span>{r.date}</span>
                            {isToday && <span className="today-chip">Today</span>}
                          </div>
                          <div className="history-times font-mono">
                            <span>In: {fmtT(r.in_time)}</span>
                            {r.out_time && <span> • Out: {fmtT(r.out_time)}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="history-right">
                        {r.out_time ? (
                          <>
                            <div className="history-hours">{h.toFixed(2)}h</div>
                            <div className="history-pay text-emerald">{money(pay(h))}</div>
                          </>
                        ) : (
                          <span className="badge-on-duty">On Duty</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
