import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import AnimatedNumber from '../components/AnimatedNumber';
import MagicCard from '../components/MagicCard';
import SpatialCard from '../components/SpatialCard';
import { supabase, makeTempClient } from '../lib/supabase';
import { todayIST, hrs, pay, money, fmtT, fmtAuditTimestamp, cleanWard, getInitials, fillMonths, sanitizeCSVCell, isPastIncomplete, getISTParts, parseCSVLine } from '../lib/utils';
import { triggerCelebration, springPhysics } from '../lib/animations';
import AnimatedCheckmark from '../components/AnimatedCheckmark';
import {
  Users,
  Calendar,
  ClipboardList,
  BarChart3,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  IndianRupee,
  UserX,
  FileSpreadsheet,
  Trash2,
  TrendingUp,
  Building2,
  X,
  RefreshCw,
  AlertCircle,
  Upload,
  Edit3,
  Lock,
  Unlock,
  KeyRound,
  Copy,
  Printer,
  Check,
  ChevronDown,
  Filter,
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

const WARDS = [
  'Ward 12 (Bank More)',
  'Ward 24 (Hirapur)',
  'Ward 31 (Steel Gate)',
  'Ward 45 (Saraidhela)',
  'Ward 08 (Katras)'
];

// ──────────────────────────────────────────────
// Regularize / Attendance Correction Modal (Module 5 & Rule 8)
// ──────────────────────────────────────────────
function RegularizeModal({ record, onClose, onSaved, isPeriodLocked = false }) {
  const [inTime, setInTime] = useState(() => {
    if (!record?.in_time) return '';
    const p = getISTParts(record.in_time);
    return p ? `${p.hour}:${p.minute}` : '';
  });
  const [outTime, setOutTime] = useState(() => {
    if (!record?.out_time) return '';
    const p = getISTParts(record.out_time);
    return p ? `${p.hour}:${p.minute}` : '';
  });
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleSave() {
    if (!inTime) { setErr('Check-in time is required.'); return; }
    if (!outTime) { setErr('Check-out time is required.'); return; }
    if (outTime <= inTime) {
      setErr('Check-out time must be strictly after check-in time.');
      return;
    }
    if (!reason.trim()) {
      setErr('Correction reason is mandatory for municipal audit compliance.');
      return;
    }
    setLoading(true); setErr('');
    try {
      const baseDate = record.date;
      const newInISO = new Date(`${baseDate}T${inTime}:00+05:30`).toISOString();
      const newOutISO = new Date(`${baseDate}T${outTime}:00+05:30`).toISOString();
      const corrType = isPeriodLocked 
        ? 'LOCKED_PERIOD_OVERRIDE'
        : !record.out_time ? 'MISSING_CHECKOUT_REGULARIZATION' : 'TIME_CORRECTION';
      const fullReason = (isPeriodLocked ? '[POST-LOCK OVERRIDE] ' : '') + reason.trim();

      // Atomic RPC call (single transaction for audit ledger + attendance update, no bypass)
      const { error: rpcErr } = await supabase.rpc('regularize_attendance', {
        p_attendance_id: record.id,
        p_new_in_time: newInISO,
        p_new_out_time: newOutISO,
        p_reason: fullReason,
        p_correction_type: corrType
      });

      if (rpcErr) throw rpcErr;

      triggerCelebration();
      toast.success(`Attendance regularized for ${record.staff_name}`);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to update attendance');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal-box" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
              <Edit3 size={18} />
            </div>
            <div>
              <h3>Regularize Attendance</h3>
              <p className="modal-sub">{record.staff_name} ({record.emp_id}) • Date: {record.date}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {isPeriodLocked ? (
          <div className="hint-box" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
            <Lock size={16} className="hint-icon" />
            <span><strong>Period Finalized (Rule 15):</strong> Month {record.date?.slice(0, 7)} has been locked for payroll. This modification will be logged as an approved post-lock administrative correction.</span>
          </div>
        ) : (
          <div className="hint-box">
            <AlertCircle size={16} className="hint-icon" />
            <span>Every attendance correction is permanently logged in the audit ledger per DMC compliance rules.</span>
          </div>
        )}

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Check-In Time (HH:MM)</label>
            <input type="time" className="form-input font-mono" value={inTime} onChange={e => setInTime(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Check-Out Time (HH:MM)</label>
            <input type="time" className="form-input font-mono" value={outTime} onChange={e => setOutTime(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Correction *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="e.g. Worker was deployed for emergency sanitation; network was unavailable at checkout."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          {err && <div className="modal-msg modal-msg-err"><X size={16} /><span>{err}</span></div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
            <span>{loading ? 'Saving Audit Record...' : 'Confirm Regularization'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Bulk Staff Import Modal (Module 10)
// ──────────────────────────────────────────────
function BulkStaffModal({ onClose, onImported, existingIds = [] }) {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const parsedRows = useMemo(() => {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    const existingSet = new Set(existingIds.map(id => String(id).toUpperCase()));
    const seenInFile = new Set();

    return lines.map((line, idx) => {
      const parts = parseCSVLine(line);
      const name = parts[0] || '';
      const empId = (parts[1] || '').toUpperCase();
      const pin = parts[2] || '';
      const ward = parts[3] || WARDS[0];
      const dept = parts[4] || 'Sanitation';

      // Detect and skip CSV header row
      if (idx === 0 && name.toLowerCase() === 'name' && (empId.includes('ID') || empId.includes('EMP'))) {
        return { rowNum: idx + 1, name, empId, pin, ward, dept, status: 'skip', error: 'Header Row (Skipped)' };
      }

      let status = 'valid';
      let error = '';
      if (!name || !empId) {
        status = 'error'; error = 'Missing Name or Employee ID';
      } else if (!pin) {
        status = 'error'; error = 'PIN is required';
      } else if (pin.length < 6) {
        status = 'error'; error = 'PIN must be at least 6 characters (Auth policy)';
      } else if (seenInFile.has(empId)) {
        status = 'error'; error = 'Duplicate ID within file';
      } else if (existingSet.has(empId)) {
        status = 'error'; error = 'Duplicate ID in Database';
      } else {
        seenInFile.add(empId);
      }

      return { rowNum: idx + 1, name, empId, pin, ward, dept, status, error };
    });
  }, [csvText, existingIds]);

  const validRows = parsedRows.filter(r => r.status === 'valid');

  function loadSampleData() {
    setCsvText(
      "Ramesh Kumar,EMP101,654321,Ward 12 (Bank More),Sanitation\n" +
      "Sita Devi,EMP102,789123,Ward 24 (Hirapur),Sanitation\n" +
      "Amit Singh,EMP103,456789,Ward 31 (Steel Gate),Sanitation"
    );
  }

  async function handleBulkImport() {
    if (validRows.length === 0) {
      toast.error('No valid rows found to import.');
      return;
    }
    setLoading(true);
    let successCount = 0;
    const results = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setProgress(`Registering ${i + 1} of ${validRows.length}: ${row.name}...`);
      const rowPin = row.pin && row.pin.length >= 6 
        ? row.pin 
        : Math.floor(100000 + Math.random() * 900000).toString();

      try {
        const { data, error: rpcErr } = await supabase.rpc('admin_register_staff', {
          p_emp_id: row.empId,
          p_name: row.name,
          p_pin: rowPin,
          p_ward: row.ward,
          p_department: row.dept,
          p_designation: 'Sanitation Worker',
          p_phone: null,
          p_role: 'staff'
        });
        if (rpcErr) throw rpcErr;
        successCount++;
        results.push({
          rowNum: row.rowNum,
          name: row.name,
          empId: row.empId,
          pin: rowPin,
          ward: row.ward,
          dept: row.dept,
          status: 'success',
          message: 'Registered'
        });
      } catch (err) {
        console.warn(`Failed to import ${row.name}:`, err);
        results.push({
          rowNum: row.rowNum,
          name: row.name,
          empId: row.empId,
          pin: rowPin,
          ward: row.ward,
          dept: row.dept,
          status: 'error',
          message: err.message || 'Import error'
        });
      }
    }

    setLoading(false);
    setProgress(null);
    setImportSummary({ successCount, total: validRows.length, results });

    if (successCount > 0) {
      triggerCelebration();
      toast.success(`Successfully registered ${successCount} of ${validRows.length} workers!`);
      onImported();
    } else {
      toast.error('Bulk registration failed. See details below.');
    }
  }

  function downloadCredentialsCSV(items) {
    const lines = [
      ['Employee ID', 'Name', 'Login PIN', 'Ward', 'Department', 'Date Registered']
    ];
    items.forEach(item => {
      lines.push([
        sanitizeCSVCell(item.empId),
        sanitizeCSVCell(item.name),
        item.pin,
        sanitizeCSVCell(item.ward || 'Ward 12'),
        sanitizeCSVCell(item.dept || 'Sanitation'),
        new Date().toISOString().slice(0, 10)
      ]);
    });
    const csv = '\ufeff' + lines.map(l => l.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `dmc-worker-credentials-${todayIST()}.csv`;
    a.click();
    toast.success('Worker credentials sheet downloaded');
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div className="modal-box modal-box-large" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
              <Upload size={18} />
            </div>
            <div>
              <h3>Bulk Worker Import / सामूहिक कर्मचारी पंजीकरण</h3>
              <p className="modal-sub">Format: Name, Employee ID, PIN, Ward, Department</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {!importSummary ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Paste CSV lines below:</span>
                <button
                  type="button"
                  onClick={loadSampleData}
                  style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Load Sample Template
                </button>
              </div>
              <textarea
                className="csv-textarea"
                placeholder="Ramesh Kumar,EMP101,654321,Ward 12 (Bank More),Sanitation"
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Total rows: <strong>{parsedRows.length}</strong> | Valid: <strong style={{ color: '#16a34a' }}>{validRows.length}</strong> | Issues: <strong style={{ color: '#dc2626' }}>{parsedRows.length - validRows.length}</strong>
                </span>
              </div>

              {parsedRows.length > 0 && (
                <div className="preview-table-wrap">
                  <table className="modern-table" style={{ fontSize: '0.78rem' }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>ID</th>
                        <th>Ward</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map(r => (
                        <tr key={r.rowNum}>
                          <td>{r.rowNum}</td>
                          <td>{r.name}</td>
                          <td className="font-mono">{r.empId}</td>
                          <td>{r.ward}</td>
                          <td>
                            {r.status === 'valid' ? (
                              <span className="status-badge badge-success">Valid</span>
                            ) : (
                              <span className="status-badge badge-neutral" style={{ color: '#dc2626' }}>{r.error}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {progress && (
                <div style={{ marginTop: '10px', fontSize: '0.84rem', color: '#1d4ed8', fontWeight: 600 }}>
                  {progress}
                </div>
              )}
            </>
          ) : (
            <div>
              <div style={{ padding: '16px', background: importSummary.successCount === importSummary.total ? '#f0fdf4' : '#fffbeb', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: importSummary.successCount === importSummary.total ? '#166534' : '#b45309', fontSize: '0.95rem' }}>
                  Import Summary: {importSummary.successCount} of {importSummary.total} workers registered successfully
                </h4>
              </div>
              <div className="preview-table-wrap">
                <table className="modern-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importSummary.results.map((res, i) => (
                      <tr key={i}>
                        <td>{res.rowNum}</td>
                        <td>{res.name}</td>
                        <td className="font-mono">{res.empId}</td>
                        <td>
                          <span className={`status-badge ${res.status === 'success' ? 'badge-success' : 'badge-neutral'}`} style={res.status !== 'success' ? { color: '#dc2626' } : {}}>
                            {res.status === 'success' ? 'Created' : 'Failed'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: res.status === 'success' ? '#166534' : '#dc2626' }}>
                          {res.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!importSummary ? (
            <>
              <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkImport} disabled={loading || validRows.length === 0}>
                {loading ? <RefreshCw size={15} className="spin" /> : <Upload size={15} />}
                <span>{loading ? 'Processing...' : `Confirm Import (${validRows.length} Workers)`}</span>
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-outline"
                onClick={() => downloadCredentialsCSV(importSummary.results.filter(r => r.status === 'success'))}
                disabled={importSummary.successCount === 0}
              >
                <FileSpreadsheet size={15} />
                <span>Download Credentials Handout (.CSV)</span>
              </button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Add Staff Modal (Atomic Server Procedure + Credential Slip)
// ──────────────────────────────────────────────
function AddStaffModal({ onClose, onAdded, existingIds = [] }) {
  const nextDefaultId = useMemo(() => {
    let maxNum = 0;
    existingIds.forEach(id => {
      const match = String(id).match(/EMP(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `EMP${String(maxNum + 1).padStart(3, '0')}`;
  }, [existingIds]);

  const [name, setName] = useState('');
  const [empId, setEmpId] = useState(nextDefaultId);
  const [pin, setPin] = useState('');
  const [ward, setWard] = useState(WARDS[0]);
  const [dept, setDept] = useState('Sanitation');
  const [designation, setDesignation] = useState('Sanitation Worker');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('staff');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [copied, setCopied] = useState(false);

  function generateSecurePin() {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(random);
  }

  async function handleSave() {
    const n = name.trim(), id = empId.trim().toUpperCase(), p = pin.trim();
    if (!n || !id || !p) { setMsg({ type: 'err', text: 'Please fill all required fields.' }); return; }
    if (!/^\d{6}$/.test(p)) { setMsg({ type: 'err', text: 'PIN must be exactly 6 digits (e.g. 123456).' }); return; }

    setLoading(true);
    setMsg(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_register_staff', {
        p_emp_id: id,
        p_name: n,
        p_pin: p,
        p_ward: ward,
        p_department: dept,
        p_designation: designation.trim() || 'Sanitation Worker',
        p_phone: phone.trim() || null,
        p_role: role
      });
      if (rpcErr) throw rpcErr;

      triggerCelebration();
      setCreatedCredential({
        name: n,
        empId: id,
        pin: p,
        ward,
        department: dept,
        role
      });
      toast.success(`${n} (${id}) registered successfully!`);
      onAdded();
    } catch (e) {
      setMsg({ type: 'err', text: e.message || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  }

  function handleCopyCreds() {
    if (!createdCredential) return;
    const text = `DMC Attendance Credentials\nEmployee: ${createdCredential.name} (${createdCredential.empId})\nLogin PIN: ${createdCredential.pin}\nWard: ${createdCredential.ward}\nDept: ${createdCredential.department}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleResetForNext() {
    setName('');
    setPin('');
    setPhone('');
    setCreatedCredential(null);
    setMsg(null);
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
              <p className="modal-sub">Register new field worker</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {!createdCredential ? (
            <>
              <div className="hint-box">
                <Building2 size={16} className="hint-icon" />
                <span>Staff will log in using their <strong>Employee ID</strong> and <strong>PIN</strong>.</span>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label className="form-label">Full Name / पूरा नाम *</label>
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
                <label className="form-label">Employee ID / कर्मचारी क्रमांक *</label>
                <input
                  className="form-input font-mono"
                  placeholder="e.g. EMP001"
                  maxLength={20}
                  value={empId}
                  onChange={e => setEmpId(e.target.value.toUpperCase())}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Ward</label>
                <select className="form-input" value={ward} onChange={e => setWard(e.target.value)}>
                  {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Department / विभाग</label>
                <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
                  <option value="Sanitation">Sanitation / स्वच्छता विभाग</option>
                  <option value="Waste Collection">Waste Collection / कचरा प्रबंधन</option>
                  <option value="Road Maintenance">Road Maintenance / सड़क रखरखाव</option>
                  <option value="Health">Health & Vector / स्वास्थ्य</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Designation / पद</label>
                <input
                  className="form-input"
                  value={designation}
                  onChange={e => setDesignation(e.target.value)}
                  placeholder="e.g. Sanitation Worker"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number (Optional) / मोबाइल नंबर</label>
                <input
                  className="form-input font-mono"
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role / भूमिका</label>
                <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                  <option value="staff">Staff Worker (Field Punching)</option>
                  <option value="admin">Administrator / Supervisor</option>
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Login PIN (6 digits) / 6-अंकीय लॉगिन पिन *</label>
                  <button
                    type="button"
                    onClick={generateSecurePin}
                    style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Auto-generate PIN
                  </button>
                </div>
                <input
                  className="form-input font-mono"
                  placeholder="e.g. 123456"
                  maxLength={6}
                  inputMode="numeric"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {msg && (
                <div className={`modal-msg ${msg.type === 'ok' ? 'modal-msg-ok' : 'modal-msg-err'}`}>
                  {msg.type === 'ok' ? <AnimatedCheckmark size={20} color="#15803d" strokeWidth={2.5} /> : <X size={16} />}
                  <span>{msg.text}</span>
                </div>
              )}
            </>
          ) : (
            <div className="credential-slip">
              <div className="credential-slip-header">
                <span className="credential-slip-title">Official Staff Credential Slip</span>
                <span className="status-badge badge-success">✓ Active Registered</span>
              </div>
              <div className="credential-slip-grid">
                <div className="credential-item">
                  <span className="credential-label">Employee Name</span>
                  <span className="credential-val">{createdCredential.name}</span>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Employee ID</span>
                  <span className="credential-val font-mono">{createdCredential.empId}</span>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Ward</span>
                  <span className="credential-val">{createdCredential.ward}</span>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Department</span>
                  <span className="credential-val">{createdCredential.department}</span>
                </div>
              </div>
              <div className="credential-item" style={{ marginTop: '8px' }}>
                <span className="credential-label">Assigned Login PIN</span>
                <div className="credential-pin-box">
                  <span>{createdCredential.pin}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!createdCredential ? (
            <>
              <motion.button
                className="btn btn-outline"
                onClick={onClose}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={springPhysics.snappy}
              >
                Cancel
              </motion.button>
              <motion.button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={springPhysics.snappy}
              >
                {loading ? <RefreshCw size={15} className="spin" /> : <Plus size={15} />}
                <span>{loading ? 'Registering...' : 'Save Employee'}</span>
              </motion.button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={handleCopyCreds}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Copied!' : 'Copy Slip'}</span>
              </button>
              <button className="btn btn-outline" onClick={handleResetForNext}>
                <Plus size={15} />
                <span>Add Another</span>
              </button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Edit Staff Modal
// ──────────────────────────────────────────────
function EditStaffModal({ staff, onClose, onUpdated }) {
  const [name, setName] = useState(staff.name || '');
  const [ward, setWard] = useState(staff.ward || WARDS[0]);
  const [dept, setDept] = useState(staff.department || 'Sanitation');
  const [designation, setDesignation] = useState(staff.designation || 'Sanitation Worker');
  const [phone, setPhone] = useState(staff.phone || '');
  const [role, setRole] = useState(staff.role || 'staff');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function handleUpdate() {
    if (!name.trim()) { setErr('Name cannot be empty.'); return; }
    setLoading(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_update_staff', {
        p_staff_id: staff.id,
        p_name: name.trim(),
        p_ward: ward,
        p_department: dept,
        p_designation: designation.trim() || 'Sanitation Worker',
        p_phone: phone.trim() || null,
        p_role: role
      });
      if (error) throw error;
      toast.success(`Profile for ${name.trim()} updated successfully!`);
      onUpdated();
      onClose();
    } catch (e) {
      setErr(e.message || 'Update failed');
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
              <Edit3 size={18} />
            </div>
            <div>
              <h3>Edit Staff Profile</h3>
              <p className="modal-sub">{staff.name} ({staff.emp_id})</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Ward</label>
            <select className="form-input" value={ward} onChange={e => setWard(e.target.value)}>
              {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Department / विभाग</label>
            <select className="form-input" value={dept} onChange={e => setDept(e.target.value)}>
              <option value="Sanitation">Sanitation / स्वच्छता विभाग</option>
              <option value="Waste Collection">Waste Collection / कचरा प्रबंधन</option>
              <option value="Road Maintenance">Road Maintenance / सड़क रखरखाव</option>
              <option value="Health">Health & Vector / स्वास्थ्य</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Designation / पद</label>
            <input
              className="form-input"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
              placeholder="e.g. Sanitation Worker"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number / मोबाइल नंबर</label>
            <input
              className="form-input font-mono"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={10}
              placeholder="e.g. 9876543210"
            />
          </div>

          <div className="form-group">
            <label className="form-label">System Role / भूमिका</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="staff">Staff Worker (Field Punching)</option>
              <option value="admin">Administrator / Supervisor</option>
            </select>
          </div>

          {err && (
            <div className="modal-msg modal-msg-err">
              <AlertCircle size={16} />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={loading}>
            {loading ? <RefreshCw size={15} className="spin" /> : <CheckCircle2 size={15} />}
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Reset PIN Modal
// ──────────────────────────────────────────────
function ResetPinModal({ staff, onClose, onReset }) {
  const [newPin, setNewPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  function generatePin() {
    const random = Math.floor(100000 + Math.random() * 900000).toString();
    setNewPin(random);
  }

  async function handleReset() {
    const p = newPin.trim();
    if (!/^\d{6}$/.test(p)) {
      setErr('PIN must be exactly 6 numeric digits.');
      return;
    }
    setLoading(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_reset_staff_pin', {
        p_staff_id: staff.id,
        p_new_pin: p
      });
      if (error) throw error;
      setResult({
        name: staff.name,
        empId: staff.emp_id,
        pin: p
      });
      toast.success(`PIN reset successfully for ${staff.name}`);
      if (onReset) onReset();
    } catch (e) {
      setErr(e.message || 'Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  }

  function copyCreds() {
    if (!result) return;
    const text = `DMC Attendance Credentials\nStaff: ${result.name} (${result.empId})\nNew Login PIN: ${result.pin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
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
            <div className="modal-icon-badge" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h3>Reset Worker PIN</h3>
              <p className="modal-sub">लॉगिन पिन रीसेट करें</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {!result ? (
            <>
              <div className="hint-box">
                <AlertCircle size={16} className="hint-icon" />
                <span>Resetting login PIN for <strong>{staff.name}</strong> ({staff.emp_id}). Existing PIN will immediately be replaced.</span>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>New 6-Digit PIN / नया 6-अंकीय पिन *</label>
                  <button
                    type="button"
                    onClick={generatePin}
                    style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Auto-generate PIN
                  </button>
                </div>
                <input
                  className="form-input font-mono"
                  placeholder="e.g. 654321"
                  maxLength={6}
                  inputMode="numeric"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>

              {err && (
                <div className="modal-msg modal-msg-err">
                  <AlertCircle size={16} />
                  <span>{err}</span>
                </div>
              )}
            </>
          ) : (
            <div className="credential-slip">
              <div className="credential-slip-header">
                <span className="credential-slip-title">Updated Credentials Handout</span>
                <span className="status-badge badge-success">✓ Active</span>
              </div>
              <div className="credential-slip-grid">
                <div className="credential-item">
                  <span className="credential-label">Employee</span>
                  <span className="credential-val">{result.name}</span>
                </div>
                <div className="credential-item">
                  <span className="credential-label">Employee ID</span>
                  <span className="credential-val font-mono">{result.empId}</span>
                </div>
              </div>
              <div className="credential-item" style={{ marginTop: '6px' }}>
                <span className="credential-label">New Login PIN</span>
                <div className="credential-pin-box">
                  <span>{result.pin}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!result ? (
            <>
              <button className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-primary" onClick={handleReset} disabled={loading || newPin.length < 6}>
                {loading ? <RefreshCw size={15} className="spin" /> : <KeyRound size={15} />}
                <span>{loading ? 'Updating...' : 'Confirm PIN Reset'}</span>
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={copyCreds}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                <span>{copied ? 'Copied!' : 'Copy Credentials'}</span>
              </button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Admin Page
// ──────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('staff');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resetPinStaff, setResetPinStaff] = useState(null);
  const [regularizeRec, setRegularizeRec] = useState(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('test') === 'regularize') {
      return {
        id: 'test-att-1',
        staff_name: 'Ramesh Kumar',
        emp_id: 'EMP001',
        date: '2026-10-24',
        in_time: '2026-10-24T06:15:00+05:30',
        out_time: null
      };
    }
    return null;
  });
  const [selectedWard, setSelectedWard] = useState('All Wards');

  const [allStaff, setAllStaff] = useState([]);
  const [todayRecs, setTodayRecs] = useState([]);
  const [salRecs, setSalRecs] = useState([]);
  const [allRecs, setAllRecs] = useState([]);
  const [corrections, setCorrections] = useState([]);

  const [salMonth, setSalMonth] = useState(MONTHS[0].value);
  const [recMonth, setRecMonth] = useState(MONTHS[0].value);
  const [staffSearch, setStaffSearch] = useState('');
  const [recSearch, setRecSearch] = useState('');
  const [recStatus, setRecStatus] = useState('');
  const [showInactiveStaff, setShowInactiveStaff] = useState(false);

  const [lockedMonths, setLockedMonths] = useState([]);
  const [salLoading, setSalLoading] = useState(false);
  const [salError, setSalError] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState(null);

  // Load all workers (both active and inactive) so ID uniqueness and historical payroll work accurately
  const loadStaff = useCallback(async () => {
    const { data, error } = await supabase.from('staff').select('*').neq('role', 'admin').order('name');
    if (error) {
      console.error('Staff fetch error:', error);
      toast.error('Failed to load staff roster');
      return;
    }
    setAllStaff(data || []);
  }, []);

  const loadToday = useCallback(async () => {
    const { data, error } = await supabase.from('attendance').select('*').eq('date', todayIST());
    if (error) {
      console.error('Today attendance fetch error:', error);
      toast.error('Failed to load today attendance records');
      return;
    }
    setTodayRecs(data || []);
  }, []);

  // R3 FIX: Paginated chunk loading with deterministic ordering and error preservation
  const loadSalary = useCallback(async (month) => {
    setSalLoading(true);
    setSalError(null);
    let records = [];
    let from = 0;
    const chunkSize = 1000;
    let queryFailed = false;

    while (true) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('month_key', month)
        .order('date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + chunkSize - 1);

      if (error) {
        console.error('Error fetching monthly salary attendance:', error);
        setSalError(error.message || 'Database error loading salary records');
        toast.error('Failed to load complete salary records from database');
        queryFailed = true;
        break;
      }
      if (!data || data.length === 0) break;
      records.push(...data);
      if (data.length < chunkSize) break;
      from += chunkSize;
    }

    if (!queryFailed) {
      setSalRecs(records);
    }
    setSalLoading(false);
  }, []);

  // R3 FIX: Paginated chunk loading for historical records view with stable compound ordering
  const loadRecs = useCallback(async (month) => {
    setRecsLoading(true);
    setRecsError(null);
    let records = [];
    let from = 0;
    const chunkSize = 1000;
    let queryFailed = false;

    while (true) {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('month_key', month)
        .order('in_time', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + chunkSize - 1);

      if (error) {
        console.error('Error fetching records attendance:', error);
        setRecsError(error.message || 'Database error loading attendance logs');
        toast.error('Failed to load complete attendance records');
        queryFailed = true;
        break;
      }
      if (!data || data.length === 0) break;
      records.push(...data);
      if (data.length < chunkSize) break;
      from += chunkSize;
    }

    if (!queryFailed) {
      setAllRecs(records);
    }
    setRecsLoading(false);
  }, []);

  const loadPeriodLocks = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('period_locks').select('month_key');
      if (error) {
        console.error('Failed to load period locks from database:', error);
        return;
      }
      const keys = (data || []).map(d => d.month_key);
      setLockedMonths(keys);
    } catch (e) {
      console.error('Error fetching period locks:', e);
    }
  }, []);

  const loadCorrections = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('attendance_corrections').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) {
        console.warn('Corrections table fetch note:', error);
      } else {
        setCorrections(data || []);
      }
    } catch (e) {
      console.warn('Corrections table fetch exception:', e);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadStaff(), loadToday(), loadSalary(salMonth), loadCorrections(), loadPeriodLocks()]).then(() => setLoading(false));
  }, [loadStaff, loadToday, loadSalary, salMonth, loadCorrections, loadPeriodLocks]);

  async function toggleLockMonth(monthKey) {
    const isLocked = lockedMonths.includes(monthKey);
    if (isLocked) {
      if (!confirm(`Reopen month ${monthKey} for revisions? Attendance edits will resume being active.`)) return;
      try {
        const { error } = await supabase.from('period_locks').delete().eq('month_key', monthKey);
        if (error) throw error;
        setLockedMonths(prev => prev.filter(m => m !== monthKey));
        toast.success(`Month ${monthKey} reopened for revisions.`);
      } catch (err) {
        console.error('Failed to reopen month in database:', err);
        toast.error('Failed to reopen month: ' + (err.message || 'Database error'));
      }
    } else {
      if (!confirm(`Finalize and lock attendance for ${monthKey}? This freezes payroll records against accidental changes per DMC Rule 15.`)) return;
      try {
        const { error } = await supabase.from('period_locks').upsert({
          month_key: monthKey,
          locked_by: 'Admin',
          locked_at: new Date().toISOString()
        });
        if (error) throw error;
        setLockedMonths(prev => [...new Set([...prev, monthKey])]);
        toast.success(`Month ${monthKey} finalized and locked for payroll.`);
      } catch (err) {
        console.error('Failed to lock month in database:', err);
        toast.error('Failed to lock month: ' + (err.message || 'Database error'));
      }
    }
  }

  useEffect(() => { loadSalary(salMonth); }, [salMonth, loadSalary]);
  useEffect(() => { loadRecs(recMonth); }, [recMonth, loadRecs]);

  // Support both deactivating and reactivating worker profiles
  async function toggleStaffStatus(id, name, currentActive) {
    const action = currentActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} ${name}? Historical attendance logs will be preserved.`)) return;
    const { error } = await supabase.from('staff').update({ active: !currentActive }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success(`${name} ${action}d successfully`);
    await loadStaff();
  }

  // ── Incomplete Shifts (Rule 12: Missing Checkout Safeguard) ──
  const incompleteShifts = useMemo(() => {
    return allRecs.filter(r => isPastIncomplete(r));
  }, [allRecs]);

  // ── Filtered staff for directory view (respects search, ward, and active filter) ──
  const filteredStaff = useMemo(() => {
    return allStaff.filter(s => {
      const matchSearch = !staffSearch || s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.emp_id?.toLowerCase().includes(staffSearch.toLowerCase());
      const matchWard = selectedWard === 'All Wards' || cleanWard(s.ward || 'Ward 12 (Bank More)') === cleanWard(selectedWard);
      const matchActive = showInactiveStaff ? true : (s.active !== false);
      return matchSearch && matchWard && matchActive;
    });
  }, [allStaff, staffSearch, selectedWard, showInactiveStaff]);

  // ── Active staff only (used for today's expected attendance & attendance rate) ──
  const activeStaff = useMemo(() => {
    return allStaff.filter(s => s.active !== false && (selectedWard === 'All Wards' || cleanWard(s.ward || 'Ward 12 (Bank More)') === cleanWard(selectedWard)));
  }, [allStaff, selectedWard]);

  // ── Filtered Today records ──
  const filteredTodayRecs = useMemo(() => {
    return todayRecs.filter(r => {
      const matchWard = selectedWard === 'All Wards' || cleanWard(r.ward || 'Ward 12 (Bank More)') === cleanWard(selectedWard);
      return matchWard;
    });
  }, [todayRecs, selectedWard]);

  // ── Filtered historical records ──
  const filteredRecs = useMemo(() => {
    return allRecs.filter(r => {
      const matchName = !recSearch || (r.staff_name || '').toLowerCase().includes(recSearch.toLowerCase()) || (r.emp_id || '').toLowerCase().includes(recSearch.toLowerCase());
      const matchWard = selectedWard === 'All Wards' || cleanWard(r.ward || 'Ward 12 (Bank More)') === cleanWard(selectedWard);
      let matchStatus = true;
      if (recStatus) {
        const h = hrs(r.in_time, r.out_time);
        const s = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
        matchStatus = s === recStatus;
      }
      return matchName && matchWard && matchStatus;
    });
  }, [allRecs, recSearch, recStatus, selectedWard]);

  // ── R4 FIX: Salary calculations include active workers PLUS former workers who worked in this payroll month ──
  const salaryRows = useMemo(() => {
    const eligibleStaff = allStaff.filter(s => {
      const matchSearch = !staffSearch || s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.emp_id?.toLowerCase().includes(staffSearch.toLowerCase());
      const matchWard = selectedWard === 'All Wards' || cleanWard(s.ward || 'Ward 12 (Bank More)') === cleanWard(selectedWard);
      const hasAttendanceThisMonth = salRecs.some(r => r.staff_user_id === s.user_id || (r.emp_id && r.emp_id === s.emp_id));
      return matchSearch && matchWard && (s.active || hasAttendanceThisMonth);
    });

    return eligibleStaff.map(s => {
      const recs = salRecs.filter(r => (r.staff_user_id === s.user_id || (r.emp_id && r.emp_id === s.emp_id)) && r.out_time);
      const totalH = recs.reduce((a, r) => a + Math.min(8, hrs(r.in_time, r.out_time)), 0);
      const full = recs.filter(r => hrs(r.in_time, r.out_time) >= 8).length;
      const sht  = recs.filter(r => hrs(r.in_time, r.out_time) < 8).length;
      const total = recs.reduce((a, r) => a + pay(hrs(r.in_time, r.out_time)), 0);
      return { s, totalH, full, sht, total };
    });
  }, [allStaff, salRecs, staffSearch, selectedWard]);

  const salTotH   = salaryRows.reduce((a, r) => a + r.totalH, 0);
  const salTotF   = salaryRows.reduce((a, r) => a + r.full, 0);
  const salTotPay = salaryRows.reduce((a, r) => a + r.total, 0);

  const isSalLocked = lockedMonths.includes(salMonth);

  function downloadCSV() {
    if (salError) {
      toast.error('Cannot export incomplete or failed payroll report. Please reload records.');
      return;
    }
    const lines = [
      ['Dhanbad Municipal Corporation (DMC) - Payroll Statement'],
      [`Month: ${salMonthLabel} (${salMonth})`, `Status: ${isSalLocked ? 'FINALIZED & LOCKED (Rule 15)' : 'DRAFT (OPEN)'}`, `Exported At: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`],
      [],
      ['Employee ID', 'Name', 'Status', 'Ward', 'Department', 'Full Days (₹450)', 'Short Shifts', 'Total Hours', 'Net Salary INR']
    ];
    salaryRows.forEach(({ s, totalH, full, sht, total }) => {
      lines.push([
        sanitizeCSVCell(s.emp_id),
        sanitizeCSVCell(s.name),
        s.active ? 'Active' : 'Inactive / Former',
        sanitizeCSVCell(s.ward || 'Ward 12'),
        sanitizeCSVCell(s.department || 'Sanitation'),
        full,
        sht,
        totalH.toFixed(2),
        total.toFixed(2)
      ]);
    });
    const csv = '\ufeff' + lines.map(l => l.map(x => `"${sanitizeCSVCell(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `dmc-salary-${salMonth}-${isSalLocked ? 'finalized' : 'draft'}.csv`;
    a.click();
    toast.success(`Sanitized Salary CSV exported (${isSalLocked ? 'Finalized' : 'Draft'})!`);
  }

  // ── Stats Calculations: Reconciled with filtered payroll dataset ──
  const totalFull = salTotF;
  const totalPay  = salTotPay;
  const salMonthLabel = new Date(salMonth + '-01T00:00:00+05:30').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

  const presentPercentage = activeStaff.length > 0
    ? Math.round((filteredTodayRecs.length / activeStaff.length) * 100)
    : 0;

  // ── Today's Unrecorded / Absent Status (Rule 10: Never confuse unrecorded with absent) ──
  const istParts = getISTParts(new Date());
  const istHour = istParts ? Number(istParts.hour) : 0;
  const istMinute = istParts ? Number(istParts.minute) : 0;
  const mins = istHour * 60 + istMinute;
  const inWindow = mins >= 360 && mins <= 480; // 6:00 – 8:00 AM IST
  const istDateObj = istParts ? new Date(`${istParts.year}-${istParts.month}-${istParts.day}T12:00:00+05:30`) : new Date();
  const isSunday = istDateObj.getDay() === 0;

  const presentUserIds = new Set(filteredTodayRecs.map(r => r.staff_user_id));
  const unrecordedStaff = activeStaff.filter(s => !presentUserIds.has(s.user_id));


  if (loading) {
    return (
      <div className="admin-page">
        <Header title="Dhanbad Municipal Corporation" subtitle="Administrative Attendance & Payroll Control" />
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
    { key: 'staff',      label: 'Staff Directory',   sub: 'Active Personnel',      icon: Users,        badge: filteredStaff.length },
    { key: 'today',      label: 'Today Live',        sub: 'Live Operations',      icon: Clock,        badge: filteredTodayRecs.length, badgeColor: 'green' },
    { key: 'records',    label: 'Attendance Logs',   sub: 'Daily Punch Logs',     icon: ClipboardList },
    { key: 'salary',     label: 'Salary & Payroll',  sub: 'Monthly Disbursal',    icon: BarChart3 },
    { key: 'exceptions', label: 'Exceptions & Audits', sub: 'Audit Ledger',       icon: AlertCircle, badge: incompleteShifts.length > 0 ? incompleteShifts.length : undefined, badgeColor: 'amber' },
  ];

  return (
    <div className="admin-layout">
      <Header
        title="Dhanbad Municipal Corporation"
        subtitle="Administrative Attendance & Payroll Control"
      />

      <AnimatePresence>
        {showModal && (
          <AddStaffModal
            onClose={() => setShowModal(false)}
            onAdded={() => { loadStaff(); loadToday(); }}
            existingIds={allStaff.map(s => s.emp_id?.toUpperCase())}
          />
        )}
        {showBulkModal && (
          <BulkStaffModal
            onClose={() => setShowBulkModal(false)}
            onImported={() => { loadStaff(); loadToday(); }}
            existingIds={allStaff.map(s => s.emp_id?.toUpperCase())}
          />
        )}
        {regularizeRec && (
          <RegularizeModal
            record={regularizeRec}
            onClose={() => setRegularizeRec(null)}
            onSaved={() => { loadToday(); loadRecs(recMonth); loadSalary(salMonth); loadCorrections(); }}
            isPeriodLocked={lockedMonths.includes(regularizeRec?.month_key || regularizeRec?.date?.slice(0, 7))}
          />
        )}
        {editingStaff && (
          <EditStaffModal
            staff={editingStaff}
            onClose={() => setEditingStaff(null)}
            onUpdated={() => { loadStaff(); loadToday(); }}
          />
        )}
        {resetPinStaff && (
          <ResetPinModal
            staff={resetPinStaff}
            onClose={() => setResetPinStaff(null)}
            onReset={() => { loadStaff(); }}
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
                    if (item.key === 'exceptions') loadCorrections();
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
                    <span className={`nav-item-badge ${item.badgeColor === 'green' ? 'badge-green' : item.badgeColor === 'amber' ? 'badge-amber' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button
                className="btn btn-outline w-full"
                onClick={() => setShowBulkModal(true)}
              >
                <Upload size={15} />
                <span>Import Staff (CSV)</span>
              </button>
              <button
                className="btn btn-primary w-full"
                onClick={() => setShowModal(true)}
              >
                <Plus size={16} />
                <span>Add Staff</span>
              </button>
            </div>
            <div className="sidebar-status-box" style={{ marginTop: '14px' }}>
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
                    if (item.key === 'exceptions') loadCorrections();
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
                  {tab === 'exceptions' && 'Attendance Exceptions & Audit Ledger'}
                </h2>
                <p className="dashboard-subtitle">
                  {tab === 'staff' && 'Manage registered staff members and credentials'}
                  {tab === 'today' && `Live status for ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
                  {tab === 'records' && 'Complete daily audit logs for check-ins and check-outs'}
                  {tab === 'salary' && `Calculated compensation for ${salMonthLabel}`}
                  {tab === 'exceptions' && 'Unclosed shifts, missing punches, and regularization audit records'}
                </p>
              </div>

              <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Global Ward Filter */}
                <div className="custom-select-wrap">
                  <Building2 size={14} className="custom-select-icon" />
                  <select
                    className="custom-select"
                    style={{ minWidth: '150px' }}
                    value={selectedWard}
                    onChange={e => setSelectedWard(e.target.value)}
                    aria-label="Filter by Ward"
                  >
                    <option value="All Wards">All Wards (DMC)</option>
                    {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <ChevronDown size={14} className="custom-select-chevron" />
                </div>

                {tab === 'salary' && (
                  <button className="btn btn-outline" onClick={downloadCSV}>
                    <FileSpreadsheet size={15} />
                    <span>Export CSV</span>
                  </button>
                )}
                <button className="btn btn-outline" onClick={() => setShowBulkModal(true)}>
                  <Upload size={15} />
                  <span>Import CSV</span>
                </button>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                  <Plus size={16} />
                  <span>Add Staff</span>
                </button>
              </div>
            </motion.div>

            {/* ── 4 KPI Metric Cards with Spatial 3D Tilt ── */}
            <motion.div className="metrics-grid" variants={fadeUp}>
              <SpatialCard maxTilt={5} depth={8}>
                <div className="metric-card metric-navy">
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
                </div>
              </SpatialCard>

              <SpatialCard maxTilt={5} depth={8}>
                <div className="metric-card metric-green">
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
                </div>
              </SpatialCard>

              <SpatialCard maxTilt={5} depth={8}>
                <div className="metric-card metric-saff">
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
                </div>
              </SpatialCard>

              <SpatialCard maxTilt={5} depth={8}>
                <div className="metric-card metric-blue">
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
                </div>
              </SpatialCard>
            </motion.div>


            {/* ── Tab Panels Content ── */}
            <AnimatePresence mode="wait">
              {/* 1. Staff Directory Tab */}
              {tab === 'staff' && (
                <motion.div key="staff" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header">
                    <div>
                      <h3 className="panel-card-title">Staff Members</h3>
                      <p className="panel-card-subtitle">Municipal sanitation & field staff management</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
                        <input
                          type="checkbox"
                          checked={showInactiveStaff}
                          onChange={e => setShowInactiveStaff(e.target.checked)}
                        />
                        <span>Show Inactive ({allStaff.filter(s => s.active === false).length})</span>
                      </label>
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
                  </div>

                  <div className="table-responsive">
                    <div className="table-scroll-hint">
                      <span>← Swipe horizontally to view full table →</span>
                    </div>
                    <table className="modern-table desktop-table-view">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>ID / Code</th>
                          <th>Status</th>
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
                            <tr key={s.id} style={s.active === false ? { opacity: 0.75, backgroundColor: 'rgba(0,0,0,0.015)' } : {}}>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar" style={s.active === false ? { background: '#cbd5e1', color: '#475569' } : {}}>
                                    {getInitials(s.name)}
                                  </div>
                                  <div>
                                    <div className="user-name">
                                      {s.name} {s.active === false && <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>(Inactive)</span>}
                                    </div>
                                    <div className="user-meta">{s.department || 'Sanitation'} · {cleanWard(s.ward) || 'Ward 12'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="id-badge">{s.emp_id}</span>
                              </td>
                              <td>
                                {s.active === false ? (
                                  <span className="status-badge badge-neutral" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
                                    Inactive
                                  </span>
                                ) : isPresent ? (
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
                                <div className="actions-group">
                                  <button
                                    className="btn-icon-neutral"
                                    onClick={() => setEditingStaff(s)}
                                    title={`Edit profile for ${s.name}`}
                                  >
                                    <Edit3 size={13} />
                                    <span className="btn-icon-label">Edit</span>
                                  </button>

                                  <button
                                    className="btn-icon-neutral"
                                    onClick={() => setResetPinStaff(s)}
                                    title={`Reset login PIN for ${s.name}`}
                                  >
                                    <KeyRound size={13} />
                                    <span className="btn-icon-label">Reset PIN</span>
                                  </button>

                                  {s.active === false ? (
                                    <button
                                      className="btn-icon-primary"
                                      onClick={() => toggleStaffStatus(s.id, s.name, false)}
                                      title={`Reactivate ${s.name}`}
                                      style={{ color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
                                    >
                                      <CheckCircle2 size={13} />
                                      <span className="btn-icon-label" style={{ color: '#16a34a' }}>Reactivate</span>
                                    </button>
                                  ) : (
                                    <button
                                      className="btn-icon-danger"
                                      onClick={() => toggleStaffStatus(s.id, s.name, true)}
                                      title={`Deactivate ${s.name}`}
                                    >
                                      <Trash2 size={13} />
                                      <span className="btn-icon-label">Deactivate</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Staff Cards List (Stitch Mobile Spec — Visible <= 768px) */}
                  <div className="mobile-staff-cards-list">
                    {filteredStaff.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 16px' }}>
                        <Users size={32} className="empty-icon" />
                        <p>No staff members found matching "{staffSearch}"</p>
                      </div>
                    ) : (
                      filteredStaff.map(s => {
                        const isPresent = todayRecs.some(r => r.staff_user_id === s.user_id);
                        return (
                          <div key={`mob-staff-${s.id}`} className="mob-admin-card" style={s.active === false ? { opacity: 0.75 } : {}}>
                            <div className="mob-admin-card-header">
                              <div className="user-cell">
                                <div className="user-avatar" style={s.active === false ? { background: '#cbd5e1', color: '#475569' } : {}}>
                                  {getInitials(s.name)}
                                </div>
                                <div>
                                  <div className="user-name">
                                    {s.name} {s.active === false && <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>(Inactive)</span>}
                                  </div>
                                  <div className="user-meta">{s.department || 'Sanitation'} · {cleanWard(s.ward) || 'Ward 12'}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <span className="id-badge">{s.emp_id}</span>
                                {s.active === false ? (
                                  <span className="status-badge badge-neutral" style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
                                    Inactive
                                  </span>
                                ) : isPresent ? (
                                  <span className="status-badge badge-success">
                                    <span className="badge-dot" /> Present Today
                                  </span>
                                ) : (
                                  <span className="status-badge badge-neutral">
                                    Absent
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mob-admin-actions-bar">
                              <button
                                className="btn-icon-neutral mob-admin-action-btn"
                                onClick={() => setEditingStaff(s)}
                                title={`Edit profile for ${s.name}`}
                              >
                                <Edit3 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="btn-icon-neutral mob-admin-action-btn"
                                onClick={() => setResetPinStaff(s)}
                                title={`Reset login PIN for ${s.name}`}
                              >
                                <KeyRound size={13} />
                                <span>Reset PIN</span>
                              </button>
                              {s.active === false ? (
                                <button
                                  className="btn-icon-primary mob-admin-action-btn"
                                  onClick={() => toggleStaffStatus(s.id, s.name, false)}
                                  title={`Reactivate ${s.name}`}
                                  style={{ color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Reactivate</span>
                                </button>
                              ) : (
                                <button
                                  className="btn-icon-danger mob-admin-action-btn"
                                  onClick={() => toggleStaffStatus(s.id, s.name, true)}
                                  title={`Deactivate ${s.name}`}
                                >
                                  <Trash2 size={13} />
                                  <span>Deactivate</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
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
                      <span>{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <div className="table-scroll-hint">
                      <span>← Swipe horizontally to view full table →</span>
                    </div>
                    <table className="modern-table desktop-table-view">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Total Hours</th>
                          <th>Status</th>
                          <th className="text-right">Compensation</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTodayRecs.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={7}>
                              <div className="empty-state">
                                <Clock size={32} className="empty-icon" />
                                <p>No check-in records logged yet today for the selected filter.</p>
                              </div>
                            </td>
                          </tr>
                        ) : filteredTodayRecs.map(r => {
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
                                    <div className="user-meta">{r.emp_id} • {cleanWard(r.ward) || 'Ward 12'}</div>
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
                              <td className="text-right">
                                <button
                                  className="btn-icon-primary"
                                  onClick={() => setRegularizeRec(r)}
                                  title="Regularize or correct punch times"
                                >
                                  <Edit3 size={13} />
                                  <span>Regularize</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Today Shift Cards (Stitch Mobile Spec — Visible <= 768px) */}
                  <div className="mobile-today-cards-list">
                    {filteredTodayRecs.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 16px' }}>
                        <Clock size={32} className="empty-icon" />
                        <p>No check-in records logged yet today for the selected filter.</p>
                      </div>
                    ) : (
                      filteredTodayRecs.map(r => {
                        const h = hrs(r.in_time, r.out_time);
                        const st = !r.out_time ? 'On Duty' : h >= 8 ? 'Full Shift' : 'Short Shift';
                        const badgeCls = !r.out_time ? 'badge-warning' : h >= 8 ? 'badge-success' : 'badge-amber';
                        return (
                          <div key={`mob-today-${r.id}`} className="mob-admin-card">
                            <div className="mob-admin-card-header">
                              <div className="user-cell">
                                <div className="user-avatar">{(r.staff_name || '?')[0].toUpperCase()}</div>
                                <div>
                                  <div className="user-name">{r.staff_name}</div>
                                  <div className="user-meta">{r.emp_id} • {cleanWard(r.ward) || 'Ward 12'}</div>
                                </div>
                              </div>
                              <span className={`status-badge ${badgeCls}`}>
                                <span className="badge-dot" /> {st}
                              </span>
                            </div>
                            <div className="mob-admin-times-row">
                              <div>
                                <span className="mob-time-lbl">Check In</span>
                                <span className="mob-time-val font-mono">{fmtT(r.in_time)}</span>
                              </div>
                              <span className="mob-time-arrow">➔</span>
                              <div>
                                <span className="mob-time-lbl">Check Out</span>
                                <span className="mob-time-val font-mono">{fmtT(r.out_time)}</span>
                              </div>
                              <div>
                                <span className="mob-time-lbl">Hours</span>
                                <span className="mob-time-val">{r.out_time ? `${h.toFixed(1)}h` : 'Live'}</span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span className="mob-time-lbl">Earned</span>
                                <span className="mob-time-val font-semibold text-emerald">{r.out_time ? money(pay(h)) : '—'}</span>
                              </div>
                            </div>
                            <div className="mob-admin-footer-btn-row">
                              <button
                                className="btn btn-outline w-full"
                                style={{ minHeight: '38px', fontSize: '0.78rem', justifyContent: 'center' }}
                                onClick={() => setRegularizeRec(r)}
                              >
                                <Edit3 size={13} />
                                <span>Regularize Punch</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Absent / Unrecorded Staff Section (Rule 10: Distinguish missing from absent) */}
                  <div className="absent-card">
                    <div className="absent-card-header">
                      <div className="absent-card-title">
                        <UserX size={16} />
                        <span>
                          {isSunday
                            ? `Weekly Off / Sunday (${unrecordedStaff.length})`
                            : inWindow
                              ? `Pending Punch — Check-in Window Open (${unrecordedStaff.length})`
                              : `Unrecorded / Absent Today (${unrecordedStaff.length})`}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {inWindow ? 'Window closes at 08:00 AM IST' : 'Attendance verified against roster'}
                      </span>
                    </div>
                    <div className="absent-card-body">
                      {unrecordedStaff.length === 0 ? (
                        <div className="all-present-msg">
                          <CheckCircle2 size={16} />
                          <span>100% staff attendance today!</span>
                        </div>
                      ) : (
                        <div className="absent-chips-grid">
                          {unrecordedStaff.map(s => (
                            <div key={s.id} className="absent-chip">
                              <span className="absent-avatar">{getInitials(s.name)}</span>
                              <span className="absent-name">{s.name}</span>
                              <span className="absent-id">{s.emp_id} • {cleanWard(s.ward) || 'Ward 12'}</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 className="panel-card-title">Attendance Logs</h3>
                        <span className="id-badge font-mono" style={{ fontSize: '0.72rem', color: '#475569' }}>
                          {filteredRecs.length} {filteredRecs.length === 1 ? 'Record' : 'Records'}
                        </span>
                      </div>
                      <p className="panel-card-subtitle">Historical check-in/out records with correction tags</p>
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

                      <div className="filters-dropdowns-group">
                        <div className="custom-select-wrap">
                          <Calendar size={14} className="custom-select-icon" />
                          <select
                            className="custom-select"
                            value={recMonth}
                            onChange={e => setRecMonth(e.target.value)}
                            aria-label="Filter by month"
                          >
                            {MONTHS.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                          {recsLoading ? (
                            <RefreshCw size={12} className="spin custom-select-chevron" style={{ color: '#2563eb' }} />
                          ) : (
                            <ChevronDown size={14} className="custom-select-chevron" />
                          )}
                        </div>

                        <div className="custom-select-wrap">
                          <Filter size={14} className="custom-select-icon" />
                          <select
                            className="custom-select"
                            value={recStatus}
                            onChange={e => setRecStatus(e.target.value)}
                            aria-label="Filter by shift status"
                          >
                            <option value="">All Shifts</option>
                            <option value="Full Shift">Full Shift (8h+)</option>
                            <option value="Short Shift">Short Shift (&lt;8h)</option>
                            <option value="On Duty">On Duty (Open)</option>
                          </select>
                          <ChevronDown size={14} className="custom-select-chevron" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {recsError && (
                    <div className="hint-box" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', margin: '0 0 16px 0' }}>
                      <AlertCircle size={15} />
                      <span><strong>Data Retrieval Failure:</strong> {recsError}. Results are incomplete. Please refresh to reload.</span>
                    </div>
                  )}

                  <div className="table-responsive">
                    <div className="table-scroll-hint">
                      <span>← Swipe horizontally to view full log details →</span>
                    </div>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Ward</th>
                          <th>In Time</th>
                          <th>Out Time</th>
                          <th>Hours</th>
                          <th>Shift Status</th>
                          <th className="text-right">Earned</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecs.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={9}>
                              <div className="empty-state">
                                {recsError ? (
                                  <>
                                    <AlertCircle size={32} className="empty-icon" style={{ color: '#dc2626' }} />
                                    <p style={{ color: '#dc2626' }}>Failed to load attendance logs: {recsError}. Please refresh or try again.</p>
                                  </>
                                ) : (
                                  <>
                                    <ClipboardList size={32} className="empty-icon" />
                                    <p>No records found for the selected filter criteria.</p>
                                  </>
                                )}
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
                                  {r.is_corrected && (
                                    <span className="status-badge badge-purple" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                                      Corrected
                                    </span>
                                  )}
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
                              <td><span className="id-badge">{cleanWard(r.ward) || 'Ward 12'}</span></td>
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
                              <td className="text-right">
                                <button
                                  className="btn-icon-primary"
                                  onClick={() => setRegularizeRec(r)}
                                  title="Regularize or correct punch times"
                                >
                                  <Edit3 size={13} />
                                  <span>Regularize</span>
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

              {/* 4. Salary & Payroll Tab */}
              {tab === 'salary' && (
                <motion.div key="salary" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header flex-wrap">
                    <div>
                      <h3 className="panel-card-title">Salary & Payroll</h3>
                      <p className="panel-card-subtitle">Monthly calculated wages based on verified shifts (₹450/8h rate)</p>
                    </div>
                    <div className="filters-row">
                      <div className="custom-select-wrap">
                        <Calendar size={14} className="custom-select-icon" />
                        <select
                          className="custom-select"
                          value={salMonth}
                          onChange={e => setSalMonth(e.target.value)}
                          aria-label="Payroll Month"
                        >
                          {MONTHS.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                        {salLoading ? (
                          <RefreshCw size={12} className="spin custom-select-chevron" style={{ color: '#2563eb' }} />
                        ) : (
                          <ChevronDown size={14} className="custom-select-chevron" />
                        )}
                      </div>
                      <button
                        className={`btn ${isSalLocked ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => toggleLockMonth(salMonth)}
                        title={isSalLocked ? 'Reopen month for adjustments' : 'Finalize and lock month against edits'}
                      >
                        {isSalLocked ? <Unlock size={14} color="#d97706" /> : <Lock size={14} />}
                        <span>{isSalLocked ? 'Reopen Month' : 'Finalize & Lock'}</span>
                      </button>
                      <button className="btn btn-outline" onClick={downloadCSV}>
                        <FileSpreadsheet size={15} />
                        <span>Export CSV</span>
                      </button>
                    </div>
                  </div>

                  {isSalLocked && (
                    <div className="hint-box" style={{ backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c', margin: '0 0 16px 0' }}>
                      <Lock size={15} />
                      <span><strong>Period Finalized (Rule 15):</strong> {salMonthLabel} attendance is officially locked for municipal payroll processing. Any manual modifications require administrative audit logging.</span>
                    </div>
                  )}

                  {salError && (
                    <div className="hint-box" style={{ backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', margin: '0 0 16px 0' }}>
                      <AlertCircle size={15} />
                      <span><strong>Data Retrieval Failure:</strong> {salError}. Payroll results are incomplete. Please refresh to reload.</span>
                    </div>
                  )}

                  {/* Summary Bar */}
                  <div className="salary-summary-grid">
                    <div className="sal-stat-card">
                      <div className="sal-stat-header">
                        <span className="sal-stat-label">Active Staff</span>
                        <div className="sal-stat-icon icon-navy">
                          <Users size={15} />
                        </div>
                      </div>
                      <div className="sal-stat-val">
                        <AnimatedNumber value={filteredStaff.length} />
                      </div>
                      <span className="sal-stat-sub">Enrolled for payroll</span>
                    </div>

                    <div className="sal-stat-card">
                      <div className="sal-stat-header">
                        <span className="sal-stat-label">Full Shifts (8h)</span>
                        <div className="sal-stat-icon icon-emerald">
                          <CheckCircle2 size={15} />
                        </div>
                      </div>
                      <div className="sal-stat-val">
                        <AnimatedNumber value={salTotF} />
                      </div>
                      <span className="sal-stat-sub">Rule 14 verified</span>
                    </div>

                    <div className="sal-stat-card">
                      <div className="sal-stat-header">
                        <span className="sal-stat-label">Total Hours</span>
                        <div className="sal-stat-icon icon-amber">
                          <Clock size={15} />
                        </div>
                      </div>
                      <div className="sal-stat-val">
                        <AnimatedNumber value={salTotH} suffix="h" decimals={1} />
                      </div>
                      <span className="sal-stat-sub">Recorded work hours</span>
                    </div>

                    <div className="sal-stat-card highlight">
                      <div className="sal-stat-header">
                        <span className="sal-stat-label">Total Payroll</span>
                        <div className="sal-stat-icon icon-primary">
                          <IndianRupee size={15} />
                        </div>
                      </div>
                      <div className="sal-stat-val">
                        <AnimatedNumber value={salTotPay} prefix="₹" decimals={0} />
                      </div>
                      <span className="sal-stat-sub">Net payable (DMC)</span>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <div className="table-scroll-hint">
                      <span>← Swipe horizontally to view full payroll table →</span>
                    </div>
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Emp ID</th>
                          <th>Ward</th>
                          <th>Full Days (₹450)</th>
                          <th>Short Shifts</th>
                          <th>Total Hours</th>
                          <th className="text-right">Net Payable / वेतन</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salaryRows.length === 0 ? (
                          <tr className="empty-row">
                            <td colSpan={7}>
                              <div className="empty-state">
                                {salError ? (
                                  <>
                                    <AlertCircle size={32} className="empty-icon" style={{ color: '#dc2626' }} />
                                    <p style={{ color: '#dc2626' }}>Failed to load payroll records: {salError}. Please refresh or try again.</p>
                                  </>
                                ) : (
                                  <>
                                    <IndianRupee size={32} className="empty-icon" />
                                    <p>No salary data found for {salMonthLabel}.</p>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : salaryRows.map(({ s, totalH, full, sht, total }) => (
                          <tr key={s.id}>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar">{getInitials(s.name)}</div>
                                <div>
                                  <div className="user-name">
                                    {s.name} {s.active === false && <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>(Inactive)</span>}
                                  </div>
                                  <div className="user-meta">{s.department || 'Sanitation'}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="id-badge">{s.emp_id}</span></td>
                            <td><span className="id-badge">{cleanWard(s.ward) || 'Ward 12'}</span></td>
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

              {/* 5. Exceptions & Audit Ledger Tab (Module 19 & Module 5) */}
              {tab === 'exceptions' && (
                <motion.div key="exceptions" className="panel-card" variants={tabPanelVariant} initial="hidden" animate="visible" exit="exit">
                  <div className="panel-card-header flex-wrap">
                    <div>
                      <h3 className="panel-card-title">Attendance Exceptions & Compliance Audit Ledger</h3>
                      <p className="panel-card-subtitle">Unclosed shifts requiring resolution and permanent audit history</p>
                    </div>
                    <button className="btn btn-outline" onClick={loadCorrections}>
                      <RefreshCw size={14} />
                      <span>Refresh Ledger</span>
                    </button>
                  </div>

                  {/* Section A: Unclosed Shifts (Missing Punch) */}
                  <div style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <AlertCircle size={17} color="#d97706" />
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#1e293b' }}>
                        Incomplete Shifts / Missing Check-Outs ({incompleteShifts.length})
                      </h4>
                    </div>

                    {incompleteShifts.length === 0 ? (
                      <div className="hint-box" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}>
                        <CheckCircle2 size={16} />
                        <span>All past shifts have verified check-ins and check-outs. No unresolved punches!</span>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="modern-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Employee</th>
                              <th>In Time</th>
                              <th>Exception State</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {incompleteShifts.map(r => (
                              <tr key={r.id}>
                                <td><span className="font-semibold">{r.date}</span></td>
                                <td>
                                  <div className="user-cell">
                                    <div className="user-avatar">{(r.staff_name || '?')[0].toUpperCase()}</div>
                                    <div>
                                      <div className="user-name">{r.staff_name}</div>
                                      <div className="user-meta">{r.emp_id} • {cleanWard(r.ward) || 'Ward 12'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="font-mono">{fmtT(r.in_time)}</td>
                                <td>
                                  <span className="status-badge badge-amber">
                                    <AlertCircle size={12} /> Missing Exit Punch
                                  </span>
                                </td>
                                <td className="text-right">
                                  <button
                                    className="btn-icon-primary"
                                    onClick={() => setRegularizeRec(r)}
                                  >
                                    <Edit3 size={13} />
                                    <span>Regularize Exit Punch</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section B: Audit Log Ledger */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <ClipboardList size={17} color="#1d4ed8" />
                      <h4 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#1e293b' }}>
                        Permanent Correction Audit Trail ({corrections.length} Entries)
                      </h4>
                    </div>

                    {corrections.length === 0 ? (
                      <div className="hint-box">
                        <span>No historical corrections recorded yet.</span>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="modern-table" style={{ fontSize: '0.82rem' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '170px', whiteSpace: 'nowrap' }}>Timestamp</th>
                              <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Employee</th>
                              <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Correction Type</th>
                              <th style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Punches (Before → After)</th>
                              <th style={{ minWidth: '200px' }}>Mandatory Reason</th>
                              <th style={{ minWidth: '100px', whiteSpace: 'nowrap' }}>Approver</th>
                            </tr>
                          </thead>
                          <tbody>
                            {corrections.map(c => (
                              <tr key={c.id}>
                                <td className="font-mono" style={{ fontSize: '0.76rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {fmtAuditTimestamp(c.created_at)}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <strong style={{ color: '#0f172a' }}>{c.staff_name}</strong>
                                  <div className="font-mono" style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.emp_id}</div>
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <span className="status-badge badge-purple" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                    {c.correction_type}
                                  </span>
                                </td>
                                <td className="font-mono" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                  {fmtT(c.old_in_time)} – {fmtT(c.old_out_time)}
                                  <span style={{ margin: '0 6px', color: '#16a34a', fontWeight: 700 }}>→</span>
                                  {fmtT(c.new_in_time)} – {fmtT(c.new_out_time)}
                                </td>
                                <td>
                                  <span style={{ color: '#334155' }}>"{c.reason}"</span>
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <span className="id-badge font-mono">{c.corrected_by || 'Admin'}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
