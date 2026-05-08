import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, UserRound, GraduationCap, BrainCircuit, ArrowRight } from 'lucide-react';
import { useAuth } from './context/AuthContext';
export default function Login() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('register'); // 'login' or 'register'
  const [role, setRole] = useState('student'); // 'student' or 'admin'
  const [form, setForm] = useState({ name: '', email: '', password: '', userClass: 'DA', parentEmail: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  const onChange = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const nextUser = mode === 'login'
        ? await login(form.email, form.password)
        : await register({ ...form, role });

      navigate(nextUser.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="auth-centered-container">
      <div className="auth-card animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <div className="brandmark" style={{ fontSize: '1.5rem' }}>
            <span className="brand-icon" style={{ width: '40px', height: '40px' }}><BrainCircuit size={22} /></span>
            <span>QuizPulse AI</span>
          </div>
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '2rem' }}>
          {mode === 'login' ? 'Sign in to access your workspace' : 'Choose your role to get started'}
        </p>
        <div className="role-switcher">
          <button className={`role-btn ${role === 'student' ? 'active' : ''}`} onClick={() => setRole('student')}>
            <GraduationCap size={18} /> Student
          </button>
          <button className={`role-btn ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
            <ShieldCheck size={18} /> Admin
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          {mode === 'register' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label>Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserRound size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="text" style={{ paddingLeft: '3rem' }} value={form.name} onChange={onChange('name')} placeholder="John Doe" required />
              </div>
            </div>
          )}
          {mode === 'register' && role === 'student' && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', color: 'var(--text-main)' }}>Class / Cohort</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                {['DA', 'CYBERSECURITY', 'CSC', 'AIML'].map(cls => (
                    <button
                      key={cls}
                      type="button"
                      className={`role-btn ${form.userClass === cls ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, userClass: cls })}
                      style={{ textAlign: 'center', width: '100%', fontSize: '0.8125rem', padding: '0.75rem' }}
                    >
                    {cls === 'DA' ? 'Data Analytics' : cls === 'CSC' ? 'Computer Science' : cls === 'AIML' ? 'AIML' : 'Cybersecurity'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label>Parent / Guardian Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input style={{ paddingLeft: '3rem' }} type="email" value={form.parentEmail} onChange={onChange('parentEmail')} placeholder="parent@example.com" />
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Optional for now. It lets admins contact guardians if a quiz is voided.</p>
              </div>
            </>
          )}
          <div style={{ marginBottom: '1.25rem' }}>
            <label>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input style={{ paddingLeft: '3rem' }} type="email" value={form.email} onChange={onChange('email')} placeholder="you@college.edu" required />
            </div>
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input style={{ paddingLeft: '3rem' }} type="password" value={form.password} onChange={onChange('password')} placeholder="••••••••" required />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={submitting}>
            {submitting ? 'Authenticating...' : (mode === 'login' ? 'Log In' : `Sign Up as ${role === 'student' ? 'Student' : 'Admin'}`)}
            {!submitting && <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />}
          </button>
        </form>
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontWeight: '700', cursor: 'pointer', fontSize: '0.9375rem' }}
            >
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
