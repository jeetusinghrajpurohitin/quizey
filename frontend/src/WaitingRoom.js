import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock3, Loader2, LogIn, Users } from 'lucide-react';
import api from './api';
import { useAuth } from './context/AuthContext';

export default function WaitingRoom() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultName = useMemo(() => {
    const emailName = user?.email ? user.email.split('@')[0] : '';
    return emailName || user?.name || 'Student';
  }, [user]);

  const [quiz, setQuiz] = useState(null);
  const [displayName, setDisplayName] = useState(defaultName);
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/live/${quizId}/status`)
      .then(res => {
        if (cancelled) return;
        setQuiz(res.data.quiz);
        setRoom(res.data.room);
        setJoined(res.data.joined);
        if (res.data.started && res.data.joined) {
          navigate(`/quiz/${quizId}`, { replace: true });
        }
      })
      .catch(err => setError(err.response?.data?.message || 'Could not open waiting room.'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [quizId, navigate]);

  useEffect(() => {
    if (!joined) return undefined;
    const poll = () => {
      api.get(`/live/${quizId}/status`)
        .then(res => {
          setQuiz(res.data.quiz);
          setRoom(res.data.room);
          if (res.data.started && res.data.joined) {
            navigate(`/quiz/${quizId}`, { replace: true });
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [joined, quizId, navigate]);

  const joinRoom = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) return setError('Please enter your name.');
    setJoining(true);
    setError('');
    try {
      const res = await api.post(`/live/${quizId}/join`, { displayName });
      setQuiz(res.data.quiz);
      setRoom(res.data.room);
      setJoined(true);
      if (res.data.started) {
        navigate(`/quiz/${quizId}`, { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not join this quiz.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="loading-card">Opening waiting room...</div>;
  if (error && !quiz) return <div className="loading-card" style={{ color: 'var(--danger-color)' }}>{error}</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '4rem auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '16px', background: 'var(--primary-light)', color: 'var(--primary-color)', marginBottom: '1.5rem' }}>
          {joined ? <Clock3 size={42} /> : <Users size={42} />}
        </div>
        <span className="eyebrow">Live Quiz Room</span>
        <h1 style={{ fontSize: '2.25rem', marginBottom: '0.75rem' }}>{quiz?.title || 'Quiz Waiting Room'}</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 2rem' }}>
          {joined
            ? 'You are in. Keep this screen open; the quiz will begin automatically when your instructor starts it.'
            : 'Enter the name your instructor should see in the live dashboard.'}
        </p>

        {!joined ? (
          <form onSubmit={joinRoom} style={{ maxWidth: '420px', margin: '0 auto', textAlign: 'left' }}>
            {error && <div className="form-error">{error}</div>}
            <label>Your display name</label>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
            <button className="btn-primary" type="submit" disabled={joining} style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>
              {joining ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
              Join Waiting Room
            </button>
          </form>
        ) : (
          <div>
            <div className="metric-card" style={{ maxWidth: '260px', margin: '0 auto 1.5rem' }}>
              <span>Students waiting</span>
              <strong>{room?.totalStudents || '...'}</strong>
            </div>
            <button className="btn-outline" onClick={() => navigate('/catalog')}>Back to Catalog</button>
          </div>
        )}
      </div>
    </div>
  );
}
