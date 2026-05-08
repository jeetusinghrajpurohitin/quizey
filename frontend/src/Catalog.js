import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, Filter, Layers3, MoveRight, Sparkles, Loader2, FileBarChart, X, CheckCircle2, History } from 'lucide-react';
import api from './api';
export default function Catalog() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState('All');

  // AI Generation State
  const [aiTopic, setAiTopic] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('Intermediate');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // Reports Modal State
  const [reportQuiz, setReportQuiz] = useState(null);

  useEffect(() => {
    api
      .get('/catalog')
      .then((response) => setQuizzes(response.data.quizzes))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return setError('Please enter a topic to generate.');
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/student/generate-skill-assessment', { topic: aiTopic, difficulty: aiDifficulty });
      navigate(`/quiz/${res.data.quizId}`);
    } catch (err) {
      setError('Failed to generate assessment. Try again.');
      setGenerating(false);
    }
  };

  const filtered = useMemo(() => {
    if (difficulty === 'All') {
      return quizzes;
    }
    return quizzes.filter((quiz) => quiz.difficulty === difficulty);
  }, [difficulty, quizzes]);
  const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
  if (loading) {
    return <div className="loading-card">Loading quiz catalog...</div>;
  }
  return (
    <div className="dashboard-stack">
      <section className="hero-summary">
        <div>
          <span className="eyebrow">Topic library</span>
          <h1>Choose a quiz and build the next skill on your profile.</h1>
          <p>Take multiple attempts, improve over time, and unlock the topic once you hit the 80% mastery line.</p>
        </div>
        <div className="filter-group">
          <Filter size={16} />
          {difficulties.map((item) => (
            <button
              key={item}
              type="button"
              className={`filter-pill ${difficulty === item ? 'active' : ''}`}
              onClick={() => setDifficulty(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {/* AI Generator Section */}
      <section className="card animate-fade-in" style={{
        marginBottom: '2.5rem',
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        color: 'white',
        border: 'none',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Sparkles size={24} />
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>AI Powered Deep-Dive</h2>
          </div>
          <p style={{ opacity: 0.9, marginBottom: '1.5rem', maxWidth: '600px' }}>
            Can't find what you're looking for? Generate a personalized 40-question skill challenge on any topic instantly.
          </p>

          <form onSubmit={handleGenerateAI} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '280px' }}>
              <label style={{ color: 'white', opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Desired Topic</label>
              <input
                type="text"
                placeholder="e.g. Advanced Go Concurrency, UX Design Systems..."
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1rem'
                }}
              />
            </div>
            <div style={{ width: '160px' }}>
              <label style={{ color: 'white', opacity: 0.8, fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Difficulty</label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1rem'
                }}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={generating}
              style={{
                background: 'white',
                color: 'var(--primary-color)',
                padding: '1rem 2rem',
                borderRadius: '12px',
                height: '56px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {generating ? <Loader2 className="animate-spin" size={20} /> : 'Generate Assessment'}
            </button>
          </form>
          {error && <div style={{ marginTop: '1rem', color: '#fecaca', fontSize: '0.875rem', fontWeight: '600' }}>{error}</div>}
        </div>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '150px',
          height: '150px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          filter: 'blur(40px)'
        }} />
      </section>
      <section className="catalog-grid">
        {filtered.map((quiz) => {
          const answeredCount = quiz.partial ? quiz.partial.answers.filter(a => a !== null).length : 0;
          const progressPercent = quiz.questionCount > 0 ? Math.round((answeredCount / quiz.questionCount) * 100) : 0;
          const hasReports = quiz.userAttempts && quiz.userAttempts.length > 0;
          const launchPath = quiz.requiresStart ? `/join/${quiz.id}` : `/quiz/${quiz.id}`;

          return (
            <article className="catalog-card" key={quiz.id}>
              <div className="catalog-header">
                <span className={`status-chip ${quiz.difficulty === 'Advanced' ? 'warn' : 'neutral'}`}>{quiz.difficulty}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {hasReports && (
                    <button
                      className="button ghost small"
                      title="View reports"
                      onClick={() => setReportQuiz(quiz)}
                      style={{ padding: '0.35rem' }}
                    >
                      <FileBarChart size={16} />
                    </button>
                  )}
                  <span className="muted-inline">{quiz.topicLabel}</span>
                </div>
              </div>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{quiz.title}</h2>
              <p style={{ fontSize: '0.875rem', height: '3rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{quiz.description}</p>

              {quiz.partial && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem', fontWeight: '600', color: 'var(--primary-color)' }}>
                    <span>Progress: {answeredCount}/{quiz.questionCount}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressPercent}%`, background: 'var(--primary-color)', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )}

              <div className="catalog-meta" style={{ marginTop: 'auto' }}>
                <span>
                  <Clock3 size={14} />
                  {quiz.estimatedMinutes} min
                </span>
                <span>
                  <Layers3 size={14} />
                  {quiz.questionCount} questions
                </span>
              </div>
              <div className="catalog-footer">
                <span style={{ fontSize: '0.75rem' }}>Pass threshold: {quiz.passScore}%</span>
                <Link to={launchPath} className={`button ${quiz.partial || quiz.requiresStart ? 'primary' : 'secondary'} small`}>
                  {quiz.requiresStart ? 'Join room' : (quiz.partial ? 'Resume' : 'Start quiz')}
                  <MoveRight size={16} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {/* Reports Modal */}
      {reportQuiz && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1.5rem'
        }} onClick={() => setReportQuiz(null)}>
          <div className="card animate-fade-in" style={{
            width: '100%', maxWidth: '500px', padding: '0', overflow: 'hidden',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '1.5rem 2rem', borderBottom: '1px solid var(--surface-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--bg-main)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <History className="text-highlight" size={20} />
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Quiz History</h2>
              </div>
              <button className="button ghost" onClick={() => setReportQuiz(null)} style={{ padding: '0.5rem' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{reportQuiz.title}</h3>
                <p className="muted-inline" style={{ fontSize: '0.75rem' }}>Track your performance across all attempts.</p>
              </div>

              <div className="table-stack">
                {reportQuiz.userAttempts.sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt)).map((att, idx) => (
                  <div key={att.id} className="table-row" style={{ padding: '1rem', background: idx === 0 ? 'var(--primary-light)' : '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: att.passed ? 'var(--success-color)' : 'var(--danger-color)',
                        display: 'grid', placeItems: 'center', color: 'white'
                      }}>
                        {att.passed ? <CheckCircle2 size={18} /> : <X size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)' }}>{att.score}%</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(att.takenAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: att.passed ? 'var(--success-color)' : 'var(--danger-color)' }}>
                        {att.passed ? 'PASSED' : 'FAILED'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{att.correctAnswers}/{att.totalQuestions} correct</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--surface-border)', textAlign: 'right', background: 'var(--bg-main)' }}>
              <button className="btn-primary" onClick={() => setReportQuiz(null)}>Close Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
