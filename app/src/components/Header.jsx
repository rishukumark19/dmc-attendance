import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../lib/utils';
import './Header.css';

export default function Header({ title, subtitle }) {
  const { profile, logout } = useAuth();
  const initials = profile ? getInitials(profile.name) : '?';

  async function handleLogout() {
    if (!confirm('Logout?')) return;
    await logout();
  }

  return (
    <header className="hdr">
      <div className="tristrip" />
      <div className="hdr-inner">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="DMC Logo" className="hdr-logo" />
        <div className="hdr-text">
          <h1>{title || 'धनबाद नगर निगम'}</h1>
          <p>{subtitle || 'Dhanbad Municipal Corporation'}</p>
        </div>
        <div className="hdr-right">
          <div className="hdr-chip">
            <div className="hdr-avatar" style={profile?.role === 'admin' ? { background: 'var(--saff)' } : {}}>
              {profile?.role === 'admin' ? '🛡' : initials}
            </div>
            <span className="hide-mobile">{profile?.name || 'Loading...'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </header>
  );
}
