import React from 'react';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../lib/utils';
import { LogOut, ShieldCheck, User } from './Icons';
import './Header.css';

export default function Header({ title, subtitle, onMenuToggle, showMenuBtn = false }) {
  const { profile, logout } = useAuth();
  const initials = profile ? getInitials(profile.name) : '?';

  async function handleLogout(e) {
    if (e) e.preventDefault();
    await logout();
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <header className="hdr">
      <div className="tristrip" />
      <div className="hdr-inner">
        <div className="hdr-left">
          {showMenuBtn && (
            <button
              className="hdr-menu-btn"
              onClick={onMenuToggle}
              aria-label="Toggle navigation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="DMC Logo"
            className="hdr-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="hdr-text">
            <div className="hdr-brand-row">
              <h1>{title || 'धनबाद नगर निगम'}</h1>
              <span className="hdr-live-pill">
                <span className="live-pulse" /> Live
              </span>
            </div>
            <p>{subtitle || 'Dhanbad Municipal Corporation — Attendance Portal'}</p>
          </div>
        </div>

        <div className="hdr-right">
          <div className="hdr-chip">
            <div className={`hdr-avatar ${isAdmin ? 'hdr-avatar-admin' : 'hdr-avatar-staff'}`}>
              {isAdmin ? <ShieldCheck size={16} /> : (initials || <User size={16} />)}
            </div>
            <div className="hdr-user-info hide-mobile">
              <span className="hdr-user-name">{profile?.name || 'Loading...'}</span>
              <span className="hdr-user-role">{isAdmin ? 'Administrator' : 'Staff Member'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Log out">
            <LogOut size={15} />
            <span className="hide-mobile">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
