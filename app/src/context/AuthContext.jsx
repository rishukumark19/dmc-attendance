import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'admin') {
        setSession({ user: { id: '2106a57e-9201-45d4-8829-3bd0ff14761b', email: 'admin@nagarnigam.local' } });
        setProfile({ id: 'a2f9cecc-a195-4700-8968-561e5e54a28d', user_id: '2106a57e-9201-45d4-8829-3bd0ff14761b', name: 'Admin', emp_id: 'ADMIN', role: 'admin', active: true });
        return;
      }
      if (viewParam === 'staff') {
        setSession({ user: { id: '4d052a83-cd0d-4e1d-adf1-2fe8ea1a01a7', email: 'emp001@dmc.org' } });
        setProfile({ id: 'd3c91eb0-cdfe-40fb-ba5f-ccc62ba4e6d2', user_id: '4d052a83-cd0d-4e1d-adf1-2fe8ea1a01a7', name: 'rishu1', emp_id: 'EMP001', role: 'staff', ward: 'Ward 12 (Bank More / बैंक मोड़)', active: true });
        return;
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setSession(null);
        setProfile(null);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(uid) {
    try {
      const { data, error } = await supabase.from('staff').select('*').eq('user_id', uid).maybeSingle();
      if (error) console.error('Fetch profile error:', error);
      setProfile(data || null);
    } catch (e) {
      console.error('Fetch profile exception:', e);
      setProfile(null);
    }
  }

  const logout = async () => {
    setSession(null);
    setProfile(null);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('SignOut error:', e);
    }
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ session, profile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
