import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { GlassInputWrapper, FeatureCard } from '../components/ui/sign-in';
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
  CheckCircle2,
  IndianRupee,
  Clock,
  Sparkles,
} from '../components/Icons';
import { springPhysics } from '../lib/animations';
import './LoginPage.css';

export default function LoginPage() {
  const [role, setRole] = useState('staff');
  const [staffId, setStaffId] = useState(() => localStorage.getItem('dmc_last_staff_id') || 'EMP001');
  const [staffPin, setStaffPin] = useState('');
  const [adminUser, setAdminUser] = useState(() => localStorage.getItem('dmc_last_admin_user') || 'admin');
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
      localStorage.setItem('dmc_last_staff_id', id);
    } catch (e) {
      showErr('Invalid Employee ID or PIN. Please verify your credentials.');
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
      localStorage.setItem('dmc_last_admin_user', user);
      const { data: profile } = await supabase.from('staff').select('role').eq('user_id', data.user.id).single();
      if (profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrator privileges.');
      }
    } catch (e) {
      showErr(e.message?.includes('Invalid') ? 'Invalid administrator credentials.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-page-layout">
      {/* ── Left Column: Sign-in Form ── */}
      <section className="signin-form-section">
        <div className="signin-form-wrapper">
          {/* Brand Row */}
          <div className="signin-brand-row">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="DMC Logo"
              className="signin-brand-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div>
              <div className="signin-org-title">धनबाद नगर निगम</div>
              <div className="signin-org-subtitle">Dhanbad Municipal Corporation</div>
            </div>
          </div>

          <div className="signin-headings">
            <h1 className="signin-main-title">
              Sign In <span className="text-highlight">/ प्रवेश</span>
            </h1>
            <p className="signin-description">
              Access employee daily attendance and municipal payroll administration
            </p>
          </div>

          {/* Reciprocity & Loss Aversion Live Utility Banner */}
          <div className="signin-utility-banner">
            <div className="utility-banner-row">
              <span className="utility-badge-pulse" />
              <span className="utility-badge-text">Shift Window: 6:00 – 8:00 AM IST • Rate: ₹450/8h</span>
            </div>
            <div className="utility-banner-sub">
              Log in before 8:00 AM to prevent losing today's full shift attendance credit.
            </div>
          </div>

          {/* Role Tabs */}
          <div className="signin-role-tabs">
            <button
              type="button"
              className={`signin-role-btn ${role === 'staff' ? 'active' : ''}`}
              onClick={() => { setRole('staff'); setError(''); }}
            >
              <User size={16} />
              <span>Staff / कर्मचारी</span>
            </button>
            <button
              type="button"
              className={`signin-role-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >
              <ShieldCheck size={16} />
              <span>Administrator</span>
            </button>
          </div>

          {/* Alert Error */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={errKey.current}
                className="signin-alert-err"
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

          {/* Dynamic Form */}
          <AnimatePresence mode="wait">
            {role === 'staff' ? (
              <motion.form
                key="staff"
                onSubmit={doStaffLogin}
                className="signin-form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
              >
                <div className="signin-field-group">
                  <label className="signin-field-label">Employee ID / कर्मचारी क्रमांक</label>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <User size={17} className="glass-input-icon" />
                      <input
                        type="text"
                        className="glass-input font-mono"
                        placeholder="e.g. EMP001"
                        value={staffId}
                        onChange={e => setStaffId(e.target.value)}
                        autoCapitalize="characters"
                        autoComplete="username"
                        spellCheck={false}
                        autoFocus
                      />
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-field-group">
                  <label className="signin-field-label">Login PIN / 4-अंकीय पिन</label>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <KeyRound size={17} className="glass-input-icon" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        className="glass-input font-mono"
                        placeholder="• • • •"
                        maxLength={8}
                        value={staffPin}
                        onChange={e => setStaffPin(e.target.value)}
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        className="glass-eye-toggle"
                        onClick={() => setShowPin(v => !v)}
                        aria-label="Toggle PIN visibility"
                      >
                        {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-options-row">
                  <label className="signin-checkbox-label">
                    <input type="checkbox" defaultChecked className="signin-checkbox" />
                    <span>Remember on this device</span>
                  </label>
                  <span className="signin-help-link">Window: 6:00 – 8:00 AM</span>
                </div>

                <motion.button
                  type="submit"
                  className="signin-submit-btn"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={springPhysics.snappy}
                >
                  {loading ? <RefreshCw size={17} className="spin" /> : <ArrowRight size={17} />}
                  <span>{loading ? 'Authenticating...' : 'Sign In as Staff'}</span>
                </motion.button>

                <p className="signin-footnote">
                  Forgot PIN or not registered? Contact the DMC Administrator.
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="admin"
                onSubmit={doAdminLogin}
                className="signin-form"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
              >
                <div className="signin-field-group">
                  <label className="signin-field-label">Administrator Username or Email</label>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <ShieldCheck size={17} className="glass-input-icon" />
                      <input
                        type="text"
                        className="glass-input"
                        placeholder="admin"
                        value={adminUser}
                        onChange={e => setAdminUser(e.target.value)}
                        autoComplete="username"
                        autoFocus
                      />
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-field-group">
                  <label className="signin-field-label">Admin Password</label>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <Lock size={17} className="glass-input-icon" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        className="glass-input"
                        placeholder="••••••••"
                        value={adminPass}
                        onChange={e => setAdminPass(e.target.value)}
                      />
                      <button
                        type="button"
                        className="glass-eye-toggle"
                        onClick={() => setShowPass(v => !v)}
                        aria-label="Toggle password visibility"
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-options-row">
                  <label className="signin-checkbox-label">
                    <input type="checkbox" defaultChecked className="signin-checkbox" />
                    <span>Keep admin session</span>
                  </label>
                  <span className="signin-help-link">Secure Portal Access</span>
                </div>

                <motion.button
                  type="submit"
                  className="signin-submit-btn admin-theme-btn"
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={springPhysics.snappy}
                >
                  {loading ? <RefreshCw size={17} className="spin" /> : <ArrowRight size={17} />}
                  <span>{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Right Column: Hero Showcase + Floating Feature Cards ── */}
      <section className="signin-hero-section">
        <div className="signin-hero-bg">
          <div className="hero-gradient-overlay" />

          {/* Top Emblem Badge */}
          <div className="hero-top-badge">
            <span className="hero-badge-dot" />
            <span>Official Government Portal • Dhanbad</span>
          </div>

          {/* Floating Testimonial / System Highlights (from 21st.dev template) */}
          <div className="floating-features-container">
            <FeatureCard
              icon={CheckCircle2}
              title="Daily Attendance"
              handle="@realtime-sync"
              text="Mandatory 6:00 to 8:00 AM check-in window with instant shift verification."
              delay="card-delay-1"
            />
            <FeatureCard
              icon={IndianRupee}
              title="Automated Payroll"
              handle="@fair-wages"
              text="Calculates ₹450 daily rate for verified 8-hour shifts with one-click CSV export."
              delay="card-delay-2"
            />
            <FeatureCard
              icon={Building2}
              title="Civic Sanitation"
              handle="@dmc-operations"
              text="Empowering municipal staff and administrators with transparent record keeping."
              delay="card-delay-3"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
