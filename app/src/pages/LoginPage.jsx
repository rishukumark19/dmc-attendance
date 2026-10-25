import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { GlassInputWrapper, FeatureCard } from '../components/ui/sign-in';
import SpatialCard from '../components/SpatialCard';
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
  Fingerprint,
  Check,
  MapPin,
  Activity,
  Zap,
  Radio,
  FileCheck2,
} from 'lucide-react';
import InteractiveDotGrid from '../components/InteractiveDotGrid';
import HeroAmbientGlow from '../components/HeroAmbientGlow';
import { springPhysics } from '../lib/animations';
import './LoginPage.css';

export default function LoginPage() {
  const [role, setRole] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin') return 'admin';
      return 'staff'; // Default to staff so municipal workers can immediately log in
    } catch (e) {
      return 'staff';
    }
  });
  const [staffId, setStaffId] = useState(() => localStorage.getItem('dmc_last_staff_id') || '');
  const [staffPin, setStaffPin] = useState('');
  const [adminUser, setAdminUser] = useState(() => localStorage.getItem('dmc_last_admin_user') || 'admin');
  const [adminPass, setAdminPass] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errKey = useRef(0);

  React.useEffect(() => {
    try {
      if (window.location.search.includes('view=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {}
  }, []);

  function showErr(msg) {
    errKey.current += 1;
    setError(msg);
  }

  function handleRoleChange(newRole) {
    setRole(newRole);
    setError('');
    try {
      localStorage.setItem('dmc_last_login_role', newRole);
    } catch (e) {}
  }

  async function doStaffLogin(e) {
    e.preventDefault();
    const raw = staffId.trim();
    const pin = staffPin.trim();
    if (!raw || !pin) { showErr('Please enter both Employee ID and PIN.'); return; }
    
    // Auto-switch to Administrator tab if user entered 'ADMIN'
    if (raw.toUpperCase() === 'ADMIN') {
      handleRoleChange('admin');
      setAdminUser('admin');
      setAdminPass(pin);
      showErr('Switched to Administrator login. Please enter your administrator password.');
      return;
    }

    // Smart Employee ID Normalization: support EMP001, emp001, 001, 1, or emp001@dmc.org
    let id = '';
    let email = '';
    if (raw.includes('@')) {
      email = raw.toLowerCase();
      id = email.split('@')[0].toUpperCase();
    } else {
      let clean = raw.toUpperCase();
      if (/^\d+$/.test(clean)) {
        clean = `EMP${clean.padStart(3, '0')}`;
      }
      id = clean;
      email = `${id.toLowerCase()}@dmc.org`;
    }

    setLoading(true); setError('');
    try {
      let { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });

      // Graceful fallback between 4-digit and 6-digit default test PINs (1234 <-> 123456)
      if (error && (pin === '1234' || pin === '123456')) {
        const altPin = pin === '1234' ? '123456' : '1234';
        const retry = await supabase.auth.signInWithPassword({
          email,
          password: altPin,
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }

      if (error) throw error;
      localStorage.setItem('dmc_last_staff_id', id);
      localStorage.setItem('dmc_last_login_role', 'staff');
    } catch (e) {
      showErr('Invalid Employee ID or PIN. Default PIN is 123456 (or 1234).');
    } finally {
      setLoading(false);
    }
  }

  async function doAdminLogin(e) {
    e.preventDefault();
    const user = adminUser.trim();
    const pass = adminPass;
    if (!user || !pass) { showErr('Please enter both username and password.'); return; }

    // If an employee ID was accidentally entered in the Admin portal tab:
    if (user.toUpperCase().startsWith('EMP') || /^\d+$/.test(user)) {
      handleRoleChange('staff');
      setStaffId(user.toUpperCase());
      setStaffPin(pass);
      showErr(`Switched to Staff login for ${user.toUpperCase()}. Please click Sign In.`);
      return;
    }

    setLoading(true); setError('');
    try {
      const email = user.includes('@')
        ? user.toLowerCase()
        : user.toLowerCase() === 'admin'
          ? 'admin@nagarnigam.local'
          : `${user.toLowerCase()}@nagarnigam.local`;
      
      let { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error && (pass === 'admin' || pass === 'admin123')) {
        const altPass = pass === 'admin' ? 'admin123' : 'admin';
        const retry = await supabase.auth.signInWithPassword({ email, password: altPass });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }
      if (error) throw error;
      localStorage.setItem('dmc_last_admin_user', user);
      localStorage.setItem('dmc_last_login_role', 'admin');
      const { data: profile, error: profErr } = await supabase.from('staff').select('role').eq('user_id', data.user.id).single();
      if (profErr || profile?.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('This account does not have administrator privileges.');
      }
    } catch (e) {
      showErr(e.message?.includes('Invalid') ? 'Invalid administrator credentials. Default password is admin123 (or admin).' : e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-page-layout">
      {/* Subtle Architectural Dot Grid Canvas */}
      <InteractiveDotGrid
        gridSpacing={36}
        connectionDistance={110}
        dotColor="rgba(148, 163, 184, 0.2)"
        activeColor="#0f172a"
        accentColor="#334155"
        ambientNodeCount={4}
      />

      {/* ── Centered Login Card (Intentional Minimalism) ── */}
      <main className="signin-main-container">
        <div className="signin-form-wrapper">
          {/* Brand Header */}
          <div className="signin-brand-row">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="DMC Logo"
              className="signin-brand-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="signin-brand-text">
              <div className="signin-org-title">Dhanbad Municipal Corporation</div>
              <div className="signin-org-subtitle">Attendance Management System</div>
            </div>
          </div>

          <div className="signin-headings">
            <h1 className="signin-main-title">Sign In</h1>
            <p className="signin-description">
              Access employee daily attendance and municipal duty verification
            </p>
          </div>

          {/* Segmented Role Tabs */}
          <div className="signin-role-tabs">
            <button
              type="button"
              className={`signin-role-btn ${role === 'staff' ? 'active' : ''}`}
              onClick={() => handleRoleChange('staff')}
            >
              <User size={15} />
              <span>Staff</span>
            </button>
            <button
              type="button"
              className={`signin-role-btn ${role === 'admin' ? 'active' : ''}`}
              onClick={() => handleRoleChange('admin')}
            >
              <ShieldCheck size={15} />
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
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="signin-field-group">
                  <div className="signin-field-header">
                    <label className="signin-field-label">Employee ID</label>
                    <span className="signin-field-hint font-mono">e.g. EMP001</span>
                  </div>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <User size={16} className="glass-input-icon" />
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
                  <div className="signin-field-header">
                    <label className="signin-field-label">PIN</label>
                    <span className="signin-field-hint font-mono">e.g. 123456</span>
                  </div>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <KeyRound size={16} className="glass-input-icon" />
                      <input
                        type={showPin ? 'text' : 'password'}
                        className="glass-input font-mono"
                        placeholder="••••••"
                        maxLength={6}
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
                        {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-options-row">
                  <label className="signin-checkbox-label">
                    <input type="checkbox" defaultChecked className="signin-checkbox" />
                    <span>Remember on this device</span>
                  </label>
                </div>

                <motion.button
                  type="submit"
                  className="signin-submit-btn"
                  disabled={loading}
                  whileHover={{ scale: 1.012 }}
                  whileTap={{ scale: 0.985 }}
                  transition={springPhysics.snappy}
                >
                  <span className="btn-label-text">{loading ? 'Authenticating...' : 'Sign In'}</span>
                  {loading ? <RefreshCw size={16} className="spin" /> : <ArrowRight size={16} className="btn-arrow-icon" />}
                </motion.button>

                <div className="signin-clean-footer">
                  <span>Need assistance?</span>
                  <a href="#help" onClick={(e) => { e.preventDefault(); showErr('Please contact DMC Administrative Control Room (Ext. 104).'); }}>
                    Contact Administrator
                  </a>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="admin"
                onSubmit={doAdminLogin}
                className="signin-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="signin-field-group">
                  <div className="signin-field-header">
                    <label className="signin-field-label">Username or Email</label>
                    <span className="signin-field-hint font-mono">e.g. admin</span>
                  </div>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <ShieldCheck size={16} className="glass-input-icon" />
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
                  <div className="signin-field-header">
                    <label className="signin-field-label">Password</label>
                    <span className="signin-field-hint font-mono">e.g. admin123</span>
                  </div>
                  <GlassInputWrapper>
                    <div className="glass-input-inner">
                      <Lock size={16} className="glass-input-icon" />
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
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="signin-options-row">
                  <label className="signin-checkbox-label">
                    <input type="checkbox" defaultChecked className="signin-checkbox" />
                    <span>Keep admin session</span>
                  </label>
                </div>

                <motion.button
                  type="submit"
                  className="signin-submit-btn admin-theme-btn"
                  disabled={loading}
                  whileHover={{ scale: 1.012 }}
                  whileTap={{ scale: 0.985 }}
                  transition={springPhysics.snappy}
                >
                  <span className="btn-label-text">{loading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
                  {loading ? <RefreshCw size={16} className="spin" /> : <ArrowRight size={16} className="btn-arrow-icon" />}
                </motion.button>

                <div className="signin-clean-footer">
                  <span>DMC Administration • Room 104</span>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
