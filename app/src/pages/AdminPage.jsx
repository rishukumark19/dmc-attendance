import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import MagicCard from '../components/MagicCard';
import AttendanceChart from '../components/AttendanceChart';
import { useAuth } from '../context/AuthContext';
import { supabase, makeTempClient } from '../lib/supabase';
import { todayIST, hrs, pay, money, fmtT, getInitials, fillMonths, pad } from '../lib/utils';
import {
  Users,
  Calendar,
  ClipboardList,
  BarChart3,
  Search,
  Plus,
  Download,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShieldCheck,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Trash2,
  TrendingUp,
  Building2,
  X,
  RefreshCw,
} from '../components/Icons';
import './AdminPage.css';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

const MONTHS = fillMonths(12);

// ──────────────────────────────────────────────
// Add Staff Modal (Shadcn Dialog Style)
// ──────────────────────────────────────────────
function AddStaffModal({ onClose, onAdded, existingIds }) {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSave() {
    const n = name.trim(), id = empId.trim().toUpperCase(), p = pin.trim();
    if (!n || !id || !p) { setMsg({ type: 'err', text: 'Please fill all required fields.' }); return; }
    if (p.length < 4)   { setMsg({ type: 'err', text: 'PIN must be at least 4 digits.' }); return; }
    if (existingIds.includes(id)) { setMsg({ type: 'err', text: 'Employee ID already exists!' }); return; }

    setLoading(true);
    try {
      const email = `${id.toLowerCase()}@dmc.org`;
      const tmp = makeTempClient();
      const { data: signUpData, error: signUpErr } = await tmp.auth.signUp({ email, password: p });
      if (signUpErr) throw signUpErr;
      const newUid = signUpData.user?.id;
      if (!newUid) throw new Error('Could not create user account. Check Supabase Auth settings.');
      const { error: dbErr } = await supabase.from('staff').insert({ user_id: newUid, name: n, emp_id: id, role: 'staff', active: true });
      if (dbErr) throw dbErr;
      setMsg({ type: 'ok', text: `${n} added successfully!` });
      setTimeout(() => { onAdded(); onClose(); }, 1200);
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="modal-box"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25 }}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge">
              <Plus size={18} />
            </div>
            <div>
              <h3>Add New Staff</h3>
              <p className="modal-sub">नया कर्मचारी जोड़ें</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="hint-box">
          <Building2 size={16} className="hint-icon" />
          <span>Staff will log in using their <strong>Employee ID</strong> and <strong>PIN</strong>.</span>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name / पूरा नाम</label>
            <input
              className="form-input"
              placeholder="e.g. Ramesh Kumar"
              maxLength={80}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Employee ID / कर्मचारी क्रमांक</label>
            <input
              className="form-input font-mono"
              placeholder="e.g. EMP001"
              maxLength={20}
              value={empId}
              onChange={e => setEmpId(e.target.value.toUpperCase())}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Login PIN (4–8 digits) / लॉगिन पिन</label>
            <input
              className="form-input font-mono"
              placeholder="e.g. 1234"
              maxLength={8}
              inputMode="numeric"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g,''))}
            />
          </div>

          {msg && (
            <div className={`modal-msg ${msg.type === 'ok' ? 'modal-msg-ok' : 'modal-msg-err'}`}>
              {msg.type === 'ok' ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span>{msg.text}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
            <span>{loading ? 'Registering...' : 'Save Employee'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Admin Page
// ──────────────────────────────────────────────
export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('staff');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [allStaff, setAllStaff] = useState([]);
  const [todayRecs, setTodayRecs] = useState([]);
  const [salRecs, setSalRecs] = useState([]);
  const [allRecs, setAllRecs] = useState([]);

  const [salMonth, setSalMonth] = useState(MONTHS[0].value);
  const [recMonth, setRecMonth] = useState(MONTHS[0].value);
  const [staffSearch, setStaffSearch] = useState('');
  const [recSearch, setRecSearch] = useState('');
  const [recStatus, setRecStatus] = useState('');

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from('staff').select('*').eq('active', true).neq('role', 'admin').order('name');
    setAllStaff(data || []);
  }, []);

  const loadToday = useCallback(async () => {
    const { data } = await supabase.from('attendance').select('*').eq('date', todayIST());
    setTodayRecs(data || []);
  }, []);

  const loadSalary = useCallback(async (month) => {
    const { data } = await supabase.from('attendance').select('*').eq('month_key', month);
    setSalRecs(data || []);
  }, []);

  const loadRecs = useCallback(async (month) => {
    const { data } = await supabase.from('attendance').select('*').eq('month_key', month).order('in_time', { ascending: false });
    setAllRecs(data || []);
  }, []);

  useEffect(() => {
    Promise.all([loadStaff(), loadToday(), loadSalary(salMonth)]).then(() => setLoading(false));
  }, []);

  useEffect(() => { loadSalary(salMonth); }, [salMonth]);
  useEffect(() => { loadRecs(recMonth); }, [recMonth]);

  async function removeStaff(id, name) {
    if (!confirm(`Are you sure you want to deactivate ${name}? Their attendance logs will be preserved.`)) return;
    const { error } = await supabase.from('staff').update({ active: false }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(`${name} deactivated`);
    await loadStaff();
  }

  function downloadCSV() {
    const lines = [['Employee ID', 'Name', 'Full Days', 'Short Shifts', 'Total Hours', 'Salary INR']];
    allStaff.forEach(s => {
      const recs = salRecs.filter(r => r.staff_user_id === s.user_id && r.out_time);
      const h = recs.reduce((a, r) => a + Math.min(8, hrs(r.in_time, r.out_time)), 0);
      const full = recs.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
      const sht  = recs.length - full;
      const tot  = recs.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);
      lines.push([s.emp_id, s.name, full, sht, h.toFixed(2), tot.toFixed(2)]);
    });
    const csv = '\ufeff' + lines.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `dmc-salary-${salMonth}.csv`;
    a.click();
    toast.success('Salary CSV exported!');
  }

  // ── Stats Calculations ──
  const salCompleted = salRecs.filter(r => r.out_time);
  const totalFull = salCompleted.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const totalPay  = salCompleted.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);
  const salMonthLabel = new Date(salMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const presentPercentage = allStaff.length > 0
    ? Math.round((todayRecs.length / allStaff.length) * 100)
    : 0;

  // ── Chart Trends Calculation ──
  const chartData = useMemo(() => {
    const dateMap = {};
    salRecs.forEach(r => {
      if (!r.date) return;
      if (!dateMap[r.date]) {
        dateMap[r.date] = {
          date: r.date.slice(5),
          present: 0,
          hours: 0,
        };
      }
      dateMap[r.date].present += 1;
      if (r.out_time) {
        dateMap[r.date].hours += Math.round(Math.min(8, hrs(r.in_time, r.out_time)) * 10) / 10;
      }
    });
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  }, [salRecs]);

  // ── Filtered staff ──
  const filteredStaff = allStaff.filter(s =>
    !staffSearch || s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.emp_id?.toLowerCase().includes(staffSearch.toLowerCase())
  );

  // ── Filtered records ──
  const filteredRecs = allRecs.filter(r => {
    const matchName = !recSearch || (r.staff_name || '').toLowerCase().includes(recSearch.toLowerCase()) || (r.emp_id || '').toLowerCase().includes(recSearch.toLowerCase());
    let matchStatus = true;
    if (recStatus) {
      const h = hrs(r.in_time, r.out_time);
      const s = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
      matchStatus = s === recStatus;
    }
    return matchName && matchStatus;
  });

  // ── Salary rows ──
  const salaryRows = allStaff.map(s => {
    const recs = salRecs.filter(r => r.staff_user_id === s.user_id && r.out_time);
    const totalH = recs.reduce((a, r) => a + Math.min(8, hrs(r.in_time, r.out_time)), 0);
    const full = recs.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
    const sht  = recs.filter(r => hrs(r.in_time, r.out_time) < 8).length;
    const total = recs.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);
    return { s, totalH, full, sht, total };
  });
  const salTotH   = salaryRows.reduce((a, r) => a + r.totalH, 0);
  const salTotF   = salaryRows.reduce((a, r) => a + r.full, 0);
  const salTotPay = salaryRows.reduce((a, r) => a + r.total, 0);

  // ── Today's absent list ──
  const presentIds = new Set(todayRecs.map(r => r.staff_user_id));
  const absentStaff = allStaff.filter(s => !presentIds.has(s.user_id));

  if (loading) {
    return (
      <div className="admin-page">
        <Header title="धनबाद नगर निगम — Admin Dashboard" subtitle="Attendance & Salary Management System" />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span className="page-loader-text">Loading DMC Portal...</span>
          </div>
        </div>
      </div>
    );
  }

  const tabPanelVariant = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
  };

  const navItems = [
    { key: 'staff',   label: 'Staff Directory',   sub: 'कर्मचारी सूची',      icon: Users,        badge: allStaff.length },
    { key: 'today',   label: 'Today Live',        sub: 'आज की उपस्थिति',    icon: Clock,        badge: todayRecs.length, badgeColor: 'green' },
    { key: 'records', label: 'Attendance Logs',   sub: 'दैनिक रिकॉर्ड',      icon: ClipboardList },
    { key: 'salary',  label: 'Salary & Payroll',  sub: 'मासिक वेतन',        icon: BarChart3 },
  ];

  return (
    <div className="admin-layout">
      <Header
        title="धनबाद नगर निगम — Admin"
        subtitle="Attendance & Salary Management"
      />

      <AnimatePresence>
        {showModal && (
          <AddStaffModal
            onClose={() => setShowModal(false)}
            onAdded={() => { loadStaff(); loadToday(); }}
            existingIds={allStaff.map(s => s.emp_id?.toUpperCase())}
          />
        )}
      </AnimatePresence>

      <div className="admin-container">
        {/* ── Left Sidebar Navigation (Desktop / Tablet) ── */}
        <aside className="admin-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Building2 size={20} />
            </div>
            <div>
              <div className="sidebar-brand-title">DMC Portal</div>
              <div className="sidebar-brand-sub">Admin Workspace</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setTab(item.key);
                    if (item.key === 'records' && allRecs.length === 0) loadRecs(recMonth);
                  }}
                >
                  <div className="nav-item-icon">
                    <Icon size={18} />
                  </div>
                  <div className="nav-item-text">
                    <span className="nav-item-title">{item.label}</span>
                    <span className="nav-item-sub">{item.sub}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`nav-item-badge ${item.badgeColor === 'green' ? 'badge-green' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <button
              className="btn btn-primary w-full"
              onClick={() => setShowModal(true)}
            >
              <Plus size={16} />
              <span>Add Staff</span>
            </button>
            <div className="sidebar-status-box">
              <span className="status-dot-pulse" />
              <span>System operational</span>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <main className="admin-main-content">
          {/* Mobile Tab Pills */}
          <div className="mobile-nav-tabs">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = tab === item.key;
              return (
                <button
                  key={item.key}
                  className={`mobile-tab-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setTab(item.key);
                    if (item.key === 'records' && allRecs.length === 0) loadRecs(recMonth);
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="mobile-tab-badge">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="admin-view-content"
          >
            {/* Top Bar with Breadcrumbs & Action Button */}
            <motion.div className="dashboard-top-bar" variants={fadeUp}>
              <div>
                <h2 className="dashboard-title">
                  {tab === 'staff' && 'Employee Directory'}
                  {tab === 'today' && "Today's Attendance"}
                  {tab === 'records' && 'Attendance Logs & History'}
                  {tab === 'salary' && 'Salary & Payroll Management'}
                </h2>
                <p className="dashboard-subtitle">
                  {tab === 'staff' && 'Manage registered staff members and credentials'}
                  {tab === 'today' && `Live status for ${new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
                  {tab === 'records' && 'Complete daily audit logs for check-ins and check-outs'}
                  {tab === 'salary' && `Calculated compensation for ${salMonthLabel}`}
                </p>
              </div>

              <div className="dashboard-actions">
                {tab === 'salary' && (
                  <button className="btn btn-outline" onClick={downloadCSV}>
                    <Download size={15} />
                    <span>Export CSV</span>
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={16} />
                  <span>Add Staff</span>
                </button>
              </div>
            </motion.div>

            {/* ── 4 Shadcn-Style KPI Metric Cards ── */}
            <motion.div className="metrics-grid" variants={fadeUp}>
              <MagicCard className="metric-card metric-navy" gradientColor="rgba(30, 74, 122, 0.22)">
                <div className="metric-header">
                  <span className="metric-label">Total Staff</span>
                  <div className="metric-icon-wrap icon-navy">
                    <Users size={17} />
                  </div>
                </div>
                <div className="metric-body">
                  <div className="metric-value">
                    <AnimatedNumber value={allStaff.length} />
                  </div>
                  <div className="metric-trend trend-neutral">
                    <Building2 size={13} />
                    <span>Registered in DMC</span>
                  </div>
                </div>
              </MagicCard>

              <MagicCard className="metric-card metric-green" gradientColor="rgba(22, 163, 74, 0.22)">
                <div className="metric-header">
                  <span className="metric-label">Present Today</span>
                  <div className="metric-icon-wrap icon-green">
                    <CheckCircle2 size={17} />
                  </div>
                </div>
                <div className="metric-body">
                  <div className="metric-value">
                    <AnimatedNumber value={todayRecs.length} />
                  </div>
                  <div className="metric-trend trend-up">
                    <TrendingUp size={13} />
                    <span>{presentPercentage}% attendance</span>
                  </div>
                </div>
              </MagicCard>

              <MagicCard className="metric-card metric-saff" gradientColor="rgba(232, 118, 26, 0.22)">
                <div className="metric-header">
                  <span className="metric-label">Full Shifts (8h+)</span>
                  <div className="metric-icon-wrap icon-saff">
                    <Clock size={17} />
                  </div>
                </div>
                <div className="metric-body">
                  <div className="metric-value">
                    <AnimatedNumber value={totalFull} />
                  </div>
                  <div className="metric-trend trend-neutral">
                    <span>This month completed</span>
                  </div>
                </div>
              </MagicCard>

              <MagicCard className="metric-card metric-blue" gradientColor="rgba(29, 78, 216, 0.22)">
                <div className="metric-header">
                  <span className="metric-label">Salary Payable</span>
                  <div className="metric-icon-wrap icon-blue">
                    <IndianRupee size={17} />
                  </div>
                </div>
                <div className="metric-body">
                  <div className="metric-value">
                    <AnimatedNumber value={totalPay} prefix="₹" decimals={0} />
                  </div>
                  <div className="metric-trend trend-neutral">
                    <span>{salMonthLabel}</span>
                  </div>
                </div>
              </MagicCard>
            </motion.div>

            {/* ── Attendance Trends Area Chart ── */}
            {chartData.length > 1 && (
              <motion.div variants={fadeUp} className="chart-section">
                <AttendanceChart
                  data={chartData}
                  title="Attendance & Work Hours Trend"
                  subtitle="Daily active staff and total hours recorded"
                />
              </motion.div>
            )}

            {/* ── Tab Panels Content ── */}
            <AnimatePresence mode="wait">
              {/* 1. Staff Directory Tab */}
              {tab === 'staff' && (
                <motion.div key="staff" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header">
                    <div>
                      <h3 className="panel-card-title">Staff Members</h3>
                      <p className="panel-card-subtitle">Active municipal sanitation & field staff</p>
                    </div>
                    <div className="panel-search-wrap">
                      <Search size={15} className="search-icon" />
                      <input
                        className="panel-search-input"
                        placeholder="Search employee name or ID..."
                        value={staffSearch}
                        onChange={e => setStaffSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>ID / Code</th>
                          <th>Today's Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={4}>
                              <div className="empty-state">
                                <Users size={32} className="empty-icon" />
                                <p>No staff members found matching "{staffSearch}"</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredStaff.map(s => {
                          const isPresent = todayRecs.some(r => r.staff_user_id === s.user_id);
                          return (
                            <tr key={s.id}>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar">{getInitials(s.name)}</div>
                                  <div>
                                    <div className="user-name">{s.name}</div>
                                    <div className="user-meta">Sanitation Staff</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="id-badge">{s.emp_id}</span>
                              </td>
                              <td>
                                {isPresent ? (
                                  <span className="status-badge badge-success">
                                    <span className="badge-dot" /> Present Today
                                  </span>
                                ) : (
                                  <span className="status-badge badge-neutral">
                                    Absent
                                  </span>
                                )}
                              </td>
                              <td className="text-right">
                                <button
                                  className="btn-icon-danger"
                                  onClick={() => removeStaff(s.id, s.name)}
                                  title={`Deactivate ${s.name}`}
                                >
                                  <Trash2 size={15} />
                                  <span className="btn-icon-label">Deactivate</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* 2. Today's Attendance Tab */}
              {tab === 'today' && (
                <motion.div key="today" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header">
                    <div>
                      <h3 className="panel-card-title">Today's Live Shifts</h3>
                      <p className="panel-card-subtitle">Real-time check-ins and completed shifts</p>
                    </div>
                    <div className="date-chip">
                      <Calendar size={14} />
                      <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Total Hours</th>
                          <th>Status</th>
                          <th className="text-right">Compensation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayRecs.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={6}>
                              <div className="empty-state">
                                <Clock size={32} className="empty-icon" />
                                <p>No check-in records logged yet today.</p>
                              </div>
                            </td>
                          </tr>
                        ) : todayRecs.map(r => {
                          const h = hrs(r.in_time, r.out_time);
                          const st = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
                          const badgeCls = !r.out_time ? 'badge-warning' : h >= 8 ? 'badge-success' : 'badge-amber';
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar">{(r.staff_name || '?')[0].toUpperCase()}</div>
                                  <div>
                                    <div className="user-name">{r.staff_name}</div>
                                    <div className="user-meta">{r.emp_id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="font-mono">{fmtT(r.in_time)}</td>
                              <td className="font-mono">{fmtT(r.out_time)}</td>
                              <td>{r.out_time ? `${h.toFixed(2)}h` : '—'}</td>
                              <td>
                                <span className={`status-badge ${badgeCls}`}>
                                  <span className="badge-dot" /> {st}
                                </span>
                              </td>
                              <td className="text-right font-semibold text-emerald">
                                {r.out_time ? money(pay(h)) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Absent Staff Section */}
                  <div className="absent-card">
                    <div className="absent-card-header">
                      <div className="absent-card-title">
                        <UserX size={16} />
                        <span>Not Present Today ({absentStaff.length})</span>
                      </div>
                    </div>
                    <div className="absent-card-body">
                      {absentStaff.length === 0 ? (
                        <div className="all-present-msg">
                          <CheckCircle2 size={16} />
                          <span>100% staff attendance today!</span>
                        </div>
                      ) : (
                        <div className="absent-chips-grid">
                          {absentStaff.map(s => (
                            <div key={s.id} className="absent-chip">
                              <span className="absent-avatar">{getInitials(s.name)}</span>
                              <span className="absent-name">{s.name}</span>
                              <span className="absent-id">{s.emp_id}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 3. Records Tab */}
              {tab === 'records' && (
                <motion.div key="records" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header flex-wrap">
                    <div>
                      <h3 className="panel-card-title">Attendance Logs</h3>
                      <p className="panel-card-subtitle">Historical check-in/out records</p>
                    </div>
                    <div className="filters-row">
                      <div className="panel-search-wrap">
                        <Search size={15} className="search-icon" />
                        <input
                          className="panel-search-input"
                          placeholder="Search employee..."
                          value={recSearch}
                          onChange={e => setRecSearch(e.target.value)}
                        />
                      </div>
                      <select
                        className="select-input"
                        value={recMonth}
                        onChange={e => setRecMonth(e.target.value)}
                      >
                        {MONTHS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <select
                        className="select-input"
                        value={recStatus}
                        onChange={e => setRecStatus(e.target.value)}
                      >
                        <option value="">All Shifts</option>
                        <option>Full Shift</option>
                        <option>Short Shift</option>
                        <option>On Duty</option>
                      </select>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>In Time</th>
                          <th>Out Time</th>
                          <th>Hours</th>
                          <th>Shift Status</th>
                          <th className="text-right">Earned</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecs.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={7}>
                              <div className="empty-state">
                                <ClipboardList size={32} className="empty-icon" />
                                <p>No records found for the selected filter criteria.</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredRecs.map(r => {
                          const h = hrs(r.in_time, r.out_time);
                          const st = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
                          const badgeCls = !r.out_time ? 'badge-warning' : h >= 8 ? 'badge-success' : 'badge-amber';
                          const isToday = r.date === todayIST();
                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="date-cell">
                                  <span>{r.date}</span>
                                  {isToday && <span className="today-badge">Today</span>}
                                </div>
                              </td>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar">{(r.staff_name || '?')[0].toUpperCase()}</div>
                                  <div>
                                    <div className="user-name">{r.staff_name}</div>
                                    <div className="user-meta">{r.emp_id}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="font-mono">{fmtT(r.in_time)}</td>
                              <td className="font-mono">{fmtT(r.out_time)}</td>
                              <td>{r.out_time ? `${h.toFixed(2)}h` : '—'}</td>
                              <td>
                                <span className={`status-badge ${badgeCls}`}>
                                  <span className="badge-dot" /> {st}
                                </span>
                              </td>
                              <td className="text-right font-semibold text-emerald">
                                {r.out_time ? money(pay(h)) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}

              {/* 4. Salary & Payroll Tab */}
              {tab === 'salary' && (
                <motion.div key="salary" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header flex-wrap">
                    <div>
                      <h3 className="panel-card-title">Salary & Payroll</h3>
                      <p className="panel-card-subtitle">Monthly calculated wages based on verified shifts</p>
                    </div>
                    <div className="filters-row">
                      <select
                        className="select-input"
                        value={salMonth}
                        onChange={e => setSalMonth(e.target.value)}
                      >
                        {MONTHS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <button className="btn btn-outline" onClick={downloadCSV}>
                        <FileSpreadsheet size={15} />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="salary-summary-grid">
                    <div className="sal-stat-item">
                      <span className="sal-stat-label">Active Staff</span>
                      <span className="sal-stat-val"><AnimatedNumber value={allStaff.length} /></span>
                    </div>
                    <div className="sal-stat-item">
                      <span className="sal-stat-label">Full Shifts (8h)</span>
                      <span className="sal-stat-val"><AnimatedNumber value={salTotF} /></span>
                    </div>
                    <div className="sal-stat-item">
                      <span className="sal-stat-label">Total Hours</span>
                      <span className="sal-stat-val"><AnimatedNumber value={salTotH} suffix="h" decimals={1} /></span>
                    </div>
                    <div className="sal-stat-item highlight">
                      <span className="sal-stat-label">Total Payroll</span>
                      <span className="sal-stat-val"><AnimatedNumber value={salTotPay} prefix="₹" decimals={0} /></span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Emp ID</th>
                          <th>Full Days (₹450)</th>
                          <th>Short Shifts</th>
                          <th>Total Hours</th>
                          <th className="text-right">Net Payable / वेतन</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryRows.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={6}>
                              <div className="empty-state">
                                <IndianRupee size={32} className="empty-icon" />
                                <p>No salary data found for {salMonthLabel}.</p>
                              </div>
                            </td>
                          </tr>
                        ) : salaryRows.map(({ s, totalH, full, sht, total }) => (
                          <tr key={s.id}>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar">{getInitials(s.name)}</div>
                                <div>
                                  <div className="user-name">{s.name}</div>
                                  <div className="user-meta">Sanitation Staff</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="id-badge">{s.emp_id}</span></td>
                            <td><span className="font-semibold text-emerald">{full}</span></td>
                            <td><span className="text-muted">{sht}</span></td>
                            <td>{totalH.toFixed(2)}h</td>
                            <td className="text-right font-bold text-navy text-base">
                              {money(total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
