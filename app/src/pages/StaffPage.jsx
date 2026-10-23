import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import Meteors from '../components/Meteors';
import ShimmerButton from '../components/ShimmerButton';
import MagicCard from '../components/MagicCard';
import BorderBeam from '../components/BorderBeam';
import GradientText from '../components/GradientText';
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

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
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
  const inWindow = mins >= 360 && mins < 481;
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

  const statusPill = () => {
    if (isSunday) return { cls: 'pill-gray', text: '🛑 Sunday Off', sub: 'साप्ताहिक अवकाश' };
    if (checkedOut) {
      const h = hrs(todayRec.in_time, todayRec.out_time);
      return { cls: 'pill-ok', text: `✅ ${h.toFixed(2)}h Done`, sub: 'Shift complete' };
    }
    if (checkedIn) return { cls: 'pill-on', text: '🟠 On Duty', sub: `Since ${fmtT(todayRec.in_time)}` };
    if (!inWindow) return { cls: 'pill-gray', text: '⏰ Closed', sub: '6:00 – 8:00 AM only' };
    return { cls: 'pill-warn', text: '🟢 Window Open!', sub: 'Check in now' };
  };
  const pill = statusPill();

  const completed = monthRecs.filter(r => r.out_time);
  const totalH   = completed.reduce((a, r) => a + hrs(r.in_time, r.out_time), 0);
  const fullDays  = completed.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const shortDays = completed.filter(r => hrs(r.in_time, r.out_time) < 8).length;
  const earned    = completed.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);

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
      toast.success('✅ Check-in successful!', { id: tId });
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
      const h = hrs(data.in_time, data.out_time);
      toast.success(`✅ ${h.toFixed(2)}h · ${money(pay(h))} earned`, { id: tId });
    } catch (e) {
      toast.error('Check-out failed: ' + e.message, { id: tId });
    } finally {
      setBtnLoading('');
    }
  }

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="staff-page">
        <Header title="नगर निगम — उपस्थिति" subtitle="Staff Attendance Portal" />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <Header title="नगर निगम — उपस्थिति" subtitle="Staff Attendance Portal" />

      <motion.main
        className="staff-main"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >

        {/* ── Hero Card with Meteors ── */}
        <motion.div variants={fadeUp}>
          <BorderBeam
            className="hero-beam-wrap"
            colorFrom="#e8761a"
            colorTo="#1e4a7a"
            duration={8}
          >
            <div className="hero-card">
              <Meteors count={12} />
              <div className="hero-orb hero-orb1" />
              <div className="hero-orb hero-orb2" />

              <div className="hero-content">
                <div className="hero-top-row">
                  <div>
                    <div className="hero-name">{profile?.name}</div>
                    <div className="hero-empid">EMP · {profile?.emp_id}</div>
                  </div>
                  <div className="hero-badge-wrap">
                    <span className={`status-pill ${pill.cls}`}>
                      <span className="pill-dot" />
                      {pill.text}
                    </span>
                    <div className="pill-sub">{pill.sub}</div>
                  </div>
                </div>

                <div className="hero-clock-row">
                  <div className="hero-clock">{timeStr}</div>
                  <div className="hero-date">{dateStr}</div>
                </div>
              </div>
            </div>
          </BorderBeam>
        </motion.div>

        {/* ── Banners ── */}
        <AnimatePresence>
          {isSunday && (
            <motion.div key="sun" className="alert alert-warn" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <span className="alert-icon">🛑</span>
              <div><div className="alert-title">रविवार — साप्ताहिक अवकाश</div><div>Enjoy your day off!</div></div>
            </motion.div>
          )}
          {!isSunday && !checkedIn && !checkedOut && !inWindow && (
            <motion.div key="win" className="alert alert-info" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <span className="alert-icon">⏰</span>
              <div><div className="alert-title">Entry Window Closed</div><div>Check-in only between <strong>6:00 AM – 8:00 AM</strong>.</div></div>
            </motion.div>
          )}
          {checkedIn && (
            <motion.div key="duty" className="alert alert-info" variants={fadeUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}>
              <span className="alert-icon">🔵</span>
              <div>ड्यूटी पर: {fmtT(todayRec.in_time)} से। Check out करना न भूलें।</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Shimmer Action Buttons ── */}
        <motion.div className="action-grid" variants={fadeUp}>
          <ShimmerButton
            disabled={!canCheckIn || btnLoading === 'in'}
            onClick={doCheckIn}
            background="linear-gradient(145deg, #0f7a36, #15803d)"
            shadow="0 8px 28px rgba(21,128,61,0.4)"
            shimmerColor="rgba(255,255,255,0.35)"
          >
            {btnLoading === 'in'
              ? <span className="spinner spinner-sm" />
              : <span className="action-icon">🟢</span>
            }
            <span className="action-label">Check In</span>
            <span className="action-sub">उपस्थिति दर्ज करें</span>
          </ShimmerButton>

          <ShimmerButton
            disabled={!canCheckOut || btnLoading === 'out'}
            onClick={doCheckOut}
            background="linear-gradient(145deg, #b55509, #d97706)"
            shadow="0 8px 28px rgba(217,119,6,0.4)"
            shimmerColor="rgba(255,255,255,0.35)"
          >
            {btnLoading === 'out'
              ? <span className="spinner spinner-sm" />
              : <span className="action-icon">🔴</span>
            }
            <span className="action-label">Check Out</span>
            <span className="action-sub">वापसी दर्ज करें</span>
          </ShimmerButton>
        </motion.div>

        {/* ── Month Stats with MagicCard ── */}
        <motion.div variants={fadeUp}>
          <MagicCard className="panel" gradientColor="rgba(30,74,122,0.12)">
            <div className="panel-hdr">
              <div className="panel-title">
                <span className="panel-icon">📊</span>
                <GradientText colors={['#0b1f38', '#1e4a7a', '#138808', '#0b1f38']}>
                  Monthly Summary
                </GradientText>
              </div>
              <span className="panel-label">{monthLabel}</span>
            </div>
            <div className="month-stats">
              <div className="stat-box">
                <div className="stat-val"><AnimatedNumber value={fullDays} /></div>
                <div className="stat-lbl">Full Days</div>
              </div>
              <div className="stat-box">
                <div className="stat-val"><AnimatedNumber value={shortDays} /></div>
                <div className="stat-lbl">Short Shifts</div>
              </div>
              <div className="stat-box">
                <div className="stat-val"><AnimatedNumber value={totalH} suffix="h" decimals={1} /></div>
                <div className="stat-lbl">Total Hours</div>
              </div>
              <div className="stat-box stat-box-green">
                <div className="stat-val"><AnimatedNumber value={earned} prefix="₹" decimals={0} /></div>
                <div className="stat-lbl">Earned / अर्जित</div>
              </div>
            </div>
          </MagicCard>
        </motion.div>

        {/* ── Timeline ── */}
        <motion.div variants={fadeUp}>
          <MagicCard className="panel" gradientColor="rgba(19,136,8,0.08)">
            <div className="panel-hdr">
              <div className="panel-title">
                <span className="panel-icon">📋</span>
                Attendance History
              </div>
              <span className="panel-label">{monthRecs.length} records</span>
            </div>

            {monthRecs.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📭</div>
                <div>इस माह कोई उपस्थिति नहीं</div>
              </div>
            ) : (
              <div className="timeline">
                {monthRecs.map((r, i) => {
                  const h = hrs(r.in_time, r.out_time);
                  const full = h >= 8;
                  const out = !!r.out_time;
                  return (
                    <motion.div
                      key={r.id}
                      className="tl-item"
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.35 }}
                    >
                      <div className={`tl-dot ${out && full ? 'tl-dot-ok' : out ? 'tl-dot-warn' : 'tl-dot-blue'}`}>
                        {out && full ? '✅' : out ? '⚡' : '🔵'}
                      </div>
                      <div className="tl-body">
                        <div className="tl-main">
                          {r.date}
                          {!out && <span className="badge badge-blue">On Duty</span>}
                          {out && full && <span className="badge badge-ok">✓ Full</span>}
                          {out && !full && <span className="badge badge-warn">Short</span>}
                        </div>
                        <div className="tl-sub">
                          In: {fmtT(r.in_time)} &nbsp;|&nbsp; Out: {fmtT(r.out_time)}
                          {out && ` · ${h.toFixed(2)}h · ${money(pay(h))}`}
                          {!out && ' — In progress...'}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </MagicCard>
        </motion.div>

      </motion.main>
    </div>
  );
}
