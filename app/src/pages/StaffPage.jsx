import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import MagicCard from '../components/MagicCard';
import BorderBeam from '../components/BorderBeam';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, monthIST, hrs, pay, money, fmtT, pad } from '../lib/utils';
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

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = now.toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isSunday = istNow.getDay() === 0;
  const mins = istNow.getHours() * 60 + istNow.getMinutes();
  const inWindow = mins >= 360 && mins < 481; // 6:00 AM to 8:01 AM
  const checkedOut = !!todayRec?.out_time;
  const checkedIn = !!todayRec && !checkedOut;

  const canCheckIn  = !isSunday && inWindow && !todayRec;
  const canCheckOut = checkedIn;

  const loadData = useCallback(async () => {
    if (!profile) return;
    const uid = profile.user_id;
    const [{ data: today }, { data: month }] = await Promise.all([
      supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('date', todayIST()).maybeSingle(),
      supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('month_key', monthIST()).order('in_time', { ascending: false }),
    ]);
    setTodayRec(today);
    setMonthRecs(month || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadData(); }, [loadData]);

  // Live timer for active shift
  const liveHoursWorked = useMemo(() => {
    if (!checkedIn || !todayRec?.in_time) return null;
    const [h, m, s] = todayRec.in_time.split(':').map(Number);
    const startMins = h * 60 + m + (s || 0) / 60;
    const currentMins = istNow.getHours() * 60 + istNow.getMinutes() + istNow.getSeconds() / 60;
    const elapsed = Math.max(0, (currentMins - startMins) / 60);
    return elapsed.toFixed(2);
  }, [checkedIn, todayRec, now]);

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
    setBtnLoading('in');
    const tId = toast.loading('Marking attendance...');
    try {
      const { data, error } = await supabase.rpc('do_check_in', {
        p_emp_id: profile.emp_id, p_staff_name: profile.name,
      });
      if (error) throw error;
      setTodayRec(data);
      await loadData();
      triggerCelebration();
      toast.success('Check-in recorded successfully!', { id: tId });
    } catch (e) {
      toast.error('Check-in failed: ' + e.message, { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  async function doCheckOut() {
    if (!todayRec) return;
    setBtnLoading('out');
    const tId = toast.loading('Recording checkout...');
    try {
      const { data, error } = await supabase.rpc('do_check_out', { p_id: todayRec.id });
      if (error) throw error;
      setTodayRec(data);
      await loadData();
      triggerCelebration();
      const h = hrs(data.in_time, data.out_time);
      toast.success(`${h.toFixed(2)}h shift saved · ${money(pay(h))} earned`, { id: tId });
    } catch (e) {
      toast.error('Check-out failed: ' + e.message, { id: tId });
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

                <div className="hero-center">
                  <div className="digital-clock font-mono">{timeStr}</div>
                  <div className="digital-date">{dateStr}</div>
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
                <span className="stat-card-sub">This month</span>
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
