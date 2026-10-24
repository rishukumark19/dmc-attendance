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
          <span>Loading portal... / पोर्टल लोड हो रहा है...</span>
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
            Profile Not Found / प्रोफाइल नहीं मिला
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--mono-600, #475569)', lineHeight: 1.5, marginBottom: 24 }}>
            This account ({session.user?.email || 'User'}) does not have an active municipal staff profile record.
          </p>
          <button
            onClick={logout}
            className="btn btn-primary"
            style={{ padding: '12px 26px' }}
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
        gutter={12}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '0.85rem',
            fontWeight: '700',
            borderRadius: '14px',
            background: 'var(--neu-bg, #e9eef5)',
            color: 'var(--mono-900, #0f172a)',
            boxShadow: '6px 6px 16px rgba(164, 178, 198, 0.7), -6px -6px 16px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            padding: '12px 20px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#ffffff' },
            style: {
              background: '#e9eef5',
              color: '#047857',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '6px 6px 16px rgba(164, 178, 198, 0.7), -6px -6px 16px rgba(255, 255, 255, 0.95), 0 0 12px rgba(16, 185, 129, 0.25)',
            },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#ffffff' },
            style: {
              background: '#e9eef5',
              color: '#b91c1c',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              boxShadow: '6px 6px 16px rgba(164, 178, 198, 0.7), -6px -6px 16px rgba(255, 255, 255, 0.95), 0 0 12px rgba(239, 68, 68, 0.25)',
            },
          },
        }}
      />
      <AppRoutes />
    </AuthProvider>
  );
}
