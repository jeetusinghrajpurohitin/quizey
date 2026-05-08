import React, { useEffect, useRef, useState } from 'react';
import { Activity, Award, Brain, Clock3, Copy, FileText, PlayCircle, Plus, Radio, RotateCcw, Settings, ShieldAlert, Target, Trash2, Upload, Users } from 'lucide-react';
import api from './api';
const blankQuestion = () => ({
  prompt: '',
  options: ['', '', '', ''],
  answerIndex: 0,
  timer: 20, // Default 20s
  explanation: '',
});
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Creation Mode
  const [mode, setMode] = useState('ai'); // 'ai', 'manual', 'pdf'
  const [pdfFile, setPdfFile] = useState(null);

  // Form State
  const [form, setForm] = useState({
    title: '',
    topic: '',
    description: '',
    difficulty: 'Intermediate',
    estimatedMinutes: 10,
    targetClasses: [],
    questions: [blankQuestion()],
  });

  // Settings Toggles
  const [settings, setSettings] = useState({
    shuffleQuestions: true,
    shuffleOptions: true,
    instantFeedback: false,
    lockBackward: false,
    timer: 20
  });
  const [selectedQuizResults, setSelectedQuizResults] = useState(null);
  const [selectedStudentReport, setSelectedStudentReport] = useState(null);
  const [studentClassFilter, setStudentClassFilter] = useState('ALL');
  const [selectedLiveQuiz, setSelectedLiveQuiz] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [liveView, setLiveView] = useState('overview');
  const [shareMessage, setShareMessage] = useState('');
  const lastAlertSnapshotRef = useRef({});

  const loadDashboard = () => {
    setLoading(true);
    api.get('/dashboard/admin')
      .then(res => setData(res.data))
      .catch(err => setError('Failed to load insights.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quiz forever?')) return;
    try {
      await api.delete(`/admin/quizzes/${id}`);
      setSuccess('Quiz removed.');
      loadDashboard();
    } catch (err) {
      setError('Delete failed.');
    }
  };

  const handlePDFUpload = async () => {
    if (!pdfFile) return setError('Please select a PDF file first.');
    setSaving(true);
    setError('');
    setSuccess('');
    const formData = new FormData();
    formData.append('document', pdfFile);
    formData.append('difficulty', form.difficulty);
    formData.append('targetClasses', JSON.stringify(form.targetClasses));
    formData.append('instantFeedback', settings.instantFeedback);
    formData.append('shuffleQuestions', settings.shuffleQuestions);
    formData.append('shuffleOptions', settings.shuffleOptions);
    formData.append('lockBackward', settings.lockBackward);
    formData.append('timer', settings.timer);

    try {
      await api.post('/admin/upload-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('PDF processed and quiz generated!');
      setPdfFile(null);
      loadDashboard();
    } catch (err) {
      setError('PDF processing failed.');
    } finally { setSaving(false); }
  };


  const handleAIGenerate = async (count = 5) => {
    if (!form.topic) return setError('Please enter a topic first.');
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/generate-quiz', { 
        topic: form.topic, 
        difficulty: form.difficulty, 
        questionCount: count,
        targetClasses: form.targetClasses,
        ...settings
      });
      setSuccess(`AI generated ${count} questions successfully.`);
      loadDashboard();
    } catch (err) {
      setError('AI generation failed.');
    } finally { setSaving(false); }
  };

  const viewResults = async (quizId) => {
    try {
      const res = await api.get(`/admin/quizzes/${quizId}/results`);
      setSelectedQuizResults(res.data);
    } catch (err) {
      setError('Failed to fetch detailed results.');
    }
  };
  const viewStudentReport = async (studentId) => {
    try {
      const res = await api.get(`/admin/students/${studentId}/report`);
      setSelectedStudentReport(res.data);
    } catch (err) {
      setError('Failed to fetch student report.');
    }
  };
  const joinLinkFor = (quizId) => `${window.location.origin}/join/${quizId}`;
  const copyShareLink = async (quizId) => {
    const link = joinLinkFor(quizId);
    setShareMessage(link);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        setSuccess('Quiz room link copied.');
      } else {
        setSuccess('Quiz room link ready below.');
      }
    } catch (err) {
      setSuccess('Quiz room link ready below.');
    }
  };
  const loadLiveData = async (quizId) => {
    const res = await api.get(`/admin/quizzes/${quizId}/live`);
    setLiveData(res.data);
  };
  const playAlertSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (err) {
      // Browser may block audio until an admin interacts with the page.
    }
  };
  const startLiveQuiz = async (quiz) => {
    setSelectedLiveQuiz(quiz);
    setLiveData(null);
    setError('');
    try {
      const res = await api.post(`/admin/quizzes/${quiz.id}/live/start`);
      setLiveData({ quiz, room: res.data.room });
      setSuccess('Quiz started for waiting students.');
      loadDashboard();
    } catch (err) {
      setError('Could not start live quiz.');
    }
  };
  const resetLiveQuiz = async () => {
    if (!selectedLiveQuiz || !window.confirm('Reset this waiting room? Current live room data will be cleared.')) return;
    try {
      const res = await api.post(`/admin/quizzes/${selectedLiveQuiz.id}/live/reset`);
      setLiveData({ quiz: selectedLiveQuiz, room: res.data.room });
      loadDashboard();
    } catch (err) {
      setError('Could not reset waiting room.');
    }
  };

  useEffect(() => {
    if (!selectedLiveQuiz) return undefined;
    loadLiveData(selectedLiveQuiz.id).catch(() => {});
    const interval = setInterval(() => {
      loadLiveData(selectedLiveQuiz.id).catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedLiveQuiz]);

  useEffect(() => {
    if (!liveData?.room?.participants) return;
    let shouldBeep = false;
    const next = {};
    liveData.room.participants.forEach(student => {
      next[student.userId] = student.alerts || 0;
      if ((student.alerts || 0) > (lastAlertSnapshotRef.current[student.userId] || 0)) {
        shouldBeep = true;
      }
    });
    if (shouldBeep) playAlertSound();
    lastAlertSnapshotRef.current = next;
  }, [liveData]);

  const handleSubmitManual = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/admin/quizzes', { ...form, ...settings });
      setSuccess('Manual quiz published successfully.');
      setForm({ title: '', topic: '', description: '', difficulty: 'Intermediate', estimatedMinutes: 10, targetClasses: [], questions: [blankQuestion()] });
      loadDashboard();
    } catch (err) {
      setError('Failed to publish quiz.');
    } finally { setSaving(false); }
  };
  if (loading) return <div className="loading-card">Loading admin workspace...</div>;
  if (!data) return null;
  const liveParticipants = liveData?.room?.participants || [];
  const cheatingParticipants = liveParticipants
    .slice()
    .sort((a, b) => {
      if (Number(b.isCheated) !== Number(a.isCheated)) return Number(b.isCheated) - Number(a.isCheated);
      return (b.alerts || 0) - (a.alerts || 0);
    });
  const classFilters = ['ALL', ...(data.classStats || []).map(cls => cls.className)];
  const filteredStudents = (data.students || []).filter(student => studentClassFilter === 'ALL' || student.userClass === studentClassFilter);
  return (
    <div className="animate-fade-in dashboard-stack">
      <div className="hero-summary">
        <span className="eyebrow">Admin Dashboard</span>
        <h1>Create and manage your quizzes.</h1>
      </div>
      {/* Top Metrics Area */}
      <div className="metrics-grid">
        <div className="metric-card"><span>Total Quizzes</span><strong>{data.stats.totalQuizzes}</strong></div>
        <div className="metric-card"><span>Active</span><strong>{data.stats.totalQuizzes}</strong></div> {/* Mocking active as total for now */}
        <div className="metric-card"><span>Total Attempts</span><strong>{data.stats.totalAttempts}</strong></div>
        <div className="metric-card"><span>Avg Score</span><strong>{data.stats.averageScore}%</strong></div>
      </div>
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontWeight: '800', marginBottom: '0.25rem' }}>Class Comparison</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Compare Data Analytics, Cybersecurity, Computer Science, and AIML by rank points, accuracy, alerts, and skills.</p>
          </div>
          <Award color="var(--primary-color)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {(data.classStats || []).map(cls => (
            <div key={cls.className} style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <strong>{cls.className}</strong>
                <span className="badge" style={{ background: cls.cheated ? '#fef2f2' : '#eef2ff', color: cls.cheated ? 'var(--danger-color)' : 'var(--primary-color)' }}>{cls.students} students</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                <span>Points <strong style={{ display: 'block', fontSize: '1rem' }}>{cls.rankPoints}</strong></span>
                <span>Accuracy <strong style={{ display: 'block', fontSize: '1rem' }}>{cls.accuracy}%</strong></span>
                <span>Skills <strong style={{ display: 'block', fontSize: '1rem' }}>{cls.skills}</strong></span>
                <span>Alerts <strong style={{ display: 'block', fontSize: '1rem', color: cls.alerts ? 'var(--danger-color)' : 'var(--text-main)' }}>{cls.alerts}</strong></span>
              </div>
              <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '0.75rem', paddingTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Top: {cls.topStudent?.name || 'No attempts yet'}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontWeight: '800', marginBottom: '0.25rem' }}>Student Insights</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Open any student to see every quiz attempt, answers, timing, rank points, and cheating penalties.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {classFilters.map(cls => (
              <button
                key={cls}
                className={`role-btn ${studentClassFilter === cls ? 'active' : ''}`}
                onClick={() => setStudentClassFilter(cls)}
                style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem' }}
              >
                {cls === 'ALL' ? 'All' : cls}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--surface-border)' }}>
                <th style={{ padding: '0.9rem' }}>Student</th>
                <th style={{ padding: '0.9rem' }}>Class</th>
                <th style={{ padding: '0.9rem' }}>Rank</th>
                <th style={{ padding: '0.9rem' }}>Points</th>
                <th style={{ padding: '0.9rem' }}>Accuracy</th>
                <th style={{ padding: '0.9rem' }}>Alerts</th>
                <th style={{ padding: '0.9rem', textAlign: 'right' }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '0.9rem', fontWeight: '700' }}>
                    {student.name}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500 }}>{student.email}</div>
                  </td>
                  <td style={{ padding: '0.9rem' }}><span className="badge">{student.userClass || 'N/A'}</span></td>
                  <td style={{ padding: '0.9rem', fontWeight: '800' }}>#{student.rank}</td>
                  <td style={{ padding: '0.9rem', color: 'var(--primary-color)', fontWeight: '800' }}>{student.rankPoints}</td>
                  <td style={{ padding: '0.9rem' }}>{student.accuracy}%</td>
                  <td style={{ padding: '0.9rem', color: student.totalAlerts ? 'var(--danger-color)' : 'var(--text-muted)', fontWeight: '800' }}>{student.totalAlerts}</td>
                  <td style={{ padding: '0.9rem', textAlign: 'right' }}>
                    <button className="btn-outline" style={{ padding: '0.45rem 0.65rem' }} onClick={() => viewStudentReport(student.id)}>
                      <FileText size={15} /> View
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr><td colSpan="7" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found for this class.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem 2rem 0' }}>
          <div className="creation-tabs">
            <button className={`tab-btn ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}><Brain size={18} /> AI Generate</button>
            <button className={`tab-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}><Plus size={18} /> Manual</button>
            <button className={`tab-btn ${mode === 'pdf' ? 'active' : ''}`} onClick={() => setMode('pdf')}><Upload size={18} /> Upload PDF</button>
          </div>
        </div>
        <div style={{ padding: '0 2rem 2rem' }}>
          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}
          {shareMessage && (
            <div className="form-success" style={{ wordBreak: 'break-all' }}>
              Share link: {shareMessage}
            </div>
          )}
          {mode === 'ai' && (
            <div className="animate-fade-in">
              <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                Zero-cost mode: quizzes are generated locally unless a free API provider is configured later.
              </div>
              <label>Topic</label>
              <input
                placeholder="e.g. React Hooks, Machine Learning..."
                value={form.topic}
                onChange={e => setForm({ ...form, topic: e.target.value })}
                style={{ marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" onClick={() => handleAIGenerate(5)} disabled={saving}>
                  {saving ? 'Generating...' : 'Generate 5 Questions'}
                </button>
                <button className="btn-primary" style={{ background: 'var(--accent-color)' }} onClick={() => handleAIGenerate(50)} disabled={saving}>
                  {saving ? 'Generating...' : 'Generate 50 Questions'}
                </button>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <label>Target Classes for these questions</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['DA', 'CYBERSECURITY', 'CSC', 'AIML'].map(cls => (
                    <button
                      key={cls}
                      type="button"
                      className={`badge ${form.targetClasses.includes(cls) ? 'active' : ''}`}
                      style={{ cursor: 'pointer', padding: '0.5rem 1rem', border: '1px solid var(--surface-border)', background: form.targetClasses.includes(cls) ? 'var(--primary-color)' : 'white', color: form.targetClasses.includes(cls) ? 'white' : 'var(--text-main)' }}
                      onClick={() => {
                        const next = form.targetClasses.includes(cls)
                          ? form.targetClasses.filter(c => c !== cls)
                          : [...form.targetClasses, cls];
                        setForm({ ...form, targetClasses: next });
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {mode === 'manual' && (
            <form onSubmit={handleSubmitManual} className="animate-fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div><label>Quiz Title</label><input value={form.title} placeholder="e.g. Intro to Quantum" onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                <div><label>Topic Slug</label><input value={form.topic} placeholder="e.g. quantum-101" onChange={e => setForm({ ...form, topic: e.target.value })} required /></div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Target Classes (Multi-select)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {['DA', 'CYBERSECURITY', 'CSC', 'AIML'].map(cls => (
                    <button
                      key={cls}
                      type="button"
                      className={`badge ${(form.targetClasses || []).includes(cls) ? 'active' : ''}`}
                      style={{ cursor: 'pointer', padding: '0.5rem 1rem', border: '1px solid var(--surface-border)', background: (form.targetClasses || []).includes(cls) ? 'var(--primary-color)' : 'white', color: (form.targetClasses || []).includes(cls) ? 'white' : 'var(--text-main)' }}
                      onClick={() => {
                        const currentClasses = form.targetClasses || [];
                        const next = currentClasses.includes(cls)
                          ? currentClasses.filter(c => c !== cls)
                          : [...currentClasses, cls];
                        setForm({ ...form, targetClasses: next });
                      }}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>If none selected, the quiz targets ALL classes.</p>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '0.875rem', borderRadius: '8px', border: '1px solid var(--surface-border)', minHeight: '80px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h4 style={{ fontWeight: '800' }}>Questions ({form.questions.length})</h4>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}
                >
                  <Plus size={14} /> Add Question
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {form.questions.map((q, qIdx) => (
                  <div key={qIdx} className="card" style={{ background: '#f8fafc', border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>Question #{qIdx + 1}</span>
                      {form.questions.length > 1 && (
                        <button
                          type="button"
                          style={{ color: 'var(--danger-color)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            const qs = [...form.questions];
                            qs.splice(qIdx, 1);
                            setForm({ ...form, questions: qs });
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <label>Question Prompt</label>
                    <input
                      value={q.prompt}
                      onChange={e => {
                        const qs = [...form.questions];
                        qs[qIdx].prompt = e.target.value;
                        setForm({ ...form, questions: qs });
                      }}
                      style={{ marginBottom: '1rem' }}
                      required
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx}>
                          <label style={{ fontSize: '0.75rem' }}>Option {oIdx + 1}</label>
                          <input
                            value={opt}
                            onChange={e => {
                              const qs = [...form.questions];
                              qs[qIdx].options[oIdx] = e.target.value;
                              setForm({ ...form, questions: qs });
                            }}
                            required
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label>Correct Answer</label>
                        <select
                          value={q.answerIndex}
                          onChange={e => {
                            const qs = [...form.questions];
                            qs[qIdx].answerIndex = parseInt(e.target.value);
                            setForm({ ...form, questions: qs });
                          }}
                        >
                          {q.options.map((_, i) => <option key={i} value={i}>Option {i + 1}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Question Timer (Seconds)</label>
                        <input
                          type="number"
                          value={q.timer}
                          onChange={e => {
                            const qs = [...form.questions];
                            qs[qIdx].timer = parseInt(e.target.value);
                            setForm({ ...form, questions: qs });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '2rem', width: '100%' }} disabled={saving}>
                {saving ? 'Publishing...' : 'Publish Manual Quiz'}
              </button>
            </form>
          )}
          {mode === 'pdf' && (
            <div className="animate-fade-in" style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--surface-border)', borderRadius: '12px' }}>
              <input
                type="file"
                id="pdf-upload"
                hidden
                accept=".pdf"
                onChange={e => setPdfFile(e.target.files[0])}
              />
              <Upload size={48} color={pdfFile ? 'var(--primary-color)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
              {pdfFile ? (
                <div>
                  <p style={{ fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{pdfFile.name}</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button className="btn-primary" onClick={handlePDFUpload} disabled={saving}>
                      {saving ? 'Processing...' : 'Generate from PDF'}
                    </button>
                    <button className="button ghost" onClick={() => setPdfFile(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Upload your syllabus or text-heavy PDF to generate questions</p>
                  <button className="btn-outline" onClick={() => document.getElementById('pdf-upload').click()}>Select PDF File</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Settings Grid Panel */}
      <div className="hero-summary" style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={20} /> Quiz Settings
        </h3>
      </div>
      <div className="settings-panel">
        <div>
          <label>Question Timer</label>
          <select value={settings.timer} onChange={e => setSettings({ ...settings, timer: Number(e.target.value) })}>
            <option value={10}>10 seconds</option>
            <option value={20}>20 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
          </select>
        </div>
        <div className="toggle-group">
          <span>Shuffle Questions</span>
          <label className="switch">
            <input type="checkbox" checked={settings.shuffleQuestions} onChange={e => setSettings({ ...settings, shuffleQuestions: e.target.checked })} />
            <span className="slider"></span>
          </label>
        </div>
        <div className="toggle-group">
          <span>Shuffle Options</span>
          <label className="switch">
            <input type="checkbox" checked={settings.shuffleOptions} onChange={e => setSettings({ ...settings, shuffleOptions: e.target.checked })} />
            <span className="slider"></span>
          </label>
        </div>
        <div className="toggle-group">
          <span>Instant Feedback</span>
          <label className="switch">
            <input type="checkbox" checked={settings.instantFeedback} onChange={e => setSettings({ ...settings, instantFeedback: e.target.checked })} />
            <span className="slider"></span>
          </label>
        </div>
        <div className="toggle-group">
          <span>Lock Backward</span>
          <label className="switch">
            <input type="checkbox" checked={settings.lockBackward} onChange={e => setSettings({ ...settings, lockBackward: e.target.checked })} />
            <span className="slider"></span>
          </label>
        </div>
      </div>
      {/* Lists */}
      <div className="admin-grid">
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: '800' }}>My Quizzes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.quizzes.map(q => (
              <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                <div>
                  <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{q.title} <span className="badge" style={{ background: '#dcfce7', color: '#166534', marginLeft: '0.5rem' }}>active</span></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {q.questionCount} questions • {q.attempts} attempts • Avg {q.avgScore}%
                    {q.requiresStart && <> • Waiting {q.liveWaitingCount || 0} • Submitted {q.liveSubmittedCount || 0}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {q.requiresStart && (
                    <>
                      <button className="btn-outline" title="Copy room link" style={{ padding: '0.5rem' }} onClick={() => copyShareLink(q.id)}><Copy size={16} /></button>
                      <button className="btn-outline" title="Start quiz" style={{ padding: '0.5rem', color: q.liveStarted ? 'var(--success-color)' : 'var(--primary-color)' }} onClick={() => startLiveQuiz(q)} disabled={q.liveStarted}>
                        <PlayCircle size={16} />
                      </button>
                      <button className="btn-outline" title="Live analysis" style={{ padding: '0.5rem' }} onClick={() => { setLiveData(null); setSelectedLiveQuiz(q); }}><Radio size={16} /></button>
                    </>
                  )}
                  <button className="btn-outline" style={{ padding: '0.5rem' }} onClick={() => viewResults(q.id)}><FileText size={16} /></button>
                  <button
                    className="btn-outline"
                    style={{ padding: '0.5rem', color: 'var(--danger-color)' }}
                    onClick={() => handleDelete(q.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: '800' }}>Live Monitor</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.liveSessions?.length > 0 ? (
              data.liveSessions.map(s => (
                <div key={s.userId} style={{ padding: '1rem', borderBottom: '1px solid var(--surface-border)' }}>
                  <div style={{ fontWeight: '600' }}>{s.userName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Taking: {s.quizTitle}</div>
                  {s.alerts > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--danger-color)', fontWeight: '700' }}>{s.alerts} Alerts</div>}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No active test sessions.</div>
            )}
          </div>
        </div>
      </div>
      {/* Live Quiz Analysis */}
      {selectedLiveQuiz && (
        <div className="modal-overlay" onClick={() => { setSelectedLiveQuiz(null); setLiveData(null); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-start' }}>
              <div>
                <span className="eyebrow">Live Analysis</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{liveData?.quiz?.title || selectedLiveQuiz.title}</h2>
                <p style={{ color: 'var(--text-muted)' }}>{liveData?.room?.started ? 'Quiz is running.' : 'Students can join the waiting room. Start when ready.'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn-outline" onClick={() => copyShareLink(selectedLiveQuiz.id)}><Copy size={16} /> Share</button>
                {!liveData?.room?.started && <button className="btn-primary" onClick={() => startLiveQuiz(selectedLiveQuiz)}><PlayCircle size={16} /> Start Quiz</button>}
                <button className="btn-outline" onClick={resetLiveQuiz}><RotateCcw size={16} /> Reset</button>
                <button className="button ghost" onClick={() => { setSelectedLiveQuiz(null); setLiveData(null); }}>Close</button>
              </div>
            </div>

            {!liveData ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading live room...</div>
            ) : (
              <>
                {liveData.room.bannedCount > 0 && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800' }}>
                    <ShieldAlert size={20} /> {liveData.room.bannedCount} student(s) auto-ended for 3 tab switches.
                  </div>
                )}
                <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
                  <button className={`role-btn ${liveView === 'overview' ? 'active' : ''}`} onClick={() => setLiveView('overview')} style={{ padding: '0.65rem 1rem' }}>Overview</button>
                  <button className={`role-btn ${liveView === 'cheating' ? 'active' : ''}`} onClick={() => setLiveView('cheating')} style={{ padding: '0.65rem 1rem' }}>Cheating</button>
                </div>
                <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
                  <div className="metric-card"><span>Total Students</span><strong>{liveData.room.totalStudents}</strong></div>
                  <div className="metric-card"><span>Submitted</span><strong>{liveData.room.submittedCount}</strong></div>
                  <div className="metric-card"><span>Average Score</span><strong>{liveData.room.averageScore}%</strong></div>
                  <div className="metric-card"><span>Alerts / Banned</span><strong>{liveData.room.alertCount || 0} <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/</span> <span style={{ color: 'var(--danger-color)' }}>{liveData.room.bannedCount || 0}</span></strong></div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--surface-border)' }}>
                        <th style={{ padding: '1rem' }}>Student</th>
                        <th style={{ padding: '1rem' }}>Answered</th>
                        <th style={{ padding: '1rem' }}>Live Score</th>
                        <th style={{ padding: '1rem' }}>Alerts</th>
                        <th style={{ padding: '1rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(liveView === 'cheating' ? cheatingParticipants : liveData.room.participants).map((student) => (
                        <tr key={student.userId} style={{ borderBottom: '1px solid var(--surface-border)', background: student.isCheated ? '#fef2f2' : (student.alerts > 0 && liveView === 'cheating' ? '#fffbeb' : 'transparent') }}>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
                              {student.alerts > 0 ? <ShieldAlert size={16} color="var(--danger-color)" /> : <Users size={16} color="var(--primary-color)" />} {student.displayName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{student.email}</div>
                            {student.parentEmail && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parent: {student.parentEmail}</div>}
                          </td>
                          <td style={{ padding: '1rem' }}>{student.answersCount}/{student.totalQuestions}</td>
                          <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary-color)' }}>{student.score}% <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>{student.avgTimePerQuestion || 0}s / q</span></td>
                          <td style={{ padding: '1rem', color: student.alerts > 0 ? 'var(--danger-color)' : 'var(--text-muted)', fontWeight: '700' }}>{student.alerts}</td>
                          <td style={{ padding: '1rem' }}>
                            {student.isCheated ? (
                              <span style={{ color: 'var(--danger-color)', fontWeight: '800' }}>VOIDED</span>
                            ) : student.submitted ? (
                              <span style={{ color: student.passed ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: '800' }}>{student.passed ? 'PASSED' : 'FAILED'}</span>
                            ) : (
                              <span style={{ color: liveData.room.started ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: '700' }}>{liveData.room.started ? 'IN PROGRESS' : 'WAITING'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {liveData.room.participants.length === 0 && (
                        <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students have joined yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Detailed Results Modal / View */}
      {selectedQuizResults && (
        <div className="modal-overlay" onClick={() => setSelectedQuizResults(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Results: {selectedQuizResults.quizTitle}</h2>
                <p style={{ color: 'var(--text-muted)' }}>Detailed performance metrics per student.</p>
              </div>
              <button className="button ghost" onClick={() => setSelectedQuizResults(null)}>Close</button>
            </div>
            
            <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
              <div className="metric-card"><span>Pass Rate</span><strong>{selectedQuizResults.stats?.passRate ?? 0}%</strong></div>
              <div className="metric-card"><span>Avg Score</span><strong>{selectedQuizResults.stats?.avgScore ?? 0}%</strong></div>
              <div className="metric-card"><span>Accuracy</span><strong>{selectedQuizResults.stats?.accuracy ?? 0}%</strong></div>
              <div className="metric-card" style={{ color: 'var(--danger-color)' }}><span>Alerts</span><strong>{selectedQuizResults.stats?.totalAlerts ?? 0}</strong></div>
            </div>

            <div className="card" style={{ background: '#f8fafc', marginBottom: '2rem' }}>
              <h3 style={{ fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Target size={18} /> Question Analytics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(selectedQuizResults.questionStats || []).map((q, idx) => (
                  <div key={q.questionId} style={{ background: 'white', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                      <strong style={{ fontSize: '0.875rem' }}>Q{idx + 1}. {q.prompt}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{q.avgTimeSeconds}s avg</span>
                    </div>
                    <div style={{ height: '8px', background: '#fee2e2', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                      <div style={{ width: `${q.accuracy}%`, background: 'var(--success-color)', height: '100%' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <span>{q.correct} correct / {q.wrong} wrong / {q.skipped} skipped</span>
                      <span>{q.accuracy}% accuracy</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--surface-border)' }}>
                    <th style={{ padding: '1rem' }}>Student</th>
                    <th style={{ padding: '1rem' }}>Class</th>
                    <th style={{ padding: '1rem' }}>Score</th>
                    <th style={{ padding: '1rem' }}>Right/Wrong</th>
                    <th style={{ padding: '1rem' }}>Time</th>
                    <th style={{ padding: '1rem' }}>Alerts</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedQuizResults.studentResults || []).map((r, i) => (
                    <React.Fragment key={i}>
                      <tr style={{ borderBottom: '1px solid var(--surface-border)', background: r.isCheated ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '1rem', fontWeight: '600' }}>
                          {r.userName}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{r.email}</div>
                          {r.parentEmail && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Parent: {r.parentEmail}</div>}
                        </td>
                        <td style={{ padding: '1rem' }}><span className="badge">{r.userClass}</span></td>
                        <td style={{ padding: '1rem', fontWeight: '800', color: 'var(--primary-color)' }}>{r.score}%</td>
                        <td style={{ padding: '1rem' }}>{r.correctAnswers}/{r.wrongAnswers}</td>
                        <td style={{ padding: '1rem' }}><Clock3 size={14} /> {r.avgTimePerQuestion}s/q</td>
                        <td style={{ padding: '1rem', color: r.alerts ? 'var(--danger-color)' : 'var(--text-muted)', fontWeight: '800' }}>{r.alerts}</td>
                        <td style={{ padding: '1rem' }}>
                          {r.isCheated ? (
                            <span style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '700' }}><Activity size={12} /> VOIDED</span>
                          ) : (
                            r.passed ? <span style={{ color: 'var(--success-color)', fontWeight: '700' }}>PASSED</span> : <span style={{ color: '#ef4444', fontWeight: '700' }}>FAILED</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(r.takenAt).toLocaleDateString()}</td>
                      </tr>
                      <tr>
                        <td colSpan="8" style={{ padding: '0 1rem 1rem' }}>
                          <details>
                            <summary style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: '800', fontSize: '0.8125rem' }}>View answers and timing</summary>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                              {(r.answers || []).map((answer, answerIdx) => (
                                <div key={answer.questionId} style={{ background: answer.isCorrect ? '#f0fdf4' : '#fef2f2', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '0.875rem' }}>
                                  <div style={{ fontWeight: '800', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Q{answerIdx + 1} • {answer.timeSpentSeconds}s</div>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>{answer.prompt}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected: {answer.selectedOption || 'No answer'}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700' }}>Correct: {answer.correctOption}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {(selectedQuizResults.studentResults || []).length === 0 && (
                    <tr><td colSpan="8" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No attempts recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {selectedStudentReport && (
        <div className="modal-overlay" onClick={() => setSelectedStudentReport(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-start' }}>
              <div>
                <span className="eyebrow">Student Report</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '0.25rem' }}>{selectedStudentReport.user.name}</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                  {selectedStudentReport.user.email} • {selectedStudentReport.user.userClass || 'Unassigned'}
                  {selectedStudentReport.user.parentEmail ? ` • Parent: ${selectedStudentReport.user.parentEmail}` : ''}
                </p>
              </div>
              <button className="button ghost" onClick={() => setSelectedStudentReport(null)}>Close</button>
            </div>

            <div className="metrics-grid" style={{ marginBottom: '2rem' }}>
              <div className="metric-card"><span>Rank Points</span><strong>{selectedStudentReport.progress.stats.rankPoints}</strong></div>
              <div className="metric-card"><span>Class Rank</span><strong>{selectedStudentReport.classRank ? `#${selectedStudentReport.classRank}` : 'N/A'}</strong></div>
              <div className="metric-card"><span>Avg Score</span><strong>{selectedStudentReport.progress.stats.averageScore}%</strong></div>
              <div className="metric-card" style={{ color: selectedStudentReport.progress.stats.totalAlerts ? 'var(--danger-color)' : 'var(--text-main)' }}><span>Alerts / Voids</span><strong>{selectedStudentReport.progress.stats.totalAlerts} / {selectedStudentReport.progress.stats.cheatedCount}</strong></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(selectedStudentReport.attempts || []).map((attempt) => (
                <div key={attempt.id} style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '1rem', background: attempt.isCheated ? '#fef2f2' : '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <div>
                      <strong>{attempt.quizTitle}</strong>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{attempt.quizType} • {new Date(attempt.takenAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="badge" style={{ background: attempt.isCheated ? '#fee2e2' : '#eef2ff', color: attempt.isCheated ? 'var(--danger-color)' : 'var(--primary-color)' }}>{attempt.isCheated ? 'VOIDED' : (attempt.passed ? 'PASSED' : 'FAILED')}</span>
                      <span className="badge">{attempt.score}%</span>
                      <span className="badge">{attempt.correctAnswers}/{attempt.totalQuestions} right</span>
                      <span className="badge">{attempt.avgTimePerQuestion}s/q</span>
                      <span className="badge" style={{ color: attempt.alerts ? 'var(--danger-color)' : 'var(--text-muted)' }}>{attempt.alerts} alerts</span>
                    </div>
                  </div>
                  <details>
                    <summary style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: '800', fontSize: '0.8125rem' }}>View answers and timing</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                      {(attempt.answers || []).map((answer, answerIdx) => (
                        <div key={answer.questionId || `${attempt.id}-${answerIdx}`} style={{ background: answer.isCorrect ? '#f0fdf4' : '#fff', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '0.875rem' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Q{answerIdx + 1} • {answer.timeSpentSeconds}s</div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: '700', marginBottom: '0.5rem' }}>{answer.prompt}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selected: {answer.selectedOption || 'No answer'}</div>
                          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '700' }}>Correct: {answer.correctOption}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
              {(selectedStudentReport.attempts || []).length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No quiz attempts recorded for this student yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
