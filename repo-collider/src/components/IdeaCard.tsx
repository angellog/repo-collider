import { useEffect, useState } from 'react';
import type { Idea } from '../types';
import { useAppState } from '../state';
import { getScopeMeta, getDifficultyColor, USER_FLAG } from '../utils';

interface Props {
  idea: Idea;
}

function scoreColor(s: number): string {
  if (s > 75) return '#4ade80';
  if (s > 50) return '#facc15';
  if (s > 25) return '#fb923c';
  return '#fb7185';
}

function ExpandedRow({ label, value, color }: { label: string; value: string; color: string }) {
  if (!value || value === '—') return null;
  return (
    <div className="exp-row">
      <span className="exp-label" style={{ color }}>{label}</span>
      <span className="exp-value">{value}</span>
    </div>
  );
}

export default function IdeaCard({ idea }: Props) {
  const { state, dispatch } = useAppState();
  const sm = getScopeMeta(idea.scope);
  const saved = state.savedIds.has(idea.id);
  const expanded = idea.expanded || false;
  const [scoreAnimated, setScoreAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setScoreAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  const r = 18;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (idea.score / 100) * circumference;

  return (
    <div className="idea-card" style={{ '--accent-color': sm.color } as React.CSSProperties}>
      <div className="card-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${sm.color}18, transparent 70%)` }} />

      <div className="card-body">
        <div className="card-header">
          <div className="card-title-area">
            <div className="card-title">{idea.name}</div>
            <div className="card-tagline">{idea.tagline}</div>
          </div>
          <div className="card-score-ring">
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="3.5" />
              <circle
                cx="22" cy="22" r={r} fill="none"
                stroke={scoreColor(idea.score)}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={scoreAnimated ? offset : circumference}
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.22,1,.36,1)' }}
              />
            </svg>
            <div className="card-score-text" style={{ color: scoreColor(idea.score) }}>{idea.score}</div>
          </div>
        </div>

        <div className="card-badges">
          {idea.country && USER_FLAG && (
            <span className="badge badge-geo">{USER_FLAG} {idea.country}</span>
          )}
          <span className="badge badge-scope" style={{ background: `${sm.color}18`, color: sm.color }}>
            {sm.emoji} {sm.label}
          </span>
          <span className="badge badge-diff" style={{ background: `${getDifficultyColor(idea.difficulty)}18`, color: getDifficultyColor(idea.difficulty) }}>
            <span className="diff-dot" style={{ background: getDifficultyColor(idea.difficulty) }} />
            {idea.difficulty}
          </span>
          <span className="badge badge-cat">{idea.category}</span>
        </div>

        <div className="card-score-bar">
          <div className="card-score-fill" style={{ width: `${idea.score}%`, background: scoreColor(idea.score) }} />
        </div>

        <div className="card-repos">
          <span className="repos-label">Repos</span>
          <div className="repos-list">
            {(idea.repos_used || []).slice(0, 4).map(r => (
              <a key={r} className="repo-chip" href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer">{r.split('/')[1] || r}</a>
            ))}
            {(idea.repos_used || []).length > 4 && (
              <span className="repo-chip repo-chip-more">+{idea.repos_used.length - 4}</span>
            )}
          </div>
        </div>
      </div>

      <div className="card-actions">
        <button className="card-action-btn" title={expanded ? 'Collapse' : 'Expand'} onClick={() => dispatch({ type: 'TOGGLE_EXPAND', id: idea.id })}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {expanded
              ? <polyline points="3,9 7,5 11,9" />
              : <polyline points="3,5 7,9 11,5" />}
          </svg>
        </button>
        <button className={`card-action-btn${saved ? ' saved' : ''}`} title={saved ? 'Unsave' : 'Save'} onClick={() => dispatch({ type: 'TOGGLE_SAVE', id: idea.id })}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1.5l1.74 3.53 3.89.57-2.81 2.74.66 3.87L7 10.25l-3.48 1.96.66-3.87L1.37 5.6l3.89-.57L7 1.5z" />
          </svg>
        </button>
        <button className="card-action-btn" title="Delete" onClick={() => dispatch({ type: 'DELETE_IDEA', id: idea.id })}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4" /><path d="M3 4h8" /><path d="M5.5 4V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5V4" />
          </svg>
        </button>
        <div className="card-actions-spacer" />
        <button className="card-action-btn build-btn" title="Build package" onClick={() => window.dispatchEvent(new CustomEvent('open-build', { detail: idea }))}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="10" height="8" rx="1" /><path d="M9 7l-2 2-2-2" /><path d="M7 5v4" />
          </svg>
          Build
        </button>
      </div>

      {expanded && (
        <div className="card-expand">
          <div className="exp-grid">
            <ExpandedRow label="Problem" value={idea.problem} color="#fb923c" />
            <ExpandedRow label="How" value={idea.how} color="#38bdf8" />
            <ExpandedRow label="Monetization" value={idea.monetization} color="#4ade80" />
            <ExpandedRow label="Target Users" value={idea.target_user} color="#a78bfa" />
            <ExpandedRow label="Analysis" value={idea.analysis || '—'} color="#f472b6" />
            <ExpandedRow label="Brain" value={idea.brain} color="#64748b" />
          </div>
        </div>
      )}
    </div>
  );
}
