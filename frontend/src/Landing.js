import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Activity, Shield, BarChart2, Users, Award, Zap, Share2, Monitor, ArrowRight } from 'lucide-react';
export default function Landing() {
  const stats = [
    { label: 'Active Quizzes', value: '10K+' },
    { label: 'Students', value: '50K+' },
    { label: 'Uptime', value: '99%' },
    { label: 'Rating', value: '4.8' }
  ];
  const features = [
    { icon: <Brain size={20} color="var(--primary-color)" />, title: 'AI-Powered Quizzes', desc: 'Generate quizzes from any topic or PDF using advanced AI.' },
    { icon: <Activity size={20} color="var(--primary-color)" />, title: 'Real-Time Monitoring', desc: 'Track student progress, accuracy, and rankings live.' },
    { icon: <Shield size={20} color="var(--primary-color)" />, title: 'Anti-Cheating System', desc: 'Tab-switch detection, browser lock, and activity monitoring.' },
    { icon: <BarChart2 size={20} color="var(--primary-color)" />, title: 'Smart Analytics', desc: 'Detailed performance charts and comprehensive tracking.' },
    { icon: <Users size={20} color="var(--primary-color)" />, title: 'Live Engagement', desc: 'See active participants and instant feedback.' },
    { icon: <Award size={20} color="var(--primary-color)" />, title: 'Skill Badges', desc: 'Earn skill badges scoring 80%+ on topic quizzes.' }
  ];
  const steps = [
    { icon: <Zap size={24} color="white" />, title: 'Create a Quiz', desc: 'Use AI, upload a PDF, or type questions manually.' },
    { icon: <Share2 size={24} color="white" />, title: 'Share the Link', desc: 'Students join with a single click — no signup required.' },
    { icon: <Monitor size={24} color="white" />, title: 'Monitor Live', desc: 'Track scores, leaderboard, and engagement in real-time.' }
  ];
  return (
    <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '5rem 2rem 4rem', backgroundColor: '#fff' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f5f3ff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.8125rem', fontWeight: '700', color: 'var(--primary-color)', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ✨ The Smartest Way to Learn
        </div>

        <h1 style={{ fontSize: '3.75rem', fontWeight: '800', marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '-0.025em', lineHeight: '1.1' }}>
          Engage Students with <span className="text-highlight">Real-Time Quizzes</span>
        </h1>

        <p style={{ fontSize: '1.125rem', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto 2.5rem', lineHeight: '1.6' }}>
          Create AI-generated quizzes, monitor live performance, and track skills — all in one beautiful platform.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '5rem' }}>
          <Link to="/auth" className="btn-primary" style={{ padding: '0.875rem 2.25rem' }}>
            Sign Up for Free
          </Link>
          <Link to="/auth" className="btn-outline" style={{ padding: '0.875rem 2.25rem' }}>
            Take a Quiz
          </Link>
        </div>
        {/* Hero Stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4rem', paddingBottom: '1rem' }}>
          {stats.map((stat, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem', fontWeight: '700' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
      {/* Features Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '6rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>Everything you need for engaging quizzes</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>From AI quiz generation to anti-cheating — we've got it all covered.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {features.map((feature, i) => (
            <div key={i} className="card" style={{ padding: '2rem' }}>
              <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: 'var(--primary-light)', marginBottom: '1.5rem' }}>
                {feature.icon}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>{feature.title}</h3>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
      {/* Three Simple Steps */}
      <section style={{ backgroundColor: '#f9fafb', padding: '6rem 2rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4rem' }}>Three simple steps</h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3rem', flexWrap: 'wrap' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ flex: '1 1 250px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-main)' }}>{step.title}</h3>
                <p style={{ fontSize: '0.9375rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Ready to get started section */}
      <section style={{ maxWidth: '1000px', margin: '6rem auto 2rem', padding: '4rem', background: 'white', borderRadius: '24px', border: '1px solid var(--surface-border)', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Ready to get started?</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', marginBottom: '2.5rem' }}>Join thousands of educators creating engaging, AI-powered quizzes.</p>
        <Link to="/auth" className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}>
          Create Your First Quiz <ArrowRight size={20} style={{ marginLeft: '0.75rem' }} />
        </Link>
      </section>
    </div>
  );
}
