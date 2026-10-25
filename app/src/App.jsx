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
          <span>Loading portal...</span>
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (session && profile === null) {
    return (
      <div className="page-loader" style={{ padding: 20 }}>
        <div className="page-loader-box" style={{ maxWidth: 440, padding: 36, textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--red-600, #dc2626)', marginBottom: 8, fontWeight: 800 }}>
            Profile Not Found
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--mono-600, #475569)', lineHeight: 1.5, marginBottom: 24 }}>
            This account ({session.user?.email || 'User'}) does not have an active municipal staff profile record.
          </p>
          <button
            onClick={logout}
            className="btn btn-primary"
            style={{ padding: '12px 26px' }}
          >
            Logout
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
        gutter={12}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.85rem',
            fontWeight: '600',
            borderRadius: '10px',
            background: '#ffffff',
            color: '#0f172a',
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
            border: '1px solid #e2e8f0',
            padding: '10px 18px',
          },
          success: {
            iconTheme: { primary: '#059669', secondary: '#ffffff' },
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #a7f3d0',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
            },
          },
          error: {
            iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #fecaca',
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)',
            },
          },
        }}
      />
      <AppRoutes />
    </AuthProvider>
  );
}
