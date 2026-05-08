import React, { useState, useEffect } from 'react';
import api from './api';
import { Trophy, Medal, Target, TrendingUp, ShieldAlert } from 'lucide-react';
import { useAuth } from './context/AuthContext';
export default function Leaderboard() {
  const [board, setBoard] = useState([]);
  const [classBoard, setClassBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('global'); // 'global' or 'class'
  const { user } = useAuth();

  useEffect(() => {
    api.get('/leaderboard')
      .then(res => {
        setBoard(res.data.leaderboard || []);
        setClassBoard(res.data.classLeaderboard || []);
      })
      .catch(err => console.error('Failed to load leaderboard', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-muted)' }}>Loading live rankings...</div>;
  }

  const filteredBoard = viewMode === 'global' ? board : classBoard;

  const getRankBadge = (index) => {
    if (index === 0) return { bg: '#FEF3C7', color: '#D97706', label: '1ST', icon: <Trophy size={18} /> };
    if (index === 1) return { bg: '#F1F5F9', color: '#64748B', label: '2ND', icon: <Medal size={18} /> };
    if (index === 2) return { bg: '#FFEDD5', color: '#C2410C', label: '3RD', icon: <Medal size={18} /> };
    return { bg: 'transparent', color: 'var(--text-muted)', label: `#${index + 1}` };
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', background: '#eef2ff', borderRadius: '50%', color: 'var(--primary-color)', marginBottom: '1rem' }}>
          <Trophy size={48} />
        </div>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          {viewMode === 'global' ? 'Global Leaderboard' : `${user?.userClass || 'Class'} Leaderboard`}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto', marginBottom: '2rem' }}>
          {viewMode === 'global' 
            ? 'Compete with top-tier candidates worldwide.' 
            : `Top performers from your ${user?.userClass} cohort.`}
          {' '}Rank points combine skills, quiz scores, streaks, and cheating penalties.
        </p>

        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: '12px', marginBottom: '1rem' }}>
          <button 
            onClick={() => setViewMode('global')}
            style={{ 
              padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', 
              background: viewMode === 'global' ? 'white' : 'transparent',
              color: viewMode === 'global' ? 'var(--primary-color)' : 'var(--text-muted)',
              fontWeight: '700', fontSize: '0.9375rem', cursor: 'pointer',
              boxShadow: viewMode === 'global' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Global
          </button>
          <button 
            onClick={() => setViewMode('class')}
            style={{ 
              padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', 
              background: viewMode === 'class' ? 'white' : 'transparent',
              color: viewMode === 'class' ? 'var(--primary-color)' : 'var(--text-muted)',
              fontWeight: '700', fontSize: '0.9375rem', cursor: 'pointer',
              boxShadow: viewMode === 'class' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            My Class ({user?.userClass})
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1fr 1fr 1fr 1fr', background: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '2px solid var(--surface-border)', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <div>Rank</div>
          <div>Student Name</div>
          <div style={{ textAlign: 'center' }}>Points</div>
          <div style={{ textAlign: 'center' }}>Skills</div>
          <div style={{ textAlign: 'center' }}>Accuracy</div>
          <div style={{ textAlign: 'right' }}>Alerts</div>
        </div>

        {filteredBoard.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No rankings found in this category.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredBoard.map((student, i) => {
              const badge = getRankBadge(i);
              const isCurrentUser = user && user.id === student.id;
              return (
                <div key={student.id} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 1fr 1fr 1fr 1fr', padding: '1.25rem 1.5rem', alignItems: 'center', borderBottom: i < filteredBoard.length - 1 ? '1px solid var(--surface-border)' : 'none', background: isCurrentUser ? '#f0fdf4' : 'transparent', transition: 'background 0.2s', cursor: 'default' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '8px', background: badge.bg, color: badge.color, fontWeight: '700', fontSize: '0.875rem', minWidth: '40px' }}>
                      {badge.icon} {badge.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700', fontSize: '1.125rem', color: isCurrentUser ? '#166534' : 'var(--text-main)' }}>{student.name}</span>
                      {viewMode === 'global' && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{student.userClass || 'Unassigned'}</span>}
                    </div>
                    {isCurrentUser && <span className="badge" style={{ background: '#bbf7d0', color: '#166534', border: '1px solid #86efac' }}>YOU</span>}
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary-color)' }}>{student.rankPoints}</span>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>{student.skills}</span>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, color: 'var(--text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                    <Target size={16} color="var(--text-muted)" /> {student.accuracy}%
                  </div>
                  <div style={{ textAlign: 'right', flex: 1, color: student.totalAlerts ? 'var(--danger-color)' : 'var(--success-color)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                    {student.totalAlerts ? <ShieldAlert size={16} /> : <TrendingUp size={16} />} {student.totalAlerts}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
