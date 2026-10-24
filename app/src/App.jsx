import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage  from './pages/LoginPage';
import StaffPage  from './pages/StaffPage';
import AdminPage  from './pages/AdminPage';
import './index.css';

function AppRoutes() {
  const { session, profile, logout } = useAuth();

  if (session === undefined || (session && profile === undefined)) {
    return (
      <div className="page-loader">
        <div className="page-loader-box">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (session && profile === null) {
    return (
      <div className="page-loader" style={{ padding: 20 }}>
        <div className="page-loader-box" style={{ maxWidth: 440, padding: 32, textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#991b1b', marginBottom: 8, fontWeight: 700 }}>
            Profile Not Found / प्रोफाइल नहीं मिला
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5, marginBottom: 20 }}>
            This account ({session.user?.email || 'User'}) does not have an active municipal staff profile record.
          </p>
          <button
            onClick={logout}
            style={{
              padding: '10px 22px',
              backgroundColor: '#1d4ed8',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Logout / लॉग आउट करें
          </button>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin') return <AdminPage />;
  return <StaffPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-center"
        gutter={10}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.85rem',
            fontWeight: '600',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            padding: '12px 18px',
          },
          success: {
            iconTheme: { primary: '#16a34a', secondary: '#fff' },
            style: { background: '#f0fdf4', color: '#14532d', border: '1px solid #bbf7d0' },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#fff' },
            style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' },
          },
        }}
      />
      <AppRoutes />
    </AuthProvider>
  );
}
