import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  Building2,
  Lock,
  AlertCircle,
  RefreshCw,
} from '../components/Icons';
import './LoginPage.css';

export default function LoginPage() {
  const [role, setRole] = useState('staff');
  const [staffId, setStaffId] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errKey = useRef(0);

  function showErr(msg) {
    errKey.current += 1;
    setError(msg);
  }

  async function doStaffLogin(e) {
    e.preventDefault();
    const id = staffId.trim().toUpperCase();
    const pin = staffPin;
    if (!id || !pin) { showErr('Please enter both Employee ID and PIN.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${id.toLowerCase()}@dmc.org`,
        password: pin,
      });
      if (error) throw error;
    } catch (e) {
      showErr('Invalid Employee ID or PIN. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function doAdminLogin(e) {
    e.preventDefault();
    const user = adminUser.trim();
    const pass = adminPass;
    if (!user || !pass) { showErr('Please enter both username and password.'); return; }
    setLoading(true); setError('');
    try {
      const email = user.includes('@')
        ? user.toLowerCase()
        : user.toLowerCase() === 'admin'
          ? 'admin@nagarnigam.local'
          : `${user.toLowerCase()}@nagarnigam.local`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      const { data: profile } = await supabase.from('staff').select('role').eq('user_id', data.user.id).single();
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrative access.');
      }
    } catch (e) {
      showErr(e.message?.includes('Invalid') ? 'Invalid administrator credentials.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
  };
  const formVariants = {
    hidden: { opacity: 0, x: role === 'staff' ? -16 : 16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: role === 'staff' ? 16 : -16, transition: { duration: 0.15 } },
  };

  return (
    <div className="login-wrapper">
      {/* Background Gradients */}
      <div className="login-bg-glow glow-top" />
      <div className="login-bg-glow glow-bottom" />

      <motion.div
        className="login-card-container"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="tristrip" />

        <div className="login-card-content">
          {/* Header Branding */}
          <div className="login-brand-header">
            <div className="login-logo-container">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="DMC Logo"
                className="login-emblem"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <h1 className="login-title-hi">धनबाद नगर निगम</h1>
            <h2 className="login-title-en">Dhanbad Municipal Corporation</h2>
            <div className="login-portal-badge">
              <Building2 size={13} />
              <span>Attendance & Payroll System</span>
            </div>
          </div>

          {/* Role Selection Tabs */}
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab-btn ${role === 'staff' ? 'active' : ''}`}
              onClick={() => { setRole('staff'); setError(''); }}
            >
              <User size={15} />
              <span>Staff / कर्मचारी</span>
            </button>
            <button
              type="button"
              className={`login-tab-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >
              <ShieldCheck size={15} />
              <span>Administrator</span>
            </button>
          </div>

          {/* Error Message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={errKey.current}
                className="login-alert-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <AlertCircle size={16} className="alert-icon" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Switcher */}
          <AnimatePresence mode="wait">
            {role === 'staff' ? (
              <motion.form
                key="staff"
                onSubmit={doStaffLogin}
                className="login-fields"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="field-group">
                  <label className="field-label">Employee ID / कर्मचारी क्रमांक</label>
                  <div className="field-input-box">
                    <User size={16} className="field-icon" />
                    <input
                      type="text"
                      className="field-input font-mono"
                      placeholder="e.g. EMP001"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                      autoCapitalize="characters"
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Login PIN / पिन</label>
                  <div className="field-input-box">
                    <KeyRound size={16} className="field-icon" />
                    <input
                      type={showPin ? 'text' : 'password'}
                      className="field-input font-mono"
                      placeholder="• • • •"
                      maxLength={8}
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value)}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="field-eye-btn"
                      onClick={() => setShowPin(v => !v)}
                      aria-label="Toggle PIN visibility"
                    >
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={16} className="spin" /> : <ArrowRight size={16} />}
                  <span>{loading ? 'Verifying...' : 'Sign In as Staff'}</span>
                </button>

                <p className="login-help-text">
                  PIN forgot or need access? Contact the Municipal Admin.
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="admin"
                onSubmit={doAdminLogin}
                className="login-fields"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="field-group">
                  <label className="field-label">Admin Username or Email</label>
                  <div className="field-input-box">
                    <ShieldCheck size={16} className="field-icon" />
                    <input
                      type="text"
                      className="field-input"
                      placeholder="admin"
                      value={adminUser}
                      onChange={e => setAdminUser(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">Admin Password</label>
                  <div className="field-input-box">
                    <Lock size={16} className="field-icon" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="field-input"
                      placeholder="••••••••"
                      value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                    />
                    <button
                      type="button"
                      className="field-eye-btn"
                      onClick={() => setShowPass(v => !v)}
                      aria-label="Toggle password visibility"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-submit-btn admin-submit-btn"
                  disabled={loading}
                >
                  {loading ? <RefreshCw size={16} className="spin" /> : <ArrowRight size={16} />}
                  <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="login-card-footer">
          <span>Official Portal &nbsp;•&nbsp; Dhanbad Municipal Corporation</span>
        </div>
      </motion.div>
    </div>
  );
}
