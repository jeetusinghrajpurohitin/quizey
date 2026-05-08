import React from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import {
  BrainCircuit,
  GraduationCap,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './Login';
import Dashboard from './Dashboard';
import Catalog from './Catalog';
import Quiz from './Quiz';
import AdminDashboard from './AdminDashboard';
import Landing from './Landing';
import WaitingRoom from './WaitingRoom';
import Leaderboard from './Leaderboard';
import './index.css';
function AppShell() {
  const { user, logout, loading } = useAuth();
  if (loading) {
    return (
      <div className="page-shell" style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        <div className="loading-card">Loading QuizPulse AI...</div>
      </div>
    );
  }
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brandmark">
            <span className="brand-icon">
              <BrainCircuit size={18} />
            </span>
            <span>
              QuizPulse AI
              <small>Real-time quiz intelligence</small>
            </span>
          </Link>
          <nav className="topbar-nav">
            <NavLink to="/" className="nav-pill">
              Home
            </NavLink>
            {user?.role === 'student' && (
              <>
                <NavLink to="/dashboard" className="nav-pill">
                  Dashboard
                </NavLink>
                <NavLink to="/catalog" className="nav-pill">
                  Quiz Library
                </NavLink>
                <NavLink to="/leaderboard" className="nav-pill">
                  Leaderboard
                </NavLink>
              </>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin" className="nav-pill">
                Admin
              </NavLink>
            )}
          </nav>
          <div className="topbar-actions">
            {!user ? (
              <Link to="/auth" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                Get Started
              </Link>
            ) : (
              <>
                <div className="user-chip">
                  <span className="user-chip-icon">{user.role === 'admin' ? <ShieldCheck size={14} /> : <GraduationCap size={14} />}</span>
                  <span>{user.name}</span>
                </div>
                <button type="button" className="button ghost" style={{ flexShrink: 0, padding: '0.5rem', borderRadius: '8px' }} onClick={logout}>
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </header>
        <main className="page-shell">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="student">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalog"
              element={
                <ProtectedRoute role="student">
                  <Catalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute role="student">
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/join/:quizId"
              element={
                <ProtectedRoute role="student">
                  <WaitingRoom />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:quizId"
              element={
                <ProtectedRoute role="student">
                  <Quiz />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="loading-card">Checking your session...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return children;
}
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
