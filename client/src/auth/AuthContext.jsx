import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('loadflow_token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => localStorage.removeItem('loadflow_token'))
      .finally(() => setLoading(false));
  }, []);

  function applySession(token, userPayload) {
    localStorage.setItem('loadflow_token', token);
    // re-fetch full /me (with live permissions) rather than trusting the
    // signup/login response shape alone
    setUser(userPayload);
    api.me().then(setUser).catch(() => {});
  }

  function logout() {
    localStorage.removeItem('loadflow_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, applySession, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
