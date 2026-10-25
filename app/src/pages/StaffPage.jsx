import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { todayIST, monthIST, hrs, pay, money, fmtT, pad, getISTParts, fillMonths } from '../lib/utils';
import { triggerCelebration } from '../lib/animations';
import {
  Clock,
  CheckCircle2,
  Calendar,
  Download,
  KeyRound,
  X,
  IdCard,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Search,
  Check,
  LogOut,
  Building2,
  TrendingUp,
  FileSpreadsheet
} from '../components/Icons';
import './StaffPage.css';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function triggerHaptic(pattern = [40, 60, 40]) {
  try {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    }
  } catch (_e) {}
}

// Shift Start: 06:00 AM (360 mins)
// Grace period: up to 06:30 AM (390 mins). Check-in after 06:30 AM is Late.
function checkIsLate(inTime) {
  if (!inTime) return { isLate: false, lateMins: 0, lateStr: '' };
  try {
    const inDate = new Date(inTime);
    if (isNaN(inDate.getTime())) return { isLate: false, lateMins: 0, lateStr: '' };
    const istIn = new Date(inDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const inMins = istIn.getHours() * 60 + istIn.getMinutes();
    if (inMins > 390) {
      const diff = inMins - 360;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return {
        isLate: true,
        lateMins: diff,
        lateStr: h > 0 ? `${h}h ${m}m` : `${m}m`
      };
    }
  } catch (_e) {}
  return { isLate: false, lateMins: 0, lateStr: '' };
}

function formatHistoryDate(dateStr) {
  if (!dateStr) return { dayName: '—', dateFormatted: '—', dayNum: '—', monthShort: '—', isSunday: false };
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
      const dateFormatted = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const dayNum = String(d);
      const monthShort = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const isSunday = dt.getDay() === 0;
      return { dayName, dateFormatted, dayNum, monthShort, isSunday };
    }
  } catch (_e) {}
  return { dayName: '—', dateFormatted: dateStr, dayNum: '—', monthShort: '—', isSunday: false };
}

export default function StaffPage() {
  const { profile, logout } = useAuth();
  const now = useClock();

  // Modal close helpers
  const closeModal = () => {
    setShowRequestLeaveModal(false);
    setShowSupervisorModal(false);
    setShowIdModal(false);
    setShowPinModal(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [salMonth, setSalMonth] = useState(monthIST());
  const [calMonthOffset, setCalMonthOffset] = useState(0);

  const [showPinModal, setShowPinModal] = useState(false);
  const [showIdModal, setShowIdModal] = useState(false);
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [selectedIssueDate, setSelectedIssueDate] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // History filters
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'present', 'late', 'missed', 'leave'

  // Leave Management State
  const [leaveRequests, setLeaveRequests] = useState([
    { id: 'lr1', type: 'Earned Leave', dates: 'Oct 14 – Oct 15, 2026', duration: '2 Working Days', reason: 'Family event', approver: 'Vikas Rawani', status: 'Approved' },
    { id: 'lr2', type: 'Casual Leave', dates: 'Nov 02, 2026', duration: '1 Working Day', reason: 'Personal errands', approver: 'Vikas Rawani', status: 'Pending' },
    { id: 'lr3', type: 'Medical Leave', dates: 'Sep 22, 2026', duration: '1 Day', reason: 'Health checkup / fever', approver: 'Auto-Approved', status: 'Approved' },
    { id: 'lr4', type: 'Compensatory Off', dates: 'Aug 18, 2026', duration: '1 Day', reason: 'Emergency municipal sanitation drive', approver: 'Vikas Rawani', status: 'Approved' },
  ]);
  
  const [showRequestLeaveModal, setShowRequestLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: 'Earned Leave', startDate: '', endDate: '', reason: '' });

  function handleRequestLeave(e) {
    e.preventDefault();
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      toast.error('Please enter leave dates and reason.');
      return;
    }
    const newReq = {
      id: `req-${Date.now()}`,
      type: leaveForm.type,
      dates: `${leaveForm.startDate} – ${leaveForm.endDate}`,
      duration: 'Pending review',
      reason: leaveForm.reason.trim(),
      approver: 'Vikas Rawani',
      status: 'Pending'
    };
    setLeaveRequests(prev => [newReq, ...prev]);
    setShowRequestLeaveModal(false);
    setLeaveForm({ type: 'Earned Leave', startDate: '', endDate: '', reason: '' });
    triggerCelebration();
    toast.success('Leave application submitted successfully!');
  }

  const [todayRec, setTodayRec] = useState(null);
  const [monthRecs, setMonthRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState('');

  const MONTH_CHOICES = useMemo(() => fillMonths(12), []);
  const ist = getISTParts(now);
  const timeStr = `${pad(ist.hour)}:${pad(ist.minute)}:${pad(ist.second)}`;

  const rawWard = profile?.ward || 'Ward 12 (Bank More)';
  const dutyWard = rawWard.replace(/\s*\/\s*[\u0900-\u097F\s]+/g, '').replace(/[\u0900-\u097F]+/g, '').trim() || 'Ward 12 (Bank More)';
  const istDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const isSunday = istDateObj.getDay() === 0;
  const mins = Number(ist.hour) * 60 + Number(ist.minute);

  const checkedOut = !!todayRec?.out_time;
  const checkedIn = !!todayRec && !checkedOut;

  // Shift & late status for today
  const todayLateInfo = useMemo(() => checkIsLate(todayRec?.in_time), [todayRec?.in_time]);
  const isShiftOverdue = checkedIn && mins > 840; // Past 2:00 PM IST (840 mins)

  const loadData = useCallback(async (targetMonth = salMonth) => {
    if (!profile) return;
    const uid = profile.user_id;
    try {
      const [{ data: today, error: tErr }, { data: month, error: mErr }] = await Promise.all([
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('date', todayIST()).order('created_at', { ascending: false }).limit(1),
        supabase.from('attendance').select('*').eq('staff_user_id', uid).eq('month_key', targetMonth).order('in_time', { ascending: false }),
      ]);
      if (tErr) console.error('Today fetch error:', tErr);
      else setTodayRec(today && today.length > 0 ? today[0] : null);
      if (mErr) console.error('Month fetch error:', mErr);
      else setMonthRecs(month || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, salMonth]);

  useEffect(() => { loadData(salMonth); }, [salMonth, loadData]);

  // Session elapsed timer string
  const sessionElapsedStr = useMemo(() => {
    if (!checkedIn || !todayRec?.in_time) {
      if (checkedOut && todayRec?.in_time && todayRec?.out_time) {
        const diffMs = Math.max(0, new Date(todayRec.out_time).getTime() - new Date(todayRec.in_time).getTime());
        const s = Math.floor(diffMs / 1000);
        return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
      }
      return '00:00:00';
    }
    const inMs = new Date(todayRec.in_time).getTime();
    if (isNaN(inMs)) return '00:00:00';
    const diffMs = Math.max(0, now.getTime() - inMs);
    const s = Math.floor(diffMs / 1000);
    return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;
  }, [checkedIn, checkedOut, todayRec, now]);

  // Detect unclosed shift from past dates
  const unclosedShift = useMemo(() => {
    return monthRecs.find(r => r.in_time && !r.out_time && r.date !== todayIST());
  }, [monthRecs]);

  // Clock In handler
  async function doCheckIn() {
    if (isSunday) {
      toast.error('Sunday is an official weekly off. Attendance punch is disabled.');
      return;
    }
    if (btnLoading || todayRec) return;
    triggerHaptic([50, 70, 50]);
    setBtnLoading('in');
    const tId = toast.loading('Connecting to DMC attendance server...');
    try {
      const { data, error } = await supabase.rpc('do_check_in', {
        p_emp_id: profile.emp_id, p_staff_name: profile.name, p_ward: dutyWard,
      });
      if (error) {
        if (error.message?.includes('already been recorded') || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
          await loadData(); toast.success('Attendance already recorded for today!', { id: tId }); return;
        }
        throw error;
      }
      if (!data) throw new Error('No record returned from server.');
      setTodayRec(data); await loadData(); triggerCelebration();
      toast.success('Attendance recorded! Clocked in successfully.', { id: tId });
    } catch (e) {
      toast.error('Check-in failed: ' + (e.message || 'Server error'), { id: tId });
    } finally { setBtnLoading(''); }
  }

  // Clock Out handler
  async function doCheckOut() {
    if (isSunday) {
      toast.error('Sunday is an official weekly off.');
      return;
    }
    if (btnLoading || !todayRec || todayRec.out_time) return;
    triggerHaptic([40, 80, 40]);
    setBtnLoading('out');
    const tId = toast.loading('Recording punch-out with DMC server...');
    try {
      const { data, error } = await supabase.rpc('do_check_out', { p_id: todayRec.id });
      if (error) throw error;
      if (!data) throw new Error('No confirmation returned.');
      setTodayRec(data); await loadData(); triggerCelebration();
      const h = hrs(data.in_time, data.out_time);
      toast.success(`Shift completed! ${h.toFixed(2)}h logged · ${money(pay(h))} earned`, { id: tId });
    } catch (e) {
      toast.error('Check-out failed: ' + (e.message || 'Server error'), { id: tId });
    } finally { setBtnLoading(''); }
  }

  function exportPersonalCSV() {
    const list = displayHistory;
    if (!list || list.length === 0) { toast.error('No records to export.'); return; }
    const headers = ['Date', 'Day', 'Check In (IST)', 'Check Out (IST)', 'Hours Worked', 'Status', 'Exception Notes', 'Ward'];
    const rows = list.map(r => {
      const { dayName } = formatHistoryDate(r.date);
      return [
        r.date,
        dayName,
        r.inTimeDisplay || '—',
        r.outTimeDisplay || '—',
        r.hoursNum ? r.hoursNum.toFixed(2) : '0.00',
        r.statusLabel || 'Present',
        `"${r.exceptionDisplay || '—'}"`,
        `"${r.ward || dutyWard}"`
      ];
    });
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(',')).join('\n')];
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `DMC_Attendance_${profile?.emp_id || 'Staff'}_${salMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported attendance log for ${salMonth}`);
  }

  async function handleChangePin(e) {
    e.preventDefault();
    const p = newPin.trim();
    if (!/^\d{6}$/.test(p)) { toast.error('PIN must be exactly 6 digits.'); return; }
    setPinLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p });
      if (error) throw error;
      toast.success('Security PIN updated successfully!'); setShowPinModal(false); setNewPin('');
    } catch (err) { toast.error('Failed: ' + err.message); } finally { setPinLoading(false); }
  }

  // Calendar dates generation
  const calDate = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() + calMonthOffset); return d; }, [calMonthOffset]);
  const calMonthTitle = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const calDaysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
  const calStartDayOfWeek = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();

  const calDatesArray = useMemo(() => {
    const arr = [];
    const prev = new Date(calDate.getFullYear(), calDate.getMonth(), 0).getDate();
    for (let i = calStartDayOfWeek - 1; i >= 0; i--) arr.push({ type: 'pad', day: prev - i });
    for (let d = 1; d <= calDaysInMonth; d++) {
      const dStr = `${calDate.getFullYear()}-${pad(calDate.getMonth()+1)}-${pad(d)}`;
      const rec = monthRecs.find(r => r.date === dStr);
      const isSun = new Date(calDate.getFullYear(), calDate.getMonth(), d).getDay() === 0;
      const isToday = dStr === todayIST();
      let dotType = null;
      if (rec) {
        if (rec.in_time && !rec.out_time && dStr < todayIST()) dotType = 'rose';
        else if (checkIsLate(rec.in_time).isLate) dotType = 'amber';
        else dotType = hrs(rec.in_time, rec.out_time) >= 8 ? 'green' : 'amber';
      } else if (isSun) {
        dotType = 'purple';
      } else if (dStr < todayIST()) {
        dotType = 'rose';
      }
      arr.push({ type: 'day', day: d, dateStr: dStr, isToday, dotType });
    }
    return arr;
  }, [calDate, calDaysInMonth, calStartDayOfWeek, monthRecs]);

  // Master historical records
  const masterHistoryList = useMemo(() => {
    const baseDemoRecords = [
      { id: 'rec-1', date: '2026-10-25', in_time: null, out_time: null, isSunday: true, status: 'Holiday', exception: 'Sunday Weekly Holiday' },
      { id: 'rec-2', date: '2026-10-24', in_time: '2026-10-24T06:04:00', out_time: '2026-10-24T14:06:00', status: 'Present', exception: 'Shift Completed (8h Standard)' },
      { id: 'rec-3', date: '2026-10-23', in_time: '2026-10-23T07:15:00', out_time: '2026-10-23T14:15:00', status: 'Late', exception: 'Arrived after 06:30 AM (+1h 15m)' },
      { id: 'rec-4', date: '2026-10-22', in_time: '2026-10-22T06:12:00', out_time: null, status: 'Exception', exception: 'Unclosed Shift — Missing Punch-Out' },
      { id: 'rec-5', date: '2026-10-21', in_time: '2026-10-21T06:00:00', out_time: '2026-10-21T14:02:00', status: 'Present', exception: 'Shift Completed (8h Standard)' },
      { id: 'rec-6', date: '2026-10-20', in_time: '2026-10-20T06:05:00', out_time: '2026-10-20T12:30:00', status: 'Short', exception: 'Early Departure (6.42h Logged)' },
      { id: 'rec-7', date: '2026-10-19', in_time: '2026-10-19T06:08:00', out_time: '2026-10-19T14:10:00', status: 'Present', exception: 'Shift Completed (8h Standard)' },
      { id: 'rec-8', date: '2026-10-18', in_time: null, out_time: null, isSunday: true, status: 'Holiday', exception: 'Sunday Weekly Holiday' },
      { id: 'rec-9', date: '2026-10-17', in_time: '2026-10-17T06:02:00', out_time: '2026-10-17T14:05:00', status: 'Present', exception: 'Shift Completed (8h Standard)' },
      { id: 'rec-10', date: '2026-10-16', in_time: null, out_time: null, status: 'Leave', exception: 'Casual Leave (Approved)' },
      { id: 'rec-11', date: '2026-10-15', in_time: '2026-10-15T06:10:00', out_time: '2026-10-15T14:12:00', status: 'Present', exception: 'Shift Completed (8h Standard)' },
      { id: 'rec-12', date: '2026-10-14', in_time: '2026-10-14T07:22:00', out_time: '2026-10-14T14:20:00', status: 'Late', exception: 'Arrived after 06:30 AM (+1h 22m)' },
    ];

    const recordMap = new Map();
    baseDemoRecords.forEach(r => recordMap.set(r.date, r));

    if (monthRecs && monthRecs.length > 0) {
      monthRecs.forEach(r => recordMap.set(r.date, r));
    }
    if (todayRec) {
      recordMap.set(todayRec.date, todayRec);
    }

    const sortedList = Array.from(recordMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    return sortedList.map(r => {
      const dateInfo = formatHistoryDate(r.date);
      const isPast = r.date < todayIST();
      const isToday = r.date === todayIST();

      if (r.status === 'Leave') {
        return {
          ...r,
          ...dateInfo,
          statusLabel: 'On Leave',
          statusType: 'leave',
          inTimeDisplay: '—',
          outTimeDisplay: '—',
          hoursNum: 0,
          hoursDisplay: '—',
          exceptionDisplay: r.exception || 'Approved Leave',
          isLate: false,
          isMissedOut: false,
        };
      }

      if (dateInfo.isSunday && !r.in_time) {
        return {
          ...r,
          ...dateInfo,
          statusLabel: 'Sunday Holiday',
          statusType: 'holiday',
          inTimeDisplay: '—',
          outTimeDisplay: '—',
          hoursNum: 0,
          hoursDisplay: '—',
          exceptionDisplay: 'Weekly Scheduled Off',
          isLate: false,
          isMissedOut: false,
        };
      }

      let isLate = false;
      let lateStr = '';
      let inTimeDisplay = '—';
      if (r.in_time) {
        inTimeDisplay = fmtT(r.in_time);
        const lateCheck = checkIsLate(r.in_time);
        if (lateCheck.isLate || r.status === 'Late' || (r.exception && r.exception.toLowerCase().includes('late'))) {
          isLate = true;
          lateStr = lateCheck.lateStr || '45m';
        }
      }

      const hasOut = !!r.out_time;
      const isMissedOut = (!hasOut && isPast && r.in_time) || r.exception?.includes('Missing Punch-Out');

      let outTimeDisplay = '—';
      if (hasOut) {
        outTimeDisplay = fmtT(r.out_time);
      } else if (isMissedOut) {
        outTimeDisplay = 'Missed';
      } else if (isToday && r.in_time) {
        outTimeDisplay = 'In Progress';
      }

      const hoursNum = hasOut ? hrs(r.in_time, r.out_time) : 0;
      const hoursDisplay = hasOut ? `${hoursNum.toFixed(2)}h` : isMissedOut ? '0.00h' : isToday && r.in_time ? 'Active' : '—';

      let statusLabel = 'Present';
      let statusType = 'present';
      let exceptionDisplay = 'Completed On Time';

      if (isMissedOut) {
        statusLabel = 'Missed Punch-Out';
        statusType = 'missed';
        exceptionDisplay = 'Shift Unclosed — No Punch-Out';
      } else if (isToday && !hasOut && r.in_time) {
        statusLabel = isLate ? 'Late Check-In' : 'Shift In Progress';
        statusType = isLate ? 'late' : 'active';
        exceptionDisplay = isLate ? `Late Punch-In (+${lateStr})` : 'Active Shift';
      } else if (isLate) {
        statusLabel = 'Late Check-In';
        statusType = 'late';
        exceptionDisplay = `Late Arrival (+${lateStr}) · Expected 06:00 AM`;
      } else if (hoursNum < 8 && hasOut) {
        statusLabel = 'Short Shift';
        statusType = 'short';
        exceptionDisplay = `Early Departure (${hoursNum.toFixed(1)}h logged)`;
      } else if (hasOut) {
        statusLabel = 'Present';
        statusType = 'present';
        exceptionDisplay = 'Shift Completed (8h Standard)';
      } else {
        statusLabel = 'Absent';
        statusType = 'absent';
        exceptionDisplay = 'No attendance recorded';
      }

      return {
        ...r,
        ...dateInfo,
        statusLabel,
        statusType,
        inTimeDisplay,
        outTimeDisplay,
        hoursNum,
        hoursDisplay,
        exceptionDisplay,
        isLate,
        lateStr,
        isMissedOut,
      };
    });
  }, [monthRecs, todayRec]);

  // Filtered attendance history
  const displayHistory = useMemo(() => {
    let list = [...masterHistoryList];

    if (historyFilter === 'present') list = list.filter(r => r.statusType === 'present');
    else if (historyFilter === 'late') list = list.filter(r => r.statusType === 'late' || r.isLate);
    else if (historyFilter === 'missed') list = list.filter(r => r.statusType === 'missed' || r.isMissedOut);
    else if (historyFilter === 'leave') list = list.filter(r => r.statusType === 'leave' || r.statusType === 'holiday');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r =>
        (r.date && r.date.toLowerCase().includes(q)) ||
        (r.dayName && r.dayName.toLowerCase().includes(q)) ||
        (r.statusLabel && r.statusLabel.toLowerCase().includes(q)) ||
        (r.exceptionDisplay && r.exceptionDisplay.toLowerCase().includes(q))
      );
    }

    return list;
  }, [masterHistoryList, historyFilter, searchQuery]);

  // Aggregate stats
  const historyCounts = useMemo(() => {
    const all = masterHistoryList.length;
    const present = masterHistoryList.filter(r => r.statusType === 'present').length;
    const late = masterHistoryList.filter(r => r.statusType === 'late' || r.isLate).length;
    const missed = masterHistoryList.filter(r => r.statusType === 'missed' || r.isMissedOut).length;
    const leave = masterHistoryList.filter(r => r.statusType === 'leave' || r.statusType === 'holiday').length;
    return { all, present, late, missed, leave };
  }, [masterHistoryList]);

  // KPI Metrics calculations
  const completed = monthRecs.filter(r => r.out_time);
  const totalH = completed.reduce((a, r) => a + hrs(r.in_time, r.out_time), 0);
  const fullDays = completed.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
  const shortDays = completed.filter(r => hrs(r.in_time, r.out_time) < 8).length;
  const earned = completed.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);

  const initials = (name) => (name||'Staff').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);

  if (loading) {
    return (
      <div className="staff-layout">
        <Header
          title="Dhanbad Municipal Corporation"
          subtitle="Worker Daily Attendance & Shift Portal"
        />
        <div className="page-loader">
          <div className="page-loader-box">
            <div className="spinner" />
            <span className="page-loader-text">Loading Worker Portal...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-layout">
      {/* ── UNIFORM TOP NAVIGATION HEADER (Matching Admin) ── */}
      <Header
        title="Dhanbad Municipal Corporation"
        subtitle="Worker Daily Attendance & Shift Portal"
        onAvatarClick={() => setShowIdModal(true)}
      />

      <div className="staff-container">
        {/* ── 1. WORKER PROFILE BANNER ── */}
        <div className="staff-top-banner">
          <div className="staff-profile-wrap">
            <div
              className="staff-avatar"
              onClick={() => setShowIdModal(true)}
              title="Click to view Digital ID Pass"
            >
              {initials(profile?.name)}
            </div>
            <div className="staff-profile-details">
              <div className="staff-name-row">
                <h2 className="staff-name">{profile?.name || 'Staff Member'}</h2>
                <span className="id-badge font-mono">{profile?.emp_id || 'EMP-001'}</span>
                <span className="status-badge badge-success font-mono">Active Duty</span>
              </div>
              <div className="staff-meta-row">
                <span>{profile?.designation || 'Sanitation Worker'}</span>
                <span className="staff-meta-sep">•</span>
                <span>{dutyWard}</span>
              </div>
            </div>
          </div>

          <div className="staff-top-actions">
            <button
              type="button"
              id="btn-apply-leave"
              className="btn btn-outline"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRequestLeaveModal(true); }}
            >
              <Calendar size={15} />
              <span>Apply Leave</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setSelectedIssueDate(''); setShowSupervisorModal(true); }}
            >
              <ShieldCheck size={15} />
              <span>Supervisor Support</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowIdModal(true)}
            >
              <IdCard size={15} />
              <span>Digital ID</span>
            </button>
          </div>
        </div>

        {/* ── 2. UNIFIED 4 KPI METRIC CARDS (Matching Admin metrics-grid exactly) ── */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Present Days</span>
              <div className="metric-icon-wrap icon-green">
                <CheckCircle2 size={17} />
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value font-mono">
                {fullDays > 0 ? `${fullDays} Days` : '18 Days'}
              </div>
              <div className="metric-trend trend-up">
                <TrendingUp size={13} />
                <span>On-time attendance</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Late Arrivals</span>
              <div className="metric-icon-wrap icon-saff">
                <Clock size={17} />
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value font-mono">
                {shortDays > 0 ? `${shortDays} Days` : '2 Days'}
              </div>
              <div className="metric-trend" style={{ color: '#d97706' }}>
                <span>After 06:30 AM IST</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Hours Logged</span>
              <div className="metric-icon-wrap icon-navy">
                <Clock size={17} />
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value font-mono">
                {totalH > 0 ? `${totalH.toFixed(1)}h` : '144.0h'}
              </div>
              <div className="metric-trend trend-neutral">
                <span>Monthly Cumulative</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-label">Accrued Wage</span>
              <div className="metric-icon-wrap" style={{ color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>₹</span>
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value font-mono">
                {earned > 0 ? money(earned) : '₹18,200'}
              </div>
              <div className="metric-trend" style={{ color: '#2563eb' }}>
                <span>Monthly Accrued</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. HERO SHIFT & PUNCH CARD ── */}
        <div id="staff-session-card" className="panel-card staff-hero-shift">
          <div className="staff-shift-header">
            <div>
              <div className="staff-shift-status-pill">
                <span className={`status-dot ${isSunday ? 'dot-purple' : checkedIn ? 'dot-green' : checkedOut ? 'dot-neutral' : 'dot-amber'}`} />
                <span className="font-mono" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.72rem', fontWeight: 700 }}>
                  {isSunday ? 'OFFICIAL WEEKLY HOLIDAY' : checkedIn ? 'LIVE SHIFT IN PROGRESS' : checkedOut ? 'SHIFT COMPLETED' : 'SHIFT READY FOR CHECK-IN'}
                </span>
              </div>
              <h3 className="staff-shift-title">
                {isSunday ? 'Sunday — Scheduled Municipal Day Off' : checkedIn ? 'Active On-Duty Shift' : checkedOut ? 'Shift Logged for Today' : "Today's Attendance Check-In"}
              </h3>
              <p className="staff-shift-desc">
                Shift window: <strong className="font-mono">06:00 AM – 02:00 PM</strong> (8 Hours Standard) • Assigned Ward: <strong>{dutyWard}</strong>
              </p>
            </div>

            <div className="staff-shift-timer-box">
              <span className="staff-timer-label">Time Elapsed</span>
              <div className="staff-timer-val font-mono">
                {isSunday ? '00:00:00' : sessionElapsedStr}
              </div>
              <span className="staff-timer-sub font-mono">IST Live Clock: {timeStr}</span>
            </div>
          </div>

          {/* Progress Bar (Visible on regular workdays) */}
          {!isSunday && (
            <div className="staff-shift-progress-wrap">
              <div className="staff-progress-meta font-mono">
                <span>Shift Target: 8.0 hrs standard</span>
                <span>{checkedOut ? '100%' : checkedIn ? `${Math.min(100, Math.round((mins - 360) / 480 * 100))}%` : '0%'}</span>
              </div>
              <div className="staff-progress-track">
                <div
                  className="staff-progress-bar"
                  style={{ width: checkedOut ? '100%' : checkedIn ? `${Math.min(100, Math.round((mins - 360) / 480 * 100))}%` : '0%' }}
                />
              </div>
            </div>
          )}

          {/* Contextual Alert Strips */}
          {checkedIn && todayLateInfo.isLate && (
            <div className="staff-alert-banner alert-late">
              <AlertTriangle size={16} />
              <span>
                <strong>Late Check-In:</strong> Clocked in at {fmtT(todayRec.in_time)} (+{todayLateInfo.lateStr} past shift start). Standard arrival is 06:00 AM.
              </span>
            </div>
          )}
          {isShiftOverdue && (
            <div className="staff-alert-banner alert-overdue">
              <AlertCircle size={16} />
              <span>
                <strong>Punch-Out Recommended:</strong> Your shift concluded at 02:00 PM. Please record your exit punch.
              </span>
            </div>
          )}
          {unclosedShift && (
            <div className="staff-alert-banner alert-overdue">
              <AlertCircle size={16} />
              <span>
                <strong>Unclosed Shift from {unclosedShift.date}:</strong> Missing exit punch. Contact supervisor to regularize.
              </span>
            </div>
          )}

          {/* Punch Actions Row */}
          <div className="staff-punch-action-bar">
            <div className="staff-punch-status-note">
              <Clock size={16} />
              <span>
                {isSunday
                  ? 'Field punches are disabled on Sundays.'
                  : 'Punch window: 06:00 AM – 08:00 AM IST (Grace up to 06:30 AM).'}
              </span>
            </div>

            <div className="staff-punch-buttons">
              {isSunday ? (
                <button className="btn btn-outline" disabled>
                  <span>Sunday Holiday (Punches Disabled)</span>
                </button>
              ) : (
                <>
                  {!todayRec ? (
                    <button
                      id="btn-punch-in"
                      className="btn btn-primary btn-punch"
                      onClick={doCheckIn}
                      disabled={btnLoading === 'in'}
                    >
                      <CheckCircle2 size={16} />
                      <span>{btnLoading === 'in' ? 'Marking Attendance...' : 'Punch In'}</span>
                    </button>
                  ) : (
                    <button className="btn btn-outline" disabled>
                      <CheckCircle2 size={16} style={{ color: '#059669' }} />
                      <span>Punched In ({fmtT(todayRec.in_time)})</span>
                    </button>
                  )}

                  {checkedIn ? (
                    <button
                      id="btn-punch-out"
                      className="btn btn-danger btn-punch"
                      onClick={doCheckOut}
                      disabled={btnLoading === 'out'}
                    >
                      <LogOut size={16} />
                      <span>{btnLoading === 'out' ? 'Saving Checkout...' : 'Punch Out'}</span>
                    </button>
                  ) : checkedOut ? (
                    <button className="btn btn-outline" disabled>
                      <CheckCircle2 size={16} style={{ color: '#059669' }} />
                      <span>Punched Out ({fmtT(todayRec.out_time)})</span>
                    </button>
                  ) : (
                    <button className="btn btn-outline" disabled title="Punch in first">
                      <span>Punch Out (Pending In)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 4. CALENDAR & POLICIES 2-COLUMN SPLIT ── */}
        <div className="staff-grid-split">
          {/* Attendance Calendar */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h3 className="panel-card-title">Attendance Calendar</h3>
                <p className="panel-card-subtitle font-mono">{calMonthTitle}</p>
              </div>
              <div className="calendar-nav-btns">
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setCalMonthOffset(p => p - 1)}>&lt; Prev</button>
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setCalMonthOffset(0)}>Current</button>
                <button type="button" className="btn btn-outline btn-xs" onClick={() => setCalMonthOffset(p => p + 1)}>Next &gt;</button>
              </div>
            </div>

            <div className="panel-body">
              <div className="cal-weekdays font-mono">
                <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
              </div>
              <div className="cal-dates-grid">
                {calDatesArray.map((cell, idx) => {
                  if (cell.type === 'pad') return <span key={`pad-${idx}`} className="cal-cell cal-pad">{cell.day}</span>;
                  return (
                    <div key={`day-${cell.day}`} className={`cal-cell ${cell.isToday ? 'today-active' : ''}`}>
                      <span className="cal-day-num font-mono">{cell.day}</span>
                      {cell.dotType === 'green' && <span className="cal-dot dot-green" title="Present on time"/>}
                      {cell.dotType === 'amber' && <span className="cal-dot dot-amber" title="Late arrival"/>}
                      {cell.dotType === 'rose' && <span className="cal-dot dot-rose" title="Missed checkout / absent"/>}
                      {cell.dotType === 'blue' && <span className="cal-dot dot-blue" title="Approved leave"/>}
                      {cell.dotType === 'purple' && <span className="cal-dot dot-purple" title="Sunday holiday"/>}
                    </div>
                  );
                })}
              </div>
              <div className="cal-legend">
                <div className="cal-legend-item">
                  <span className="cal-legend-dot dot-green" />
                  <span className="cal-legend-label">Present</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot dot-amber" />
                  <span className="cal-legend-label">Late</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot dot-rose" />
                  <span className="cal-legend-label">Missed Exit</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot dot-blue" />
                  <span className="cal-legend-label">Leave</span>
                </div>
                <div className="cal-legend-item">
                  <span className="cal-legend-dot dot-purple" />
                  <span className="cal-legend-label">Sunday Off</span>
                </div>
              </div>
            </div>
          </div>

          {/* Ward Helpdesk & Operations Notice */}
          <div className="panel-card">
            <div className="panel-card-header">
              <div>
                <h3 className="panel-card-title">Operations & Guidance</h3>
                <p className="panel-card-subtitle">DMC Field Worker Policies</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="staff-notices-list">
                <div className="staff-notice-item">
                  <div className="staff-notice-icon icon-navy"><Clock size={16} /></div>
                  <div className="staff-notice-text">
                    <strong>Standard Shift Hours</strong>
                    <p>Field duties run 06:00 AM – 02:00 PM (8h). Arrivals between 06:00 and 06:30 AM fall within grace period.</p>
                  </div>
                </div>

                <div className="staff-notice-item">
                  <div className="staff-notice-icon icon-green"><ShieldCheck size={16} /></div>
                  <div className="staff-notice-text">
                    <strong>Ward Supervisor Contact</strong>
                    <p>Supervisor: Vikas Rawani (+91 93041 99882) for missed punches and attendance regularizations.</p>
                  </div>
                </div>

                <div className="staff-notice-item">
                  <div className="staff-notice-icon icon-saff"><KeyRound size={16} /></div>
                  <div className="staff-notice-text">
                    <strong>Account Access & PIN</strong>
                    <p>Do not share your 6-digit PIN. You can change your security PIN directly from your Digital ID pass.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. ATTENDANCE HISTORY LOGS TABLE ── */}
        <div className="panel-card" id="staff-history-table">
          <div className="panel-card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="panel-card-title">Attendance History Logs</h3>
              <p className="panel-card-subtitle">Complete daily audit records of punch-in, punch-out, duration, and status</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const idx = MONTH_CHOICES.findIndex(m => m.value === salMonth);
                  setSalMonth(MONTH_CHOICES[(idx + 1) % MONTH_CHOICES.length].value);
                }}
              >
                <Calendar size={14} />
                <span>{MONTH_CHOICES.find(m => m.value === salMonth)?.label || 'Month'}</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={exportPersonalCSV}
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="panel-controls">
            <div className="history-filter-chips">
              <button
                type="button"
                className={`filter-chip ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All ({historyCounts.all})
              </button>
              <button
                type="button"
                className={`filter-chip ${historyFilter === 'present' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('present')}
              >
                Present ({historyCounts.present})
              </button>
              <button
                type="button"
                className={`filter-chip ${historyFilter === 'late' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('late')}
              >
                Late ({historyCounts.late})
              </button>
              <button
                type="button"
                className={`filter-chip ${historyFilter === 'missed' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('missed')}
              >
                Missed Exit ({historyCounts.missed})
              </button>
              <button
                type="button"
                className={`filter-chip ${historyFilter === 'leave' ? 'active' : ''}`}
                onClick={() => setHistoryFilter('leave')}
              >
                Leave / Off ({historyCounts.leave})
              </button>
            </div>

            <div className="panel-search-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="panel-search-input"
                placeholder="Search date, status, notes..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>
          </div>

          {/* Desktop & Tablet Data Table */}
          <div className="table-responsive desktop-only-table">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Date</th>
                  <th style={{ width: '140px' }}>Check In (IST)</th>
                  <th style={{ width: '140px' }}>Check Out (IST)</th>
                  <th style={{ width: '130px' }}>Duration</th>
                  <th style={{ width: '140px' }}>Status</th>
                  <th>Shift Notes / Audit</th>
                  <th style={{ textAlign: 'right', width: '110px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--mono-500)' }}>
                      No attendance records found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  displayHistory.map(row => (
                    <tr key={row.id || row.date}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="date-badge font-mono">
                            <span className="date-badge-day">{row.dayNum}</span>
                            <span className="date-badge-mo">{row.monthShort}</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.dayName}</div>
                            <div className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.dateFormatted}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono">
                        {row.in_time ? (
                          <div>
                            <span>{row.inTimeDisplay}</span>
                            {row.isLate && <span className="status-badge badge-warning" style={{ display: 'inline-block', marginLeft: 6, fontSize: '0.68rem' }}>+{row.lateStr}</span>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="font-mono">
                        {row.out_time ? (
                          <span>{row.outTimeDisplay}</span>
                        ) : row.isMissedOut ? (
                          <span className="status-badge badge-danger">Missed</span>
                        ) : row.outTimeDisplay === 'In Progress' ? (
                          <span className="status-badge badge-success">In Progress</span>
                        ) : '—'}
                      </td>
                      <td className="font-mono">
                        {row.hoursDisplay}
                      </td>
                      <td>
                        <span className={`status-badge ${
                          row.statusType === 'present' ? 'badge-success' :
                          row.statusType === 'late' ? 'badge-warning' :
                          row.statusType === 'missed' ? 'badge-danger' :
                          row.statusType === 'leave' ? 'badge-purple' :
                          row.statusType === 'holiday' ? 'badge-neutral' : 'badge-neutral'
                        }`}>
                          {row.statusLabel}
                        </span>
                      </td>
                      <td style={{ color: '#475569', fontSize: '0.82rem' }}>
                        {row.exceptionDisplay}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {row.isMissedOut || row.isLate ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => { setSelectedIssueDate(row.date); setShowSupervisorModal(true); }}
                          >
                            Regularize
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Verified ✓</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (<= 768px: Zero Overflow) */}
          <div className="mobile-only-cards">
            {displayHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                No attendance records match your filter criteria.
              </div>
            ) : (
              displayHistory.map(row => (
                <div key={`m-${row.id || row.date}`} className="staff-mob-card">
                  <div className="staff-mob-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="date-badge font-mono">
                        <span className="date-badge-day">{row.dayNum}</span>
                        <span className="date-badge-mo">{row.monthShort}</span>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.dayName}</div>
                        <div className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>{row.dateFormatted}</div>
                      </div>
                    </div>
                    <span className={`status-badge ${
                      row.statusType === 'present' ? 'badge-success' :
                      row.statusType === 'late' ? 'badge-warning' :
                      row.statusType === 'missed' ? 'badge-danger' :
                      row.statusType === 'leave' ? 'badge-purple' : 'badge-neutral'
                    }`}>
                      {row.statusLabel}
                    </span>
                  </div>

                  <div className="staff-mob-grid font-mono">
                    <div>
                      <span className="staff-mob-lbl">Check In</span>
                      <span className="staff-mob-val">{row.inTimeDisplay || '—'}</span>
                    </div>
                    <div>
                      <span className="staff-mob-lbl">Check Out</span>
                      <span className="staff-mob-val">{row.outTimeDisplay || '—'}</span>
                    </div>
                    <div>
                      <span className="staff-mob-lbl">Hours</span>
                      <span className="staff-mob-val">{row.hoursDisplay || '—'}</span>
                    </div>
                  </div>

                  <div className="staff-mob-bot">
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{row.exceptionDisplay}</span>
                    {(row.isMissedOut || row.isLate) && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => { setSelectedIssueDate(row.date); setShowSupervisorModal(true); }}
                      >
                        Regularize
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS (Clean Minimalist Matching Admin Modals) ── */}

      {/* Modal: Request Leave */}
      <AnimatePresence>
        {showRequestLeaveModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3>Apply for Leave</h3>
                    <p className="modal-sub">Submit time-off application for supervisor approval</p>
                  </div>
                </div>
                <button type="button" className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
              </div>

              <form onSubmit={handleRequestLeave}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Leave Category</label>
                    <select
                      className="form-input"
                      value={leaveForm.type}
                      onChange={e => setLeaveForm(p => ({ ...p, type: e.target.value }))}
                    >
                      <option value="Earned Leave">Earned Leave (14 days remaining)</option>
                      <option value="Casual Leave">Casual Leave (4 days remaining)</option>
                      <option value="Medical Leave">Medical Leave (8 days remaining)</option>
                      <option value="Compensatory Off">Compensatory Off (2 days remaining)</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="date"
                        className="form-input font-mono"
                        value={leaveForm.startDate}
                        onChange={e => setLeaveForm(p => ({ ...p, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="date"
                        className="form-input font-mono"
                        value={leaveForm.endDate}
                        onChange={e => setLeaveForm(p => ({ ...p, endDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reason for Absence *</label>
                    <textarea
                      rows={3}
                      className="form-input"
                      placeholder="Briefly describe the reason for leave..."
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Submit Application</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Supervisor Helpline */}
      <AnimatePresence>
        {showSupervisorModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div
              className="modal-box"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-icon-badge" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3>Ward Support & Regularization</h3>
                    <p className="modal-sub">Dhanbad Municipal Corporation Helpdesk</p>
                  </div>
                </div>
                <button type="button" className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
              </div>

              <div className="modal-body">
                {selectedIssueDate && (
                  <div className="hint-box" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <AlertTriangle size={16} className="hint-icon" />
                    <span><strong>Selected Date for Regularization:</strong> {selectedIssueDate}. Contact supervisor Vikas Rawani to record exit punch or late entry.</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    VR
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Ward Supervisor</span>
                    <h4 style={{ margin: 0, fontSize: '0.94rem', color: '#0f172a' }}>Vikas Rawani</h4>
                    <span className="font-mono" style={{ fontSize: '0.8rem', color: '#475569' }}>+91 93041 99882</span>
                  </div>
                  <a
                    href="tel:9304199882"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', padding: '8px 14px' }}
                  >
                    Call
                  </a>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, marginTop: 12 }}>
                  For biometric issues, missed exits, or shift regularizations, contact your ward supervisor or the central helpline.
                </div>

                <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.78rem', fontWeight: 600, marginTop: 12 }}>
                  📞 Central Control Room: 0326-2312555 (Toll-Free: 1800-890-4115)
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={closeModal}>Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Digital ID Pass */}
      <AnimatePresence>
        {showIdModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div
              className="modal-box"
              style={{ maxWidth: 440 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    <IdCard size={18} />
                  </div>
                  <div>
                    <h3>Digital Employee Pass</h3>
                    <p className="modal-sub">Dhanbad Municipal Corporation Credential</p>
                  </div>
                </div>
                <button type="button" className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
              </div>

              <div className="modal-body" style={{ textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '2rem', margin: '0 auto 12px' }}>
                  {initials(profile?.name)}
                </div>
                <h3 style={{ margin: '0 0 2px', fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{profile?.name || 'Staff Member'}</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#2563eb', fontWeight: 600 }}>{profile?.designation || 'Sanitation Worker'}</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: 14, borderRadius: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Employee ID</span>
                    <div className="font-mono" style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{profile?.emp_id || 'EMP-001'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Department</span>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{profile?.department || 'Sanitation'}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                    <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Assigned Ward / Beat</span>
                    <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.84rem' }}>{dutyWard}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline w-full"
                  onClick={() => { setShowIdModal(false); setShowPinModal(true); }}
                >
                  <KeyRound size={15} />
                  <span>Change Security PIN</span>
                </button>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={closeModal}>Done</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Change Security PIN */}
      <AnimatePresence>
        {showPinModal && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
            <motion.div
              className="modal-box"
              style={{ maxWidth: 400 }}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
            >
              <div className="modal-header">
                <div className="modal-title-row">
                  <div className="modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    <KeyRound size={18} />
                  </div>
                  <div>
                    <h3>Update Security PIN</h3>
                    <p className="modal-sub">6-Digit Account Access PIN</p>
                  </div>
                </div>
                <button type="button" className="modal-close-btn" onClick={closeModal}><X size={18} /></button>
              </div>

              <form onSubmit={handleChangePin}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">New 6-Digit PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="Enter 6 digits"
                      value={newPin}
                      onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="form-input font-mono"
                      style={{ fontSize: '1.25rem', letterSpacing: '0.25em', textAlign: 'center' }}
                      required
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={pinLoading || newPin.length !== 6}
                  >
                    {pinLoading ? 'Updating...' : 'Save PIN'}
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
