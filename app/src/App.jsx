import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage  from './pages/LoginPage';
import StaffPage  from './pages/StaffPage';
import AdminPage  from './pages/AdminPage';
import './index.css';

function AppRoutes() {
  const { session, profile } = useAuth();

  if (session === undefined) {
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

  if (!profile) {
    return (
      <div className="page-loader">
        <div className="page-loader-box">
          <div className="spinner" />
          <span>Loading profile...</span>
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
