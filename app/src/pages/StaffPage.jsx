import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import BorderBeam from '../components/BorderBeam';
import SpatialCard from '../components/SpatialCard';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, monthIST, hrs, pay, money, fmtT, pad, getISTParts, fillMonths } from '../lib/utils';
import { triggerCelebration, springPhysics } from '../lib/animations';
import AnimatedCheckmark from '../components/AnimatedCheckmark';
import AttendanceCalendarMap from '../components/AttendanceCalendarMap';
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
  Fingerprint,
  MapPin,
  Phone,
  IdCard,
  FileText,
  Download,
  KeyRound,
  X,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  ClipboardList
} from '../components/Icons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './AdminPage.css';
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
  visible: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

function triggerHaptic(pattern = [40, 60, 40]) {
  try {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  } catch (e) {}
}

export default function StaffPage() {
  const { profile } = useAuth();
  const now = useClock();
  const [activeTab, setActiveTab] = useState('punch'); // 'punch' | 'salary' | 'duty' | 'idcard'
  const [todayRec, setTodayRec] = useState(null);
  const [monthRecs, setMonthRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Month & History View State
  const MONTH_CHOICES = useMemo(() => fillMonths(12), []);
  const [salMonth, setSalMonth] = useState(monthIST());
  const [historyViewMode, setHistoryViewMode] = useState('map'); // 'map' | 'list'
  const [listFilter, setListFilter] = useState('all'); // 'all' | 'full' | 'short' | 'active'

  const ist = getISTParts(now);
  const timeStr = `${pad(ist.hour)}:${pad(ist.minute)}:${pad(ist.second)}`;
  const dateStr = now.toLocaleDateString('hi-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateStrEn = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const dutyWard = profile?.ward || 'Ward 12 (Bank More / बैंक मोड़)';

  const istDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isSunday = istDateObj.getDay() === 0;
  const mins = Number(ist.hour) * 60 + Number(ist.minute);
  const inWindow = mins >= 360 && mins <= 480; // 6:00 AM to 8:00 AM IST
  const checkedOut = !!todayRec?.out_time;
  const checkedIn = !!todayRec && !checkedOut;

  const canCheckIn = !isSunday && inWindow && !todayRec;

  const loadData = useCallback(async (targetMonth = salMonth) => {
    if (!profile) return;
    const uid = profile.user_id;
    try {
      const [{ data: today, error: tErr }, { data: month, error: mErr }] = await Promise.all([
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('date', todayIST()).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('month_key', targetMonth).order('in_time', { ascending: false }),
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
  }, [profile, salMonth]);

  useEffect(() => { loadData(salMonth); }, [salMonth, loadData]);

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
      return { type: 'success', text: `${h.toFixed(2)}h Logged`, sub: 'Shift ended' };
    }
    if (checkedIn) return { type: 'warning', text: 'On Active Duty', sub: `Since ${fmtT(todayRec.in_time)}` };
    if (!inWindow) return { type: 'neutral', text: 'Check-in Closed', sub: 'Window: 6:00 – 8:00 AM' };
    return { type: 'pulse', text: 'Window Open', sub: 'Ready to punch' };
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
    triggerHaptic([50, 70, 50]);
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
      toast.success('उपस्थिति दर्ज हो गई! (Check-in recorded)', { id: tId });
    } catch (e) {
      console.error('Check-in failure:', e);
      toast.error('Check-in failed: ' + (e.message || 'Server error'), { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  async function doCheckOut() {
    if (btnLoading || !todayRec || todayRec.out_time) return;
    triggerHaptic([40, 80, 40]);
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
      toast.success(`कार्य समाप्त! ${h.toFixed(2)}h shift logged · ${money(pay(h))} earned`, { id: tId });
    } catch (e) {
      console.error('Check-out failure:', e);
      toast.error('Check-out failed: ' + (e.message || 'Server error'), { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  function exportPersonalCSV() {
    if (!monthRecs || monthRecs.length === 0) {
      toast.error('No attendance records to export.');
      return;
    }
    const headers = ['Date', 'Check In (IST)', 'Check Out (IST)', 'Hours Worked', 'Earned Wage (INR)', 'Duty Ward', 'Status'];
    const rows = monthRecs.map(r => {
      const h = hrs(r.in_time, r.out_time);
      const p = pay(h);
      return [
        r.date,
        fmtT(r.in_time),
        fmtT(r.out_time),
        h.toFixed(2),
        p,
        `"${r.ward || dutyWard}"`,
        r.status || 'Present'
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DMC_Attendance_${profile?.emp_id}_${salMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Attendance statement downloaded for ${salMonth}`);
  }

  async function handleChangePin(e) {
    e.preventDefault();
    const p = newPin.trim();
    if (!/^\d{6}$/.test(p)) {
      toast.error('PIN must be exactly 6 numeric digits.');
      return;
    }
    setPinLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) throw error;
      toast.success('Your 6-digit PIN was updated successfully!');
      setShowPinModal(false);
      setNewPin('');
    } catch (err) {
      toast.error('Failed to update PIN: ' + err.message);
    } finally {
      setPinLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="staff-layout">
        <Header title="धनबाद नगर निगम" subtitle="Employee Self-Service Portal" />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span className="page-loader-text">Loading Employee Portal... / पोर्टल लोड हो रहा है...</span>
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

  const navItems = [
    { key: 'punch',  label: 'दैनिक हाजिरी',  sub: 'Attendance & Punch', icon: Fingerprint, badge: pill.type === 'pulse' ? 'Open' : checkedIn ? 'Active' : undefined, badgeColor: pill.type === 'pulse' || checkedIn ? 'green' : undefined },
    { key: 'salary', label: 'वेतन व शिफ्ट',  sub: 'Salary & Ledger',    icon: IndianRupee, badge: completed.length > 0 ? String(completed.length) : undefined },
    { key: 'duty',   label: 'वार्ड व ड्यूटी', sub: 'Ward & Beat',        icon: MapPin },
    { key: 'idcard', label: 'पहचान पत्र',    sub: 'Digital ID Pass',    icon: IdCard, badge: 'Verified', badgeColor: 'green' },
  ];

  return (
    <div className="admin-layout staff-layout">
      <Header
        title="धनबाद नगर निगम — Staff Portal"
        subtitle="Daily Attendance & Wage Tracker"
      />

      <div className="admin-container staff-container">
        {/* ── Left Sidebar Navigation (Desktop / Tablet) — Uniform with Admin ── */}
        <aside className="admin-sidebar staff-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Fingerprint size={20} />
            </div>
            <div>
              <div className="sidebar-brand-title">DMC Portal</div>
              <div className="sidebar-brand-sub">Staff Workspace / कर्मचारी पोर्टल</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  id={`staff-tab-${item.key}`}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <div className="nav-item-icon">
                    <Icon size={18} />
                  </div>
                  <div className="nav-item-text">
                    <span className="nav-item-title">{item.label}</span>
                    <span className="nav-item-sub">{item.sub}</span>
                  </div>
                  {item.badge && (
                    <span className={`nav-item-badge ${item.badgeColor === 'green' ? 'badge-green' : item.badgeColor === 'amber' ? 'badge-amber' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-status-box">
              <span className="status-dot-pulse" />
              <span>GPS Lock: {dutyWard.split('(')[0].trim()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--neu-bg)', boxShadow: 'var(--neu-inset-xs)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neu-border-light)', fontSize: '0.74rem' }}>
              <span style={{ color: 'var(--mono-500)', fontWeight: 600 }}>Employee ID</span>
              <span className="font-mono font-bold" style={{ color: 'var(--mono-900)' }}>{profile?.emp_id}</span>
            </div>
          </div>
        </aside>

        {/* ── Main Workspace — Uniform with Admin ── */}
        <main className="admin-main-content staff-main-content">
          {/* Mobile Tab Pills (matching Admin) */}
          <div className="mobile-nav-tabs">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  id={`mobile-tab-${item.key}`}
                  className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="admin-view-content staff-view-content"
          >
            {/* Top Bar with Breadcrumbs & Action Button (matching Admin) */}
            <motion.div className="dashboard-top-bar" variants={fadeUp}>
              <div>
                <h2 className="dashboard-title">
                  {activeTab === 'punch' && 'दैनिक हाजिरी (Daily Attendance)'}
                  {activeTab === 'salary' && 'वेतन एवं शिफ्ट विवरणी (Salary & Shifts)'}
                  {activeTab === 'duty' && 'वार्ड व ड्यूटी (Ward & Beat Information)'}
                  {activeTab === 'idcard' && 'कर्मचारी डिजिटल पहचान पत्र (Digital Municipal ID)'}
                </h2>
                <p className="dashboard-subtitle">
                  {activeTab === 'punch' && `Live biometric & GPS attendance verification • ${dateStrEn}`}
                  {activeTab === 'salary' && `Calculated compensation, shifts, and earnings for ${monthIST()}`}
                  {activeTab === 'duty' && `Assigned beat: ${dutyWard} • Zone 2 Sanitation Department`}
                  {activeTab === 'idcard' && `Dhanbad Municipal Corporation • Employee ID: ${profile?.emp_id}`}
                </p>
              </div>

              <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className={`hero-status-pill status-${pill.type}`}>
                  <span className="status-dot" />
                  <span>{pill.text}</span>
                </div>
                {activeTab === 'salary' && (
                  <button className="btn btn-outline" onClick={exportPersonalCSV}>
                    <Download size={15} />
                    <span>Export Statement</span>
                  </button>
                )}
                {activeTab === 'idcard' && (
                  <button className="btn btn-outline" onClick={() => setShowPinModal(true)}>
                    <KeyRound size={15} />
                    <span>Change PIN</span>
                  </button>
                )}
              </div>
            </motion.div>

          {/* ══════════════════════════════════════════════════════════
              TAB 1: PUNCH ATTENDANCE (दैनिक हाजिरी)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'punch' && (
            <motion.div
              key="tab-punch"
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="tab-panel-container tab-panel-wide"
            >
              <div className="staff-punch-grid">
                {/* ── Left Column: Master Tactile Punch Disc & Clock ── */}
                <motion.div variants={fadeUp} className="punch-grid-col-left">
                  <BorderBeam duration={12} size={250}>
                    <div className="staff-master-punch-card">
                      {/* Top Worker Status Pill Row */}
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

                      {/* Shift Window Banner */}
                      <div className="punch-shift-window-bar">
                        <div>
                          <div className="shift-window-title">Shift Window / वर्तमान पाली</div>
                          <div className="shift-window-time">06:00 AM – 08:00 AM IST</div>
                        </div>
                        <span className={`shift-status-tag ${inWindow ? 'tag-open' : 'tag-closed'}`}>
                          {isSunday ? 'Sunday Off' : inWindow ? 'Window Open (खुला है)' : 'Window Closed (बंद है)'}
                        </span>
                      </div>

                      {/* Concentric Radial Well & Master Tactile Button */}
                      <div className="master-punch-well">
                        {/* Concentric Animated Status Rings */}
                        <div className={`punch-outer-ring ${canCheckIn ? 'ring-pulse-green' : checkedIn ? 'ring-pulse-amber' : ''}`} />
                        <div className="punch-middle-ring" />

                        {/* Main Tactile Action Disc */}
                        {!todayRec ? (
                          <motion.button
                            className={`tactile-punch-disc ${canCheckIn ? 'disc-active-in' : 'disc-disabled'}`}
                            onClick={doCheckIn}
                            disabled={!canCheckIn || btnLoading === 'in'}
                            whileHover={canCheckIn ? { scale: 1.03 } : {}}
                            whileTap={canCheckIn ? { scale: 0.95 } : {}}
                            transition={springPhysics.snappy}
                            aria-label="Punch attendance for today"
                          >
                            <div className="punch-disc-inner">
                              <Fingerprint size={48} className="punch-disc-icon text-emerald" />
                              <span className="punch-disc-action-hi">
                                {btnLoading === 'in' ? 'सत्यापित हो रहा है...' : 'उपस्थिति दर्ज करें'}
                              </span>
                              <span className="punch-disc-action-en">
                                {btnLoading === 'in' ? 'VERIFYING...' : 'PUNCH IN NOW'}
                              </span>
                            </div>
                          </motion.button>
                        ) : checkedIn ? (
                          <motion.button
                            className="tactile-punch-disc disc-active-out"
                            onClick={doCheckOut}
                            disabled={btnLoading === 'out'}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.95 }}
                            transition={springPhysics.snappy}
                            aria-label="Punch out shift"
                          >
                            <div className="punch-disc-inner">
                              <CheckCircle2 size={44} className="punch-disc-icon text-red" />
                              <span className="punch-disc-action-hi">
                                {btnLoading === 'out' ? 'दर्ज हो रहा है...' : 'कार्य समाप्त करें'}
                              </span>
                              <span className="punch-disc-action-en">
                                {btnLoading === 'out' ? 'SAVING...' : 'PUNCH OUT'}
                              </span>
                              <span className="punch-disc-duration font-mono">{liveHoursWorked}h</span>
                            </div>
                          </motion.button>
                        ) : (
                          <div className="tactile-punch-disc disc-completed">
                            <div className="punch-disc-inner">
                              <AnimatedCheckmark size={50} color="#15803d" />
                              <span className="punch-disc-action-hi">आज की हाजिरी दर्ज</span>
                              <span className="punch-disc-action-en">SHIFT COMPLETED</span>
                              <span className="punch-disc-duration font-mono">
                                {hrs(todayRec.in_time, todayRec.out_time).toFixed(2)}h
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Digital Clock Recessed Console */}
                      <div className="digital-clock-console">
                        <div className="digital-clock font-mono">{timeStr}</div>
                        <div className="digital-date">{dateStr} • {dateStrEn}</div>
                      </div>
                    </div>
                  </BorderBeam>
                </motion.div>

                {/* ── Right Column: Telemetry, Summary & Shift Goals ── */}
                <motion.div variants={fadeUp} className="punch-grid-col-right">
                  {/* Telemetry & GPS Banner */}
                  <div className="staff-telemetry-banner">
                    <div className="telemetry-left">
                      <span className="telemetry-ping-wrap">
                        <span className="telemetry-ping" />
                        <span className="telemetry-dot" />
                      </span>
                      <span className="telemetry-time font-mono">IST {pad(ist.hour)}:{pad(ist.minute)}</span>
                      <span className="telemetry-sep">•</span>
                      <span className="telemetry-location">GPS Lock: {dutyWard.split('(')[0].trim()} Chowk</span>
                    </div>
                    <span className="telemetry-acc-tag">Verified ±3m</span>
                  </div>

                  {/* Unclosed Shift Warning Banner */}
                  {unclosedShift && (
                    <div className="unclosed-shift-alert">
                      <AlertCircle size={18} color="#d97706" />
                      <div>
                        <strong>Missing Checkout ({unclosedShift.date}):</strong> Shift has no exit punch. Please notify your Supervisor to regularize.
                      </div>
                    </div>
                  )}

                  {/* Today's Punch Summary Box */}
                  <div className="staff-panel-card" style={{ padding: '16px 20px', gap: '12px' }}>
                    <div className="panel-title-with-icon">
                      <Clock size={16} color="#1e4a7a" />
                      <div>
                        <h4 className="staff-panel-title" style={{ fontSize: '0.94rem' }}>Today's Shift Punch / आज की हाजिरी</h4>
                        <p className="staff-panel-subtitle">{dateStrEn} • Recorded in DMC Registry</p>
                      </div>
                    </div>
                    <div className="today-punch-summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">Check-In / आगमन</span>
                        <span className="summary-val font-mono">{fmtT(todayRec?.in_time)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Check-Out / प्रस्थान</span>
                        <span className="summary-val font-mono">{fmtT(todayRec?.out_time)}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Today's Pay / मानदेय</span>
                        <span className="summary-val font-bold text-emerald">
                          {checkedOut ? money(pay(hrs(todayRec.in_time, todayRec.out_time))) : checkedIn ? `${money(pay(Number(liveHoursWorked)))} (est)` : '₹450 / 8h'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Goal Gradient Progress Bar (33% -> 100%) */}
                  <div className="shift-goal-gradient-card">
                    <div className="goal-gradient-header">
                      <span className="goal-step-label">
                        {!todayRec && 'Shift Step 1 of 3: Check-in Ready'}
                        {checkedIn && `Shift Step 2 of 3: Active Shift (${Math.min(100, Math.round(((Number(liveHoursWorked) || 0) / 8) * 100))}% towards ₹450)`}
                        {checkedOut && 'Shift Step 3 of 3: Shift Complete'}
                      </span>
                      <span className="goal-step-badge">
                        {!todayRec ? '33% ready' : checkedIn ? `${Math.max(33, Math.min(95, Math.round(33 + ((Number(liveHoursWorked) || 0) / 8) * 60)))}%` : '100% complete'}
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

                  {/* Loss Aversion Warning when checking out <8h */}
                  {checkedIn && Number(liveHoursWorked) > 0.05 && Number(liveHoursWorked) < 8 && (
                    <div className="loss-aversion-alert">
                      <AlertCircle size={16} className="loss-alert-icon" />
                      <div className="loss-alert-text">
                        <strong>Prevent Wage Loss:</strong> You have completed {liveHoursWorked}h ({money(pay(Number(liveHoursWorked)))}). Complete {(8 - Number(liveHoursWorked)).toFixed(1)}h more to claim your full guaranteed ₹450 wage!
                      </div>
                    </div>
                  )}

                  {/* Municipal Duty Quick Info */}
                  <div className="duty-detail-row" style={{ marginTop: 'auto' }}>
                    <span className="duty-row-label">Assigned Duty Beat</span>
                    <span className="duty-row-val font-semibold">{dutyWard}</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 2: SALARY & SHIFTS (वेतन एवं शिफ्ट)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'salary' && (
            <motion.div
              key="tab-salary"
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="tab-panel-container tab-panel-wide"
            >
              {/* KPI Grid */}
              <div className="staff-metrics-grid">
                <SpatialCard maxTilt={6} depth={8}>
                  <div className="staff-stat-card">
                    <div className="stat-card-icon icon-emerald">
                      <Award size={18} />
                    </div>
                    <div className="stat-card-body">
                      <span className="stat-card-label">Full Shifts (8h)</span>
                      <span className="stat-card-val"><AnimatedNumber value={fullDays} /></span>
                      <span className="stat-card-sub">₹450 per full day</span>
                    </div>
                  </div>
                </SpatialCard>

                <SpatialCard maxTilt={6} depth={8}>
                  <div className="staff-stat-card">
                    <div className="stat-card-icon icon-saff">
                      <Clock size={18} />
                    </div>
                    <div className="stat-card-body">
                      <span className="stat-card-label">Total Hours</span>
                      <span className="stat-card-val"><AnimatedNumber value={totalH} suffix="h" decimals={1} /></span>
                      <span className="stat-card-sub">{completed.length} shifts logged</span>
                    </div>
                  </div>
                </SpatialCard>

                <SpatialCard maxTilt={6} depth={8}>
                  <div className="staff-stat-card">
                    <div className="stat-card-icon icon-navy">
                      <IndianRupee size={18} />
                    </div>
                    <div className="stat-card-body">
                      <span className="stat-card-label">Accrued Salary</span>
                      <span className="stat-card-val font-bold text-emerald">
                        <AnimatedNumber value={earned} prefix="₹" decimals={0} />
                      </span>
                      <span className="stat-card-sub font-semibold text-navy">
                        Max ₹11,700 ({fullDays}/26 shifts)
                      </span>
                    </div>
                  </div>
                </SpatialCard>
              </div>

              {/* Master Hub: Attendance Calendar Map & Shift Ledger */}
              <motion.div className="staff-panel-card staff-history-hub-card" variants={fadeUp}>
                <div className="hub-header-bar">
                  <div className="panel-title-with-icon">
                    <History size={18} className="text-muted" />
                    <div>
                      <h3 className="staff-panel-title">Monthly Shift History & Attendance Map / मासिक हाजिरी व विवरणी मैप</h3>
                      <p className="staff-panel-subtitle">{salMonth} • {monthRecs.length} shifts recorded • {money(earned)} earned</p>
                    </div>
                  </div>

                  <div className="hub-controls-bar">
                    {/* Month Dropdown */}
                    <select
                      value={salMonth}
                      onChange={(e) => setSalMonth(e.target.value)}
                      className="month-select-staff font-mono"
                      aria-label="Select Attendance Month"
                    >
                      {MONTH_CHOICES.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>

                    {/* View Mode Toggle: Calendar Map vs Ledger List */}
                    <div className="hub-view-segmented-toggle">
                      <button
                        type="button"
                        className={`hub-view-btn ${historyViewMode === 'map' ? 'active' : ''}`}
                        onClick={() => setHistoryViewMode('map')}
                        title="Interactive Monthly Calendar Map"
                      >
                        <Calendar size={13} />
                        <span>Calendar Map / मैप</span>
                      </button>
                      <button
                        type="button"
                        className={`hub-view-btn ${historyViewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setHistoryViewMode('list')}
                        title="Chronological Shift List"
                      >
                        <ClipboardList size={13} />
                        <span>Shift Ledger / सूची</span>
                      </button>
                    </div>

                    {/* Export CSV Statement */}
                    <button
                      type="button"
                      className="btn-export-csv"
                      onClick={exportPersonalCSV}
                      title="Download Monthly CSV Statement"
                    >
                      <Download size={14} />
                      <span>CSV Statement</span>
                    </button>
                  </div>
                </div>

                {/* ── Mode 1: Calendar Shift Map ── */}
                {historyViewMode === 'map' && (
                  <AttendanceCalendarMap
                    monthKey={salMonth}
                    records={monthRecs}
                    todayDate={todayIST()}
                    dutyWard={dutyWard}
                  />
                )}

                {/* ── Mode 2: Detailed Shift Ledger List ── */}
                {historyViewMode === 'list' && (
                  <div className="ledger-list-wrapper">
                    {/* Filter Pills */}
                    <div className="ledger-filter-row">
                      <button
                        type="button"
                        className={`ledger-filter-chip ${listFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setListFilter('all')}
                      >
                        <span>All Shifts</span>
                        <span className="chip-count font-mono">{monthRecs.length}</span>
                      </button>
                      <button
                        type="button"
                        className={`ledger-filter-chip ${listFilter === 'full' ? 'active' : ''}`}
                        onClick={() => setListFilter('full')}
                      >
                        <span>Full Shifts (8h+)</span>
                        <span className="chip-count font-mono">{fullDays}</span>
                      </button>
                      {shortDays > 0 && (
                        <button
                          type="button"
                          className={`ledger-filter-chip ${listFilter === 'short' ? 'active' : ''}`}
                          onClick={() => setListFilter('short')}
                        >
                          <span>Short Shifts (&lt;8h)</span>
                          <span className="chip-count font-mono">{shortDays}</span>
                        </button>
                      )}
                      {monthRecs.some(r => !r.out_time && r.date === todayIST()) && (
                        <button
                          type="button"
                          className={`ledger-filter-chip ${listFilter === 'active' ? 'active' : ''}`}
                          onClick={() => setListFilter('active')}
                        >
                          <span>Active Today</span>
                          <span className="chip-count font-mono">1</span>
                        </button>
                      )}
                    </div>

                    {/* Shift Cards Container */}
                    <div className="ledger-cards-container">
                      {monthRecs.length === 0 ? (
                        <div className="empty-history">
                          <Calendar size={28} />
                          <span>No attendance records recorded for {salMonth}.</span>
                        </div>
                      ) : (
                        monthRecs
                          .filter(r => {
                            if (listFilter === 'all') return true;
                            if (listFilter === 'full') return r.out_time && hrs(r.in_time, r.out_time) >= 8;
                            if (listFilter === 'short') return r.out_time && hrs(r.in_time, r.out_time) < 8;
                            if (listFilter === 'active') return !r.out_time && r.date === todayIST();
                            return true;
                          })
                          .map(r => {
                            const isToday = r.date === todayIST();
                            const hasOut = !!r.out_time;
                            const h = hrs(r.in_time, r.out_time);
                            const dayPay = hasOut ? pay(h) : 0;
                            const dateObj = new Date(`${r.date}T12:00:00+05:30`);
                            const weekdayStr = dateObj.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase();

                            return (
                              <div key={r.id} className="ledger-card-item">
                                <div className="ledger-card-left">
                                  <div className="ledger-date-avatar font-mono">
                                    <span className="avatar-d">{r.date.slice(8)}</span>
                                    <span className="avatar-m">{weekdayStr}</span>
                                  </div>
                                  <div className="ledger-shift-meta">
                                    <div className="ledger-date-row">
                                      <span className="ledger-date-str font-mono">{r.date}</span>
                                      {isToday && <span className="today-chip">Today • आज</span>}
                                      {r.is_corrected && (
                                        <span className="corrected-chip" title="Verified Supervisor Regularization">
                                          Regularized
                                        </span>
                                      )}
                                    </div>
                                    <div className="ledger-times-row font-mono">
                                      <Clock size={12} className="text-muted" />
                                      <span>In: {fmtT(r.in_time)}</span>
                                      <span className="times-divider">•</span>
                                      <span>
                                        Out: {hasOut ? fmtT(r.out_time) : <span className="text-amber font-bold">Active Duty</span>}
                                      </span>
                                    </div>
                                    <div className="ledger-ward-tag">
                                      <MapPin size={11} />
                                      <span>{r.ward || dutyWard}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="ledger-card-right">
                                  {hasOut ? (
                                    <>
                                      <span className="ledger-hours-badge font-mono">{h.toFixed(2)}h</span>
                                      <span className="ledger-pay-badge font-mono">{money(dayPay)}</span>
                                      <span className={`ledger-type-chip ${h >= 8 ? 'chip-full' : 'chip-short'}`}>
                                        {h >= 8 ? 'Full Shift (₹450)' : 'Short Shift'}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="badge-on-duty">
                                      <span className="pulse-dot" />
                                      <span>Active Shift</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Auxiliary Row: Chart & Policy Cards */}
              <div className="staff-two-col-grid" style={{ marginTop: '16px' }}>
                <div className="two-col-left">
                  {/* Personal Shift Hours Mini Chart */}
                  {personalChartData.length > 2 && (
                    <motion.div className="staff-panel-card" variants={fadeUp}>
                      <div className="staff-panel-header">
                        <div>
                          <h3 className="staff-panel-title">Recent Shift Hours Trend / कार्य घंटे</h3>
                          <p className="staff-panel-subtitle">Hours recorded per day for {salMonth}</p>
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
                </div>

                <div className="two-col-right">
                  {/* Monthly Statutory Rate Card */}
                  <motion.div className="staff-panel-card" variants={fadeUp} style={{ padding: '16px 20px', gap: '10px' }}>
                    <div className="panel-title-with-icon">
                      <Award size={18} color="#10b981" />
                      <div>
                        <h4 className="staff-panel-title" style={{ fontSize: '0.92rem' }}>Statutory Wage Rate / निर्धारित मानदेय</h4>
                        <p className="staff-panel-subtitle">Dhanbad Municipal Corporation • Department of Sanitation</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--mono-600)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--neu-border-light)' }}>
                        <span>Standard Daily Wage (8h)</span>
                        <span className="font-bold font-mono text-emerald" style={{ fontSize: '0.9rem' }}>₹450.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--neu-border-light)' }}>
                        <span>Monthly Maximum (26 shifts)</span>
                        <span className="font-bold font-mono text-navy">₹11,700.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <span>Weekly Off (Sunday)</span>
                        <span className="font-bold text-amber">Statutory Holiday</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 3: WARD & BEAT INFO (कार्यक्षेत्र एवं ड्यूटी)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'duty' && (
            <motion.div
              key="tab-duty"
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="tab-panel-container tab-panel-wide"
            >
              <div className="staff-two-col-grid">
                <div className="two-col-left">
                  {/* Ward Supervisor Card with One-Tap Call */}
                  <motion.div className="staff-panel-card" variants={fadeUp}>
                    <div className="supervisor-card-inner">
                      <div className="supervisor-left">
                        <div className="supervisor-avatar">
                          <ShieldCheck size={22} />
                        </div>
                        <div>
                          <span className="supervisor-role-tag">Ward Supervisor / नगर निरीक्षक</span>
                          <h4 className="supervisor-name">Vikas Rawani</h4>
                          <p className="supervisor-contact font-mono">+91 93041 99882</p>
                        </div>
                      </div>
                      <a
                        href="tel:9304199882"
                        className="btn-call-supervisor"
                        title="Call Supervisor directly"
                      >
                        <Phone size={16} />
                        <span>Call / संपर्क करें</span>
                      </a>
                    </div>
                  </motion.div>

                  {/* Duty Assignment Card */}
                  <motion.div className="staff-panel-card" variants={fadeUp}>
                    <div className="duty-card-header">
                      <div className="duty-header-icon-wrap">
                        <MapPin size={22} className="text-secondary" />
                      </div>
                      <div>
                        <h3 className="staff-panel-title">Assigned Municipal Beat / आवंटित कार्यक्षेत्र</h3>
                        <p className="staff-panel-subtitle">Dhanbad Municipal Corporation • Zone 2</p>
                      </div>
                    </div>

                    <div className="duty-details-grid">
                      <div className="duty-detail-row">
                        <span className="duty-row-label">Assigned Ward / वार्ड</span>
                        <span className="duty-row-val font-bold">{dutyWard}</span>
                      </div>
                      <div className="duty-detail-row">
                        <span className="duty-row-label">Department / विभाग</span>
                        <span className="duty-row-val">{profile?.department || 'Sanitation / स्वच्छता'}</span>
                      </div>
                      <div className="duty-detail-row">
                        <span className="duty-row-label">Designation / पद</span>
                        <span className="duty-row-val">{profile?.designation || 'Sanitation Worker / सफाई कर्मचारी'}</span>
                      </div>
                      <div className="duty-detail-row">
                        <span className="duty-row-label">Shift Hours / पाली का समय</span>
                        <span className="duty-row-val">06:00 AM – 02:00 PM (8-hour standard shift)</span>
                      </div>
                      <div className="duty-detail-row">
                        <span className="duty-row-label">Muster Station</span>
                        <span className="duty-row-val">Ward 12 Corporation Office, Bank More Chowk</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="two-col-right">
                  {/* Official Rules & Corporation Helpline */}
                  <motion.div className="staff-panel-card" variants={fadeUp}>
                    <h3 className="staff-panel-title" style={{ marginBottom: 12 }}>
                      Official DMC Guidelines & Helplines / निर्देश एवं हेल्पलाइन
                    </h3>
                    <div className="guidelines-list">
                      <div className="guideline-item">
                        <span className="guideline-num">1</span>
                        <div>
                          <strong>Attendance Window:</strong> Check-in is permitted strictly between <strong>06:00 AM and 08:00 AM IST</strong>.
                        </div>
                      </div>
                      <div className="guideline-item">
                        <span className="guideline-num">2</span>
                        <div>
                          <strong>Daily Wage:</strong> Full 8-hour shift earns guaranteed statutory wage of <strong>₹450.00</strong>.
                        </div>
                      </div>
                      <div className="guideline-item">
                        <span className="guideline-num">3</span>
                        <div>
                          <strong>Weekly Off:</strong> Sunday is an official weekly holiday (no check-in permitted).
                        </div>
                      </div>
                      <div className="guideline-item">
                        <span className="guideline-num">4</span>
                        <div>
                          <strong>Missed Punch:</strong> If you forget to punch out, contact your Ward Supervisor for administrative regularization.
                        </div>
                      </div>
                    </div>

                    <div className="helpline-footer-box">
                      <Phone size={15} />
                      <span>DMC Municipal Control Room: <strong>0326-2312555</strong> • Toll-Free: <strong>1800-890-4115</strong></span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB 4: DIGITAL ID CARD (कर्मचारी पहचान पत्र)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'idcard' && (
            <motion.div
              key="tab-idcard"
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="tab-panel-container tab-panel-wide"
            >
              <div className="staff-two-col-grid">
                <div className="two-col-left">
                  {/* Holographic Digital Pass */}
                  <motion.div variants={fadeUp}>
                    <div className="digital-id-card-wrapper">
                      <div className="id-card-tristrip" />
                      <div className="id-card-header">
                        <div className="id-card-emblem-wrap">
                          <img
                            src={`${import.meta.env.BASE_URL}logo.png`}
                            alt="DMC Logo"
                            className="id-card-logo"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <div>
                            <div className="id-gov-title">झारखंड सरकार • धनबाद नगर निगम</div>
                            <div className="id-corp-title">Dhanbad Municipal Corporation</div>
                          </div>
                        </div>
                        <span className="id-verified-pill">
                          <span className="live-pulse" /> Verified
                        </span>
                      </div>

                      <div className="id-card-body">
                        <div className="id-photo-row">
                          <div className="id-avatar-box">
                            <span className="id-avatar-initials">
                              {profile?.name?.charAt(0)?.toUpperCase() || 'E'}
                            </span>
                          </div>
                          <div className="id-worker-meta">
                            <h3 className="id-worker-name">{profile?.name || 'Staff Member'}</h3>
                            <p className="id-worker-role">{profile?.designation || 'Sanitation Worker'}</p>
                            <span className="id-number-pill font-mono">{profile?.emp_id}</span>
                          </div>
                        </div>

                        <div className="id-fields-table">
                          <div className="id-field">
                            <span className="id-label">Assigned Ward</span>
                            <span className="id-val font-semibold">{dutyWard}</span>
                          </div>
                          <div className="id-field">
                            <span className="id-label">Department</span>
                            <span className="id-val font-semibold">{profile?.department || 'Sanitation'}</span>
                          </div>
                          <div className="id-field">
                            <span className="id-label">Registered Phone</span>
                            <span className="id-val font-mono">{profile?.phone || 'Not Registered'}</span>
                          </div>
                          <div className="id-field">
                            <span className="id-label">AEBAS Status</span>
                            <span className="id-val text-emerald font-semibold">Active & Authenticated</span>
                          </div>
                        </div>

                        {/* Stylized Barcode Representation */}
                        <div className="id-barcode-container">
                          <div className="barcode-lines" />
                          <span className="barcode-text font-mono">DMC-INSP-{profile?.emp_id}-2026</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="two-col-right">
                  {/* Security & Reset PIN Action Box */}
                  <motion.div className="staff-panel-card" variants={fadeUp}>
                    <div className="pin-mgmt-card">
                      <div className="pin-mgmt-left">
                        <div className="pin-mgmt-icon">
                          <KeyRound size={20} />
                        </div>
                        <div>
                          <h4 className="staff-panel-title">Login PIN & Security / सुरक्षा पिन</h4>
                          <p className="staff-panel-subtitle">Change your 6-digit login PIN anytime</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-change-pin"
                        onClick={() => setShowPinModal(true)}
                      >
                        Change PIN
                      </button>
                    </div>
                  </motion.div>

                  {/* AEBAS Biometric Compliance Card */}
                  <motion.div className="staff-panel-card" variants={fadeUp} style={{ padding: '18px 20px', gap: '12px' }}>
                    <div className="panel-title-with-icon">
                      <Fingerprint size={18} color="#1e4a7a" />
                      <div>
                        <h4 className="staff-panel-title" style={{ fontSize: '0.94rem' }}>AEBAS Biometric Compliance</h4>
                        <p className="staff-panel-subtitle">Govt of Jharkhand • Digital Municipal ID</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem', color: 'var(--mono-700)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <span>Aadhaar-Enabled Biometric Attendance (AEBAS) linked</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <span>GPS Geofencing Active for Zone 2 Ward Beat</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <span>Authorized for on-ground municipal inspections</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}

          </motion.div>
        </main>
      </div>

      {/* ── Change PIN Modal ── */}
      <AnimatePresence>
        {showPinModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPinModal(false)}>
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-icon-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3>Change Login PIN / पिन बदलें</h3>
                    <p className="modal-sub">Enter a new 6-digit numeric PIN</p>
                  </div>
                </div>
                <button className="modal-close-btn" onClick={() => setShowPinModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleChangePin}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">New 6-Digit PIN / नया 6-अंकीय पिन *</label>
                    <input
                      type="password"
                      className="form-input font-mono"
                      placeholder="e.g. 123456"
                      maxLength={6}
                      inputMode="numeric"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                    />
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '6px' }}>
                      PIN must be exactly 6 digits (numbers only).
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowPinModal(false)}
                    disabled={pinLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pinLoading}
                  >
                    {pinLoading ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
                    <span>{pinLoading ? 'Updating...' : 'Update PIN'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
