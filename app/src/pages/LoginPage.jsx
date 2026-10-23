import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
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
    if (!id || !pin) { showErr('Please fill all fields.'); return; }
    setLoading(true); setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: `${id.toLowerCase()}@dmc.org`,
        password: pin,
      });
      if (error) throw error;
    } catch (e) {
      showErr('Invalid Employee ID or PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function doAdminLogin(e) {
    e.preventDefault();
    const user = adminUser.trim();
    const pass = adminPass;
    if (!user || !pass) { showErr('Please fill all fields.'); return; }
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
        throw new Error('Not an admin account.');
      }
    } catch (e) {
      showErr(e.message?.includes('Invalid') ? 'Invalid admin credentials.' : e.message);
    } finally {
      setLoading(false);
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  };
  const formVariants = {
    hidden: { opacity: 0, x: role === 'staff' ? -20 : 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: role === 'staff' ? 20 : -20, transition: { duration: 0.18 } },
  };

  return (
    <div className="login-bg">
      {/* Animated blobs */}
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />

      <motion.div
        className="login-card"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="tristrip" />
        <div className="login-body">

          {/* Logo */}
          <motion.div
            className="login-logo-wrap"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <div className="login-logo-ring">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DMC Logo" />
            </div>
            <div className="login-org-hi">धनबाद नगर निगम</div>
            <div className="login-org-en">DHANBAD MUNICIPAL CORPORATION</div>
            <div className="login-org-sub">उपस्थिति प्रणाली &nbsp;•&nbsp; Attendance System</div>
          </motion.div>

          {/* Role tabs */}
          <motion.div
            className="role-tabs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <button
              className={`role-tab${role === 'staff' ? ' active' : ''}`}
              onClick={() => { setRole('staff'); setError(''); }}
            >👤 Staff / कर्मचारी</button>
            <button
              className={`role-tab${role === 'admin' ? ' active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >🛡️ Admin</button>
          </motion.div>

          {/* Error */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={errKey.current}
                className="login-err"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                ⚠️ {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {role === 'staff' ? (
              <motion.form
                key="staff"
                onSubmit={doStaffLogin}
                className="login-form"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="form-group">
                  <label className="form-label">Employee ID / कर्मचारी क्रमांक</label>
                  <div className="input-wrap">
                    <span className="input-icon">🪪</span>
                    <input
                      type="text"
                      className="form-input login-input"
                      placeholder="e.g. EMP001"
                      value={staffId}
                      onChange={e => setStaffId(e.target.value)}
                      autoCapitalize="characters"
                      autoComplete="username"
                      spellCheck={false}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">PIN / पासवर्ड</label>
                  <div className="input-wrap">
                    <span className="input-icon">🔑</span>
                    <input
                      type={showPin ? 'text' : 'password'}
                      className="form-input login-input pin-input"
                      placeholder="• • • •"
                      maxLength={8}
                      value={staffPin}
                      onChange={e => setStaffPin(e.target.value)}
                      inputMode="numeric"
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPin(v => !v)}>
                      {showPin ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <motion.button
                  type="submit"
                  className="btn btn-navy btn-lg login-btn"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {loading && <span className="spinner spinner-sm" />}
                  {loading ? 'Logging in...' : 'Login →'}
                </motion.button>
                <div className="login-help">
                  PIN भूल गए? <a onClick={() => alert('Admin से संपर्क करें।')}>Admin से संपर्क करें</a>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="admin"
                onSubmit={doAdminLogin}
                className="login-form"
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="form-group">
                  <label className="form-label">Admin Username</label>
                  <div className="input-wrap">
                    <span className="input-icon">🛡️</span>
                    <input
                      type="text"
                      className="form-input login-input"
                      placeholder="admin"
                      value={adminUser}
                      onChange={e => setAdminUser(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password / पासवर्ड</label>
                  <div className="input-wrap">
                    <span className="input-icon">🔐</span>
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="form-input login-input"
                      placeholder="••••••••"
                      value={adminPass}
                      onChange={e => setAdminPass(e.target.value)}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPass(v => !v)}>
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>
                <motion.button
                  type="submit"
                  className="btn btn-saff btn-lg login-btn"
                  disabled={loading}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {loading && <span className="spinner spinner-sm" />}
                  {loading ? 'Logging in...' : 'Admin Login →'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

        </div>
      </motion.div>

      <div className="login-footer">
        © धनबाद नगर निगम &nbsp;|&nbsp; Attendance System
      </div>
    </div>
  );
}
