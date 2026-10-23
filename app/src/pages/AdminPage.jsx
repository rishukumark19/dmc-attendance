import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import MagicCard from '../components/MagicCard';
import GradientText from '../components/GradientText';
import BorderBeam from '../components/BorderBeam';
import { useAuth } from '../context/AuthContext';
import { supabase, makeTempClient } from '../lib/supabase';
import { todayIST, hrs, pay, money, fmtT, getInitials, fillMonths, pad } from '../lib/utils';
import './AdminPage.css';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

const MONTHS = fillMonths(12);

// ──────────────────────────────────────────────
// Add Staff Modal
// ──────────────────────────────────────────────
function AddStaffModal({ onClose, onAdded, existingIds }) {
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleSave() {
    const n = name.trim(), id = empId.trim().toUpperCase(), p = pin.trim();
    if (!n || !id || !p) { setMsg({ type: 'err', text: '⚠️ Please fill all fields.' }); return; }
    if (p.length < 4)   { setMsg({ type: 'err', text: '⚠️ PIN must be at least 4 digits.' }); return; }
    if (existingIds.includes(id)) { setMsg({ type: 'err', text: '⚠️ Employee ID already exists!' }); return; }

    setLoading(true);
    try {
      const email = `${id.toLowerCase()}@dmc.org`;
      const tmp = makeTempClient();
      const { data: signUpData, error: signUpErr } = await tmp.auth.signUp({ email, password: p });
      if (signUpErr) throw signUpErr;
      const newUid = signUpData.user?.id;
      if (!newUid) throw new Error('Could not create user. Disable "Confirm email" in Supabase Auth settings.');
      const { error: dbErr } = await supabase.from('staff').insert({ user_id: newUid, name: n, emp_id: id, role: 'staff', active: true });
      if (dbErr) throw dbErr;
      setMsg({ type: 'ok', text: `✅ ${n} added successfully!` });
      setTimeout(() => { onAdded(); onClose(); }, 1500);
    } catch (e) {
      setMsg({ type: 'err', text: '❌ ' + e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <h3>➕ Add New Staff / नया कर्मचारी</h3>
        <div className="hint-box">💡 Staff can log in using their <strong>Employee ID</strong> and <strong>PIN</strong> on the main login page.</div>
        <div className="form-group">
          <label className="form-label">Full Name / पूरा नाम</label>
          <input className="form-input" placeholder="e.g. Ramesh Kumar" maxLength={80} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Employee ID / कर्मचारी क्रमांक</label>
          <input className="form-input" placeholder="e.g. EMP001" maxLength={20} value={empId} onChange={e => setEmpId(e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label className="form-label">Login PIN (4–8 digits) / लॉगिन पिन</label>
          <input className="form-input" placeholder="e.g. 1234" maxLength={8} inputMode="numeric" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,''))} />
        </div>
        {msg && <div className={`modal-msg ${msg.type === 'ok' ? 'modal-msg-ok' : 'modal-msg-err'}`}>{msg.text}</div>}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" onClick={handleSave} disabled={loading}>
            {loading && <span className="spinner spinner-sm" />}
            {loading ? 'Creating...' : 'Save Staff'}
          </button>
        </div>
      </div>
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
    if (!confirm(`Remove ${name}? Their attendance history will remain.`)) return;
    const { error } = await supabase.from('staff').update({ active: false }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
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
    a.download = `dmc-salary-${salMonth}.csv`; a.click();
  }

  // ── Stats ──
  const salCompleted = salRecs.filter(r => r.out_time);
  const totalFull = salCompleted.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const totalPay  = salCompleted.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);
  const salMonthLabel = new Date(salMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

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
        <Header title="नगर निगम — Admin Dashboard" subtitle="Attendance & Salary Management" />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  const tabPanelVariant = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  return (
    <div className="admin-page">
      <Header title="नगर निगम — Admin Dashboard" subtitle="Attendance & Salary Management" />

      <AnimatePresence>
        {showModal && (
          <AddStaffModal
            onClose={() => setShowModal(false)}
            onAdded={() => { loadStaff(); loadToday(); }}
            existingIds={allStaff.map(s => s.emp_id?.toUpperCase())}
          />
        )}
      </AnimatePresence>

      <motion.main
        className="admin-main"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        {/* ── Neumorphic Stat Cards ── */}
        <motion.div className="stats-grid" variants={fadeUp}>
          <MagicCard className="stat-card stat-navy" gradientColor="rgba(20,51,90,0.2)">
            <span className="sc-icon">👥</span>
            <div className="sc-lbl">Total Staff</div>
            <div className="sc-val"><AnimatedNumber value={allStaff.length} /></div>
            <div className="sc-sub">Registered employees</div>
          </MagicCard>
          <MagicCard className="stat-card stat-green" gradientColor="rgba(21,128,61,0.2)">
            <span className="sc-icon">✅</span>
            <div className="sc-lbl">Today Present</div>
            <div className="sc-val"><AnimatedNumber value={todayRecs.length} /></div>
            <div className="sc-sub">{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
          </MagicCard>
          <MagicCard className="stat-card stat-saff" gradientColor="rgba(232,118,26,0.2)">
            <span className="sc-icon">⏱️</span>
            <div className="sc-lbl">Full Shifts</div>
            <div className="sc-val"><AnimatedNumber value={totalFull} /></div>
            <div className="sc-sub">This month</div>
          </MagicCard>
          <MagicCard className="stat-card stat-blue" gradientColor="rgba(29,78,216,0.2)">
            <span className="sc-icon">💰</span>
            <div className="sc-lbl">Salary Payable</div>
            <div className="sc-val sc-val-sm"><AnimatedNumber value={totalPay} prefix="₹" decimals={0} /></div>
            <div className="sc-sub">{salMonthLabel}</div>
          </MagicCard>
        </motion.div>


        {/* ── Tabs ── */}
        <motion.div className="admin-tabs" variants={fadeUp}>
          {[
            { key: 'staff',   label: '👥 Staff' },
            { key: 'today',   label: '📅 Today' },
            { key: 'records', label: '📋 Records' },
            { key: 'salary',  label: '💰 Salary' },
          ].map(t => (
            <button
              key={t.key}
              className={`admin-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => {
                setTab(t.key);
                if (t.key === 'records' && allRecs.length === 0) loadRecs(recMonth);
              }}
            >{t.label}</button>
          ))}
        </motion.div>

        {/* ── Tab panels ── */}
        <AnimatePresence mode="wait">

        {/* Staff tab */}
        {tab === 'staff' && (
          <motion.div key="staff" className="panel" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">👥</span> All Staff / सभी कर्मचारी</div>
              <button className="btn btn-navy btn-sm" onClick={() => setShowModal(true)}>+ Add Staff</button>
            </div>
            <div className="filter-bar">
              <input className="filter-input" placeholder="🔍 Search name or ID..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
            </div>
            <div className="tbl-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>ID</th><th>Today</th><th>Action</th></tr></thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr className="empty-row"><td colSpan={4}>No staff found</td></tr>
                  ) : filteredStaff.map(s => (
                    <tr key={s.id}>
                      <td><div className="staff-cell">
                        <div className="staff-avatar">{getInitials(s.name)}</div>
                        <div><div className="staff-name">{s.name}</div></div>
                      </div></td>
                      <td><span className="code-pill">{s.emp_id}</span></td>
                      <td>{todayRecs.some(r => r.staff_user_id === s.user_id)
                        ? <span className="badge badge-ok">✅ Present</span>
                        : <span className="badge badge-gray">Absent</span>}
                      </td>
                      <td><button className="btn-delete" onClick={() => removeStaff(s.id, s.name)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Today tab */}
        {tab === 'today' && (
          <motion.div key="today" className="panel" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">📅</span> Today's Attendance</div>
              <span className="panel-label">{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="tbl-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Status</th><th>Earned</th></tr></thead>
                <tbody>
                  {todayRecs.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>No attendance yet today</td></tr>
                  ) : todayRecs.map(r => {
                    const h = hrs(r.in_time, r.out_time);
                    const st = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
                    const bc = !r.out_time ? 'badge-blue' : h >= 8 ? 'badge-ok' : 'badge-warn';
                    return (
                      <tr key={r.id}>
                        <td><div className="staff-cell">
                          <div className="staff-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>{(r.staff_name||'?')[0].toUpperCase()}</div>
                          <div><div className="staff-name">{r.staff_name}</div><div className="staff-id">{r.emp_id}</div></div>
                        </div></td>
                        <td>{fmtT(r.in_time)}</td>
                        <td>{fmtT(r.out_time)}</td>
                        <td>{r.out_time ? h.toFixed(2)+'h' : '—'}</td>
                        <td><span className={`badge ${bc}`}>{st}</span></td>
                        <td className="sal-val">{r.out_time ? money(pay(h)) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="absent-section">
              <div className="absent-section-title">❌ Not Present Today</div>
              <div className="absent-list">
                {absentStaff.length === 0
                  ? <span className="empty-text">🎉 All staff are present!</span>
                  : absentStaff.map(s => (
                    <div key={s.id} className="absent-pill">
                      <div className="absent-av">{getInitials(s.name)}</div>
                      <span>{s.name}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </motion.div>
        )}

        {/* Records tab */}
        {tab === 'records' && (
          <motion.div key="records" className="panel" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">📋</span> Attendance Records</div>
            </div>
            <div className="filter-bar">
              <input className="filter-input" placeholder="🔍 Search staff..." value={recSearch} onChange={e => setRecSearch(e.target.value)} />
              <select className="filter-input" value={recMonth} onChange={e => setRecMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className="filter-input" value={recStatus} onChange={e => setRecStatus(e.target.value)}>
                <option value="">All Status</option>
                <option>Full Shift</option><option>Short Shift</option><option>On Duty</option>
              </select>
            </div>
            <div className="tbl-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Employee</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Earned</th></tr></thead>
                <tbody>
                  {filteredRecs.length === 0 ? (
                    <tr className="empty-row"><td colSpan={7}>No records found</td></tr>
                  ) : filteredRecs.map(r => {
                    const h = hrs(r.in_time, r.out_time);
                    const st = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
                    const bc = !r.out_time ? 'badge-blue' : h >= 8 ? 'badge-ok' : 'badge-warn';
                    return (
                      <tr key={r.id}>
                        <td>{r.date}{r.date === todayIST() && <span className="badge badge-blue" style={{ fontSize: '0.6rem', marginLeft: 6 }}>Today</span>}</td>
                        <td><div className="staff-cell">
                          <div className="staff-avatar" style={{ width: 28, height: 28, fontSize: '0.72rem' }}>{(r.staff_name||'?')[0].toUpperCase()}</div>
                          <div><div className="staff-name">{r.staff_name}</div><div className="staff-id">{r.emp_id}</div></div>
                        </div></td>
                        <td>{fmtT(r.in_time)}</td>
                        <td>{fmtT(r.out_time)}</td>
                        <td>{r.out_time ? h.toFixed(2)+'h' : '—'}</td>
                        <td><span className={`badge ${bc}`}>{st}</span></td>
                        <td className="sal-val">{r.out_time ? money(pay(h)) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Salary tab */}
        {tab === 'salary' && (
          <motion.div key="salary" className="panel" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">💰</span> Monthly Salary Report</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="filter-input" value={salMonth} onChange={e => setSalMonth(e.target.value)}>
                  {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button className="btn btn-green btn-sm" onClick={downloadCSV}>⬇ CSV</button>
              </div>
            </div>
            {allStaff.length > 0 && (
              <div className="rep-bar">
                <div className="rb-item"><div className="rb-val"><AnimatedNumber value={allStaff.length} /></div><div className="rb-lbl">Staff</div></div>
                <div className="rb-item"><div className="rb-val"><AnimatedNumber value={salTotF} /></div><div className="rb-lbl">Full Shifts</div></div>
                <div className="rb-item"><div className="rb-val"><AnimatedNumber value={salTotH} suffix="h" decimals={1} /></div><div className="rb-lbl">Total Hours</div></div>
                <div className="rb-item"><div className="rb-val"><AnimatedNumber value={salTotPay} prefix="₹" decimals={0} /></div><div className="rb-lbl">Total Payable</div></div>
              </div>
            )}
            <div className="tbl-wrap">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Emp ID</th><th>Full Days</th><th>Short</th><th>Hours</th><th>Salary / वेतन</th></tr></thead>
                <tbody>
                  {salaryRows.length === 0 ? (
                    <tr className="empty-row"><td colSpan={6}>No data for this month</td></tr>
                  ) : salaryRows.map(({ s, totalH, full, sht, total }) => (
                    <tr key={s.id}>
                      <td><div className="staff-cell">
                        <div className="staff-avatar">{getInitials(s.name)}</div>
                        <div className="staff-name">{s.name}</div>
                      </div></td>
                      <td><span className="code-pill">{s.emp_id}</span></td>
                      <td>{full}</td>
                      <td>{sht}</td>
                      <td>{totalH.toFixed(2)}h</td>
                      <td className="sal-val" style={{ fontSize: '0.92rem' }}>{money(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}


        </AnimatePresence>
      </motion.main>
    </div>
  );
}
