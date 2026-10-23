import React, { useState, useRef } from 'react';
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
      const email = `${id.toLowerCase()}@dmc.org`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pin,
      });
      if (error) throw error;
      // AuthContext will handle redirect via router
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

  return (
    <div className="login-bg">
      <div className="blob b1" /><div className="blob b2" /><div className="blob b3" />

      <div className="login-card">
        <div className="tristrip" />
        <div className="login-body">
          {/* Logo */}
          <div className="login-logo-wrap">
            <div className="login-logo-ring">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DMC Logo" />
            </div>
            <div className="login-org-hi">धनबाद नगर निगम</div>
            <div className="login-org-en">DHANBAD MUNICIPAL CORPORATION</div>
            <div className="login-org-sub">उपस्थिति प्रणाली &nbsp;•&nbsp; Attendance System</div>
          </div>

          {/* Role tabs */}
          <div className="role-tabs">
            <button
              className={`role-tab${role === 'staff' ? ' active' : ''}`}
              onClick={() => { setRole('staff'); setError(''); }}
            >👤 Staff / कर्मचारी</button>
            <button
              className={`role-tab${role === 'admin' ? ' active' : ''}`}
              onClick={() => { setRole('admin'); setError(''); }}
            >🛡️ Admin</button>
          </div>

          {/* Error */}
          {error && (
            <div className="login-err" key={errKey.current}>
              ⚠️ {error}
            </div>
          )}

          {/* Staff form */}
          {role === 'staff' && (
            <form onSubmit={doStaffLogin} className="login-form">
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
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPin(v => !v)}>
                    {showPin ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn btn-navy btn-lg login-btn" disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
                {loading ? 'Logging in...' : 'Login / लॉगिन करें →'}
              </button>
              <div className="login-help">
                PIN भूल गए? <a onClick={() => alert('Admin से संपर्क करें।')}>Admin से संपर्क करें</a>
              </div>
            </form>
          )}

          {/* Admin form */}
          {role === 'admin' && (
            <form onSubmit={doAdminLogin} className="login-form">
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
              <button type="submit" className="btn btn-saff btn-lg login-btn" disabled={loading}>
                {loading && <span className="spinner spinner-sm" />}
                {loading ? 'Logging in...' : 'Admin Login →'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="login-footer">
        © धनबाद नगर निगम — उपस्थिति प्रणाली &nbsp;|&nbsp; सभी अधिकार सुरक्षित
      </div>
    </div>
  );
}
