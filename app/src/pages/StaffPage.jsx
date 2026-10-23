import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, monthIST, hrs, pay, money, fmtT, pad } from '../lib/utils';
import './StaffPage.css';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function StaffPage() {
  const { profile } = useAuth();
  const now = useClock();
  const [todayRec, setTodayRec] = useState(null);
  const [monthRecs, setMonthRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [btnLoading, setBtnLoading] = useState('');

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = now.toLocaleDateString('hi-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isSunday = istNow.getDay() === 0;
  const mins = istNow.getHours() * 60 + istNow.getMinutes();
  const inWindow = mins >= 360 && mins < 481; // 6:00 AM – 8:00 AM
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

  // Status pill
  const statusPill = () => {
    if (isSunday) return { cls: 'pill-gray', text: '🛑 रविवार — अवकाश' };
    if (checkedOut) {
      const h = hrs(todayRec.in_time, todayRec.out_time);
      return { cls: 'pill-ok', text: `✅ Shift complete — ${h.toFixed(2)}h` };
    }
    if (checkedIn) return { cls: 'pill-on', text: '🟠 On Duty — Check out when done' };
    if (!inWindow) return { cls: 'pill-gray', text: '⏰ Entry window closed (6–8 AM only)' };
    return { cls: 'pill-warn', text: '⬤ Window open — Check in now!' };
  };
  const pill = statusPill();

  // Month stats
  const completed = monthRecs.filter(r => r.out_time);
  const totalH   = completed.reduce((a, r) => a + hrs(r.in_time, r.out_time), 0);
  const fullDays  = completed.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const shortDays = completed.filter(r => hrs(r.in_time, r.out_time) < 8).length;
  const earned    = completed.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);

  async function doCheckIn() {
    setBtnLoading('in');
    try {
      const { data, error } = await supabase.rpc('do_check_in', {
        p_emp_id: profile.emp_id, p_staff_name: profile.name,
      });
      if (error) throw error;
      setTodayRec(data);
      await loadData();
      setActionMsg({ type: 'ok', text: '✅ Check-in सफल! उपस्थिति दर्ज हो गई।' });
    } catch (e) {
      setActionMsg({ type: 'err', text: 'Check-in failed: ' + e.message });
    } finally {
      setBtnLoading('');
    }
  }

  async function doCheckOut() {
    if (!todayRec) return;
    setBtnLoading('out');
    try {
      const { data, error } = await supabase.rpc('do_check_out', { p_id: todayRec.id });
      if (error) throw error;
      setTodayRec(data);
      await loadData();
      const h = hrs(data.in_time, data.out_time);
      setActionMsg({ type: 'ok', text: `✅ Check-out complete! ${h.toFixed(2)}h · ${money(pay(h))}` });
    } catch (e) {
      setActionMsg({ type: 'err', text: 'Check-out failed: ' + e.message });
    } finally {
      setBtnLoading('');
    }
  }

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="staff-page">
      <Header title="नगर निगम — उपस्थिति" subtitle="Staff Attendance Portal" />

      {loading ? (
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span>Loading your dashboard...</span>
          </div>
        </div>
      ) : (
        <main className="staff-main">
          {/* Hero card */}
          <div className="hero-card">
            <div className="hero-orb hero-orb1" />
            <div className="hero-orb hero-orb2" />
            <div className="hero-content">
              <div className="hero-name">{profile?.name}</div>
              <div className="hero-empid">Employee ID: {profile?.emp_id}</div>
              <div className="hero-clock">{timeStr}</div>
              <div className="hero-date">{dateStr}</div>
              <span className={`status-pill ${pill.cls}`}>
                <span className="pill-dot" />
                {pill.text}
              </span>
            </div>
          </div>

          {/* Banners */}
          {isSunday && (
            <div className="alert alert-err">
              <span className="alert-icon">🛑</span>
              <div><div className="alert-title">रविवार — साप्ताहिक अवकाश / Sunday Off</div><div>No attendance on Sundays.</div></div>
            </div>
          )}
          {!isSunday && !checkedIn && !checkedOut && !inWindow && (
            <div className="alert alert-warn">
              <span className="alert-icon">⏰</span>
              <div><div className="alert-title">Entry Window Closed</div><div>Check-in is only allowed <strong>6:00 AM – 8:01 AM</strong>.</div></div>
            </div>
          )}
          {actionMsg && (
            <div className={`alert ${actionMsg.type === 'ok' ? 'alert-ok' : 'alert-err'}`}>
              <span className="alert-icon">{actionMsg.type === 'ok' ? '✅' : '❌'}</span>
              <div>{actionMsg.text}</div>
            </div>
          )}
          {checkedIn && !isSunday && (
            <div className="alert alert-info">
              <span className="alert-icon">ℹ️</span>
              <div>{fmtT(todayRec.in_time)} से ड्यूटी पर हैं। Check out करना न भूलें।</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="action-grid">
            <button
              className="action-btn action-btn-in"
              disabled={!canCheckIn || btnLoading === 'in'}
              onClick={doCheckIn}
            >
              {btnLoading === 'in' ? <span className="spinner spinner-sm" /> : <span className="action-icon">✅</span>}
              <span className="action-label">Check In</span>
              <span className="action-sub">उपस्थिति दर्ज करें</span>
            </button>
            <button
              className="action-btn action-btn-out"
              disabled={!canCheckOut || btnLoading === 'out'}
              onClick={doCheckOut}
            >
              {btnLoading === 'out' ? <span className="spinner spinner-sm" /> : <span className="action-icon">🔚</span>}
              <span className="action-label">Check Out</span>
              <span className="action-sub">वापसी दर्ज करें</span>
            </button>
          </div>

          {/* Month stats */}
          <div className="panel month-panel">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">📊</span> इस माह का सारांश</div>
              <span className="panel-label">{monthLabel}</span>
            </div>
            <div className="month-stats">
              <div className="stat-box"><div className="stat-val">{fullDays}</div><div className="stat-lbl">Full Days</div></div>
              <div className="stat-box"><div className="stat-val">{shortDays}</div><div className="stat-lbl">Short Shifts</div></div>
              <div className="stat-box"><div className="stat-val">{totalH.toFixed(1)}h</div><div className="stat-lbl">Total Hours</div></div>
              <div className="stat-box stat-box-green"><div className="stat-val">{money(earned)}</div><div className="stat-lbl">Earned / अर्जित</div></div>
            </div>
          </div>

          {/* Timeline */}
          <div className="panel timeline-panel">
            <div className="panel-hdr">
              <div className="panel-title"><span className="panel-icon">📋</span> Attendance History</div>
            </div>
            {monthRecs.length === 0 ? (
              <div className="empty-state">इस माह कोई उपस्थिति नहीं</div>
            ) : (
              <div className="timeline">
                {monthRecs.map(r => {
                  const h = hrs(r.in_time, r.out_time);
                  const full = h >= 8;
                  const out = !!r.out_time;
                  return (
                    <div className="tl-item" key={r.id}>
                      <div className={`tl-dot ${out && full ? 'tl-dot-ok' : out ? 'tl-dot-warn' : 'tl-dot-blue'}`}>📅</div>
                      <div className="tl-body">
                        <div className="tl-main">
                          {r.date}
                          {!out && <span className="badge badge-blue">On Duty</span>}
                          {out && full && <span className="badge badge-ok">✓ Full Shift</span>}
                          {out && !full && <span className="badge badge-warn">Short Shift</span>}
                        </div>
                        <div className="tl-sub">
                          In: {fmtT(r.in_time)} &nbsp;|&nbsp; Out: {fmtT(r.out_time)}
                          {out && ` · ${h.toFixed(2)}h · ${money(pay(h))}`}
                          {!out && ' — In progress...'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
