import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage  from './pages/LoginPage';
import StaffPage  from './pages/StaffPage';
import AdminPage  from './pages/AdminPage';
import './index.css';

function AppRoutes() {
  const { session, profile } = useAuth();

  // Still loading session
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

  // Not logged in
  if (!session) return <LoginPage />;

  // Logged in but profile not yet fetched
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

  // Route by role
  if (profile.role === 'admin') return <AdminPage />;
  return <StaffPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
