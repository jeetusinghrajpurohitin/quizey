import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';
const AuthContext = createContext(null);
const TOKEN_KEY = 'quizpulse_token';
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  const persistSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return persistSession(response.data);
  };
  const register = async ({ name, email, password, role, userClass, parentEmail }) => {
    const response = await api.post('/auth/register', { name, email, password, role, userClass, parentEmail });
    return persistSession(response.data);
  };
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
