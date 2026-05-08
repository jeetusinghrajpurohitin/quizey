import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from './api';
import { Clock, AlertTriangle, ArrowRight, CheckCircle, XCircle, Brain, FileText } from 'lucide-react';
import { useAuth } from './context/AuthContext';
export default function Quiz() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [revealed, setRevealed] = useState([]); // Track matching currentIndex for instant feedback
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);
  const [questionTimes, setQuestionTimes] = useState([]);

  // Anti-Cheating
  const [alerts, setAlerts] = useState(0);
  const isSubmitProcessRef = useRef(false);
  const alertsRef = useRef(0);
  const resultRef = useRef(null);
  const questionStartedAtRef = useRef(Date.now());
  // Keep refs in sync with state for stale closure protection
  useEffect(() => { resultRef.current = result; }, [result]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);
  const captureQuestionTimes = useCallback(() => {
    const elapsed = Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000));
    const next = [...questionTimes];
    next[currentIndex] = Math.max(next[currentIndex] || 0, elapsed);
    return next;
  }, [currentIndex, questionTimes]);
  const handleForceEndByCheating = useRef(null);
  handleForceEndByCheating.current = () => {
    if (isSubmitProcessRef.current) return;
    isSubmitProcessRef.current = true;
    const nextTimes = captureQuestionTimes();
    setQuestionTimes(nextTimes);
    api.post(`/quizzes/${quizId}/submit`, { answers, questionTimes: nextTimes, isCheated: true, alerts: alertsRef.current })
      .then(res => {
        setResult(res.data.result);
      })
      .catch(() => {
        setError('Failed to submit voided exam.');
      });
  };
  useEffect(() => {
    // 1. Fetch Quiz
    api.get(`/quizzes/${quizId}`)
      .then(res => {
        const quizData = res.data.quiz;
        const partial = res.data.partial;

        setQuiz(quizData);
        if (partial) {
          setAnswers(partial.answers);
          setCurrentIndex(partial.currentIndex || 0);
          setAlerts(partial.alerts || 0);
          setRevealed(partial.revealed || new Array(quizData.questions.length).fill(false));
          setTimeLeft(partial.timeLeft ?? null);
          setQuestionTimes(partial.questionTimes || new Array(quizData.questions.length).fill(0));
        } else {
          setAnswers(new Array(quizData.questions.length).fill(null));
          setRevealed(new Array(quizData.questions.length).fill(false));
          setTimeLeft(null);
          setQuestionTimes(new Array(quizData.questions.length).fill(0));
        }
        questionStartedAtRef.current = Date.now();
        if (user) {
          api.post('/quiz/session/start', { quizId, quizTitle: quizData.title }).catch(() => { });
        }
      })
      .catch(err => {
        if (err.response?.data?.waitingRoomRequired) {
          navigate(`/join/${quizId}`, { replace: true });
          return;
        }
        setError(err.response?.data?.message || 'Failed to load quiz');
      })
      .finally(() => setLoading(false));

    // 2. Tab visibility and blur listener
    let lastAlertTime = 0;
    const handleCheatingAttempt = () => {
      const now = Date.now();
      if (isSubmitProcessRef.current) return;
      if (resultRef.current !== null) return;
      const left = document.hidden || !document.hasFocus();
      if (!left) return;

      if (now - lastAlertTime < 2000) return;
      lastAlertTime = now;
      
      api.post('/quiz/session/alert').then(res => {
        let newAlerts = res.data.alerts;
        if (newAlerts === -1) {
          newAlerts = alertsRef.current + 1;
        }
        alertsRef.current = newAlerts;
        setAlerts(newAlerts);
        if (newAlerts >= 3) {
          handleForceEndByCheating.current();
        }
      }).catch(err => {
        console.error("Cheat alert err:", err);
        const newAlerts = alertsRef.current + 1;
        alertsRef.current = newAlerts;
        setAlerts(newAlerts);
        if (newAlerts >= 3) {
          handleForceEndByCheating.current();
        }
      });
    };

    document.addEventListener("visibilitychange", handleCheatingAttempt);
    window.addEventListener("blur", handleCheatingAttempt);
    // 4. Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleCheatingAttempt);
      window.removeEventListener("blur", handleCheatingAttempt);
      if (user) {
        api.post('/quiz/session/end').catch(() => { });
      }
    };
  }, [quizId, user, navigate]);
  useEffect(() => {
    if (!quiz || result || isSubmitProcessRef.current) return;

    const saveProgress = async () => {
      try {
        await api.post(`/quizzes/${quizId}/progress`, {
          answers,
          currentIndex,
          alerts: alertsRef.current,
          revealed,
          timeLeft,
          questionTimes
        });
      } catch (e) {
        console.error("Failed to save progress", e);
      }
    };

    const timer = setTimeout(saveProgress, 1000); // Debounce save
    return () => clearTimeout(timer);
  }, [quiz, answers, currentIndex, result, quizId, revealed, timeLeft, questionTimes]);

  // ... previous effects ...

  // Timer logic
  useEffect(() => {
    if (!quiz || result || isSubmitProcessRef.current) return;

    if (quiz.settings?.totalTimerSeconds) {
      setTimeLeft(prev => (prev === null || prev === undefined ? quiz.settings.totalTimerSeconds : prev));
      questionStartedAtRef.current = Date.now();
      return;
    }

    const q = quiz.questions[currentIndex];
    const duration = q.timer || quiz.settings?.timer || 20;
    setTimeLeft(duration);
    questionStartedAtRef.current = Date.now();
  }, [quiz, currentIndex, result]);

  const handleNext = useCallback(() => {
    if (quiz?.settings?.lockBackward && answers[currentIndex] === null) return;
    if (quiz && currentIndex < quiz.questions.length - 1) {
      setQuestionTimes(captureQuestionTimes());
      setCurrentIndex(p => p + 1);
    }
  }, [answers, captureQuestionTimes, currentIndex, quiz]);
  const handlePrev = useCallback(() => {
    if (quiz?.settings?.lockBackward) return;
    if (currentIndex > 0) {
      setQuestionTimes(captureQuestionTimes());
      setCurrentIndex(p => p - 1);
    }
  }, [captureQuestionTimes, currentIndex, quiz]);
  const submitQuiz = useCallback(() => {
    isSubmitProcessRef.current = true;
    const nextTimes = captureQuestionTimes();
    setQuestionTimes(nextTimes);
    api.post(`/quizzes/${quizId}/submit`, { answers, questionTimes: nextTimes, isCheated: false, alerts: alertsRef.current })
      .then(res => {
        setResult(res.data.result);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to submit quiz');
        isSubmitProcessRef.current = false;
      });
  }, [answers, captureQuestionTimes, quizId]);

  useEffect(() => {
    if (timeLeft === null || !quiz || result || isSubmitProcessRef.current) return;
    if (timeLeft <= 0) {
      if (quiz.settings?.totalTimerSeconds) {
        submitQuiz();
      } else if (currentIndex < quiz.questions.length - 1) {
        handleNext();
      } else {
        submitQuiz();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, result, currentIndex, quiz, handleNext, submitQuiz]);
  if (loading) return <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>Loading protocol...</div>;
  if (error) return <div style={{ textAlign: 'center', marginTop: '4rem', color: '#ef4444' }}>{error}</div>;
  if (!quiz) return null;
  if (result) {
    if (result.isCheated) {
      return (
        <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', borderTop: '4px solid var(--danger-color)' }}>
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '50%', color: 'var(--danger-color)' }}><AlertTriangle size={48} /></div>
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--danger-color)', marginBottom: '1rem' }}>EXAM TERMINATED</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>You triggered 3 tab-switching security alerts. Your exam has been voided and submitted with a 0% score.</p>
          <button className="btn-outline" style={{ margin: '0 auto', width: '200px' }} onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}>Exit Area</button>
        </div>
      );
    }
    return (
      <div className="animate-fade-in card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          {result.passed ? (
            <div style={{ background: 'var(--primary-light)', padding: '1rem', borderRadius: '50%', color: 'var(--primary-color)' }}><CheckCircle size={48} /></div>
          ) : (
            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '50%', color: 'var(--danger-color)' }}><XCircle size={48} /></div>
          )}
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          {result.score}%
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          You got {result.correctAnswers} out of {result.totalQuestions} correct.
        </p>
        {result.passed ? (
          <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.125rem' }}>Congratulations!</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-main)', fontSize: '0.875rem' }}>
                    {result.unlockedSkill ? `You unlocked the "${result.unlockedSkill}" skill badge!` : 'You passed the quiz!'}
                  </p>
                  {result.rankPoints !== undefined && <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Current rank points: {result.rankPoints}</p>}
                </div>
        ) : (
          <div style={{ background: '#fef2f2', border: '1px solid var(--danger-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <h3 style={{ margin: 0, color: 'var(--danger-color)', fontSize: '1.125rem' }}>Keep Trying!</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-main)', fontSize: '0.875rem' }}>You need {quiz.passScore}% to pass this quiz.</p>
                  {result.rankPoints !== undefined && <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Current rank points: {result.rankPoints}</p>}
                </div>
        )}
        <button className="btn-outline" style={{ margin: '0 auto', maxWidth: '300px', marginBottom: '3rem' }} onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}>
          Back to Dashboard
        </button>

        <div style={{ textAlign: 'left', borderTop: '1px solid var(--surface-border)', paddingTop: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} /> Question Review
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {(result.review || []).map((answer, i) => {
              const isCorrect = answer.isCorrect;
              return (
                <div key={answer.questionId || i} className="card" style={{ padding: '1.5rem', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Question {i + 1}</span>
                    <span style={{ 
                      padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700',
                      background: isCorrect ? '#dcfce7' : '#fef2f2',
                      color: isCorrect ? '#166534' : '#991b1b'
	                    }}>
	                      {isCorrect ? 'CORRECT' : 'INCORRECT'}
	                    </span>
	                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.75rem' }}>Time spent: {answer.timeSpentSeconds || 0}s</div>
                  <p style={{ fontWeight: '600', marginBottom: '1rem' }}>{answer.prompt}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {answer.options.map((opt, oIdx) => (
                      <div key={oIdx} style={{ 
                        padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem',
                        border: '1px solid',
                        borderColor: oIdx === answer.correctIndex ? 'var(--success-color)' : (oIdx === answer.selectedIndex ? '#ef4444' : 'var(--surface-border)'),
                        background: oIdx === answer.correctIndex ? '#f0fdf4' : (oIdx === answer.selectedIndex ? '#fef2f2' : 'white'),
                        color: oIdx === answer.correctIndex ? '#166534' : (oIdx === answer.selectedIndex ? '#991b1b' : 'var(--text-main)')
                      }}>
                        {opt} {oIdx === answer.correctIndex && '(correct)'}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#eef2ff', borderRadius: '8px', borderLeft: '4px solid var(--primary-color)' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      <strong>Explanation:</strong> {answer.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
            {(result.review || []).length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Review will appear here after your next completed attempt.</div>
            )}
          </div>
        </div>
      </div>
    );
  }
  const currentQ = quiz.questions[currentIndex];
  const allAnswered = answers.every(a => a !== null);
  const lockBackward = Boolean(quiz.settings?.lockBackward);
  const usesTotalTimer = Boolean(quiz.settings?.totalTimerSeconds);
  const minutes = Math.floor((timeLeft || 0) / 60);
  const seconds = String((timeLeft || 0) % 60).padStart(2, '0');
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '6rem' }}>
      {alerts > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
          <AlertTriangle size={18} /> SECURITY WARNING: {alerts}/3 Tab Switches Detected. Do not leave this tab.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: '700' }}>{quiz.title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: timeLeft < 5 ? '#fef2f2' : '#f8fafc',
            color: timeLeft < 5 ? 'var(--danger-color)' : 'var(--text-muted)',
            borderRadius: '99px',
            fontWeight: '700',
            border: `1px solid ${timeLeft < 5 ? 'var(--danger-color)' : 'var(--surface-border)'}`,
            transition: 'all 0.3s'
          }}>
            <Clock size={16} /> {usesTotalTimer ? `${minutes}:${seconds}` : `${timeLeft}s`}
          </div>
        </div>
      </div>
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '500' }}>
          <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
          <span>{Math.round(((currentIndex + 1) / quiz.questions.length) * 100)}% Completed</span>
        </div>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '2rem', lineHeight: 1.5 }}>
          {currentQ.prompt}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {currentQ.options.map((opt, i) => {
            const isSelected = answers[currentIndex] === i;
            return (
              <button
                key={i}
                onClick={() => {
                  const newAns = [...answers];
                  newAns[currentIndex] = i;
                  setAnswers(newAns);
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '1rem 1.5rem', borderRadius: '8px', border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--surface-border)'}`,
                  background: isSelected ? '#eef2ff' : 'transparent', color: isSelected ? 'var(--primary-color)' : 'var(--text-main)', fontWeight: isSelected ? '600' : '400', cursor: 'pointer', transition: 'all 0.2s', fontSize: '1rem'
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {/* Instant Feedback Explanation */}
        {quiz.settings?.instantFeedback && revealed[currentIndex] && (
          <div className="animate-fade-in" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0f9ff', borderLeft: '4px solid #0ea5e9', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#0369a1', fontWeight: '700' }}>
              <Brain size={18} /> Explanation
            </div>
            <p style={{ color: 'var(--text-main)', margin: 0, fontSize: '0.9375rem', lineHeight: 1.6 }}>
              {currentQ.explanation}
            </p>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
        <button className="btn-outline" style={{ width: '120px' }} onClick={handlePrev} disabled={currentIndex === 0 || revealed[currentIndex] || lockBackward}>
          Previous
        </button>
        
        {quiz.settings?.instantFeedback && !revealed[currentIndex] ? (
          <button 
            className="btn-primary" 
            style={{ width: '160px' }} 
            disabled={answers[currentIndex] === null}
            onClick={() => {
              const nextRev = [...revealed];
              nextRev[currentIndex] = true;
              setRevealed(nextRev);
            }}
          >
            Check Answer
          </button>
        ) : (
          currentIndex === quiz.questions.length - 1 ? (
            <button className="btn-primary" style={{ width: 'auto', padding: '0 2rem' }} onClick={submitQuiz} disabled={!allAnswered}>
              Submit Protocol <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
            </button>
          ) : (
            <button className="btn-primary" style={{ width: '120px' }} onClick={handleNext} disabled={lockBackward && answers[currentIndex] === null}>
              Next
            </button>
          )
        )}
      </div>
    </div>
  );
}
