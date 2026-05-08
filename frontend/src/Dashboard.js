import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from './api';
import { Award, Brain, Clock, Loader2, PlayCircle, Star } from 'lucide-react';
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [skillTopic, setSkillTopic] = useState('');
  const [skillDifficulty, setSkillDifficulty] = useState('Beginner');
  const [skillGenerating, setSkillGenerating] = useState(false);
  const [skillError, setSkillError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  // Refetch every time user navigates to this page (location.key changes on each visit)
  useEffect(() => {
    setLoading(true);
    api.get('/dashboard/student')
      .then(res => setData(res.data))
      .catch(err => console.error('Failed to load dashboard', err))
      .finally(() => setLoading(false));
  }, [location.key]);
  if (loading) return <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>Loading dashboard...</div>;
  if (!data) return null;
  const { user, skills, progress } = data;
  const generateSkillAssessment = async (e) => {
    e.preventDefault();
    if (!skillTopic.trim()) return setSkillError('Enter a skill topic first.');
    setSkillGenerating(true);
    setSkillError('');
    try {
      const res = await api.post('/student/generate-skill-assessment', {
        topic: skillTopic,
        difficulty: skillDifficulty
      });
      navigate(`/quiz/${res.data.quizId}`);
    } catch (err) {
      setSkillError(err.response?.data?.message || 'Could not generate the skill assessment.');
    } finally {
      setSkillGenerating(false);
    }
  };
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-main)' }}>Hello, {user.name} 👋</h2>
          <p style={{ color: 'var(--text-muted)' }}>Here is your advanced progress report and metrics.</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/catalog')}><PlayCircle size={18} /> Browse Catalog</button>
      </div>
      <div className="metrics-grid">
        <div className="metric-card">
          <span>Rank Points</span>
          <strong>{progress.stats.rankPoints}</strong>
        </div>
        <div className="metric-card">
          <span>Skills Unlocked</span>
          <strong>{progress.stats.skillsUnlocked}</strong>
        </div>
        <div className="metric-card">
          <span>Overall Accuracy</span>
          <strong>{progress.stats.overallAccuracy}%</strong>
        </div>
        <div className="metric-card">
          <span>Pass Streak</span>
          <strong>{progress.stats.currentStreak} 🔥</strong>
        </div>
        <div className="metric-card">
          <span>Alerts / Voids</span>
          <strong>{progress.stats.totalAlerts} <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/</span> <span style={{ color: 'var(--danger-color)' }}>{progress.stats.cheatedCount}</span></strong>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 2fr)', gap: '2rem' }}>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Star color="var(--warning-color)" size={18} /> My Mastery
          </h3>
          <div className="card" style={{ minHeight: '200px' }}>
            {skills.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontSize: '0.875rem' }}>No skills acquired yet. Complete an assessment!</div>
            ) : (
              <div style={{ flexWrap: 'wrap', display: 'flex', gap: '0.75rem' }}>
                {skills.map(skill => (
                  <div key={skill} style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.875rem' }}>
                    <Award size={16} color="var(--primary-color)" />
                    {skill.charAt(0).toUpperCase() + skill.slice(1).replace('-', ' ')}
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => setSkillPanelOpen(open => !open)}>
                <Brain size={18} /> {skillPanelOpen ? 'Close Skill Builder' : 'Earn New Skill'}
              </button>
              {skillPanelOpen && (
                <form onSubmit={generateSkillAssessment} className="animate-fade-in" style={{ marginTop: '1.5rem' }}>
                  {skillError && <div className="form-error">{skillError}</div>}
                  <label>Skill topic</label>
                  <input
                    value={skillTopic}
                    onChange={e => setSkillTopic(e.target.value)}
                    placeholder="e.g. Network Security, React Hooks"
                    style={{ marginBottom: '1rem' }}
                  />
                  <label>Level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                    {['Beginner', 'Intermediate', 'Expert'].map(level => (
                      <button
                        key={level}
                        type="button"
                        className={`role-btn ${skillDifficulty === level ? 'active' : ''}`}
                        onClick={() => setSkillDifficulty(level)}
                        style={{ fontSize: '0.75rem', padding: '0.7rem 0.35rem' }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                    40 questions, 40 minutes, no backward navigation. Score 85% or higher to earn the skill.
                  </div>
                  <button type="submit" className="btn-outline" style={{ width: '100%' }} disabled={skillGenerating}>
                    {skillGenerating ? <Loader2 className="animate-spin" size={18} /> : <Award size={18} />}
                    Generate Skill Test
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock color="var(--primary-color)" size={18} /> Recent Quiz Ledger
          </h3>
          <div className="card" style={{ minHeight: '200px', padding: 0, overflow: 'hidden' }}>
            {progress.timeline.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No quiz history available.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {progress.timeline.slice().reverse().map((attempt, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: idx < progress.timeline.length - 1 ? '1px solid var(--surface-border)' : 'none', background: attempt.isCheated ? '#fef2f2' : 'transparent' }}>
                    <div>
                      <div style={{ color: 'var(--text-main)', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {attempt.topic.charAt(0).toUpperCase() + attempt.topic.slice(1).replace('-', ' ')}
                        {attempt.isCheated && <span className="badge" style={{ marginLeft: '0.5rem', background: '#ef4444', color: 'white' }}>Voided (Cheating)</span>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(attempt.takenAt).toLocaleDateString()} at {new Date(attempt.takenAt).toLocaleTimeString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: attempt.passed ? 'var(--success-color)' : (attempt.isCheated ? '#ef4444' : 'var(--text-main)') }}>{attempt.score}%</div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: attempt.passed ? 'var(--success-color)' : (attempt.isCheated ? '#ef4444' : 'var(--text-muted)') }}>{attempt.passed ? 'Passed' : 'Failed'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
