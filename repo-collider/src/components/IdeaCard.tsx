import type { Idea } from '../types';
import { useAppState } from '../state';
import { getScopeMeta, getDifficultyColor, USER_FLAG } from '../utils';

interface Props {
  idea: Idea;
}

function r(label: string, color: string, val: string) {
  return `<div style="display:flex;gap:6px;margin-bottom:2px"><span style="color:${color};font-weight:600;flex-shrink:0;min-width:90px">${label}</span><span>${val}</span></div>`;
}

export default function IdeaCard({ idea }: Props) {
  const { state, dispatch } = useAppState();
  const sm = getScopeMeta(idea.scope);
  const saved = state.savedIds.has(idea.id);
  const expanded = idea.expanded || false;

  return (
    <div className="idea-card" style={{ borderColor: sm.color }}>
      <div className="card-top">
        <div className="card-title">{idea.name}</div>
        <div className="card-tagline">{idea.tagline}</div>
      </div>

      <div className="score-bar">
        <div className="score-fill" style={{ width: `${idea.score}%`, background: idea.score > 75 ? 'var(--green)' : idea.score > 50 ? 'var(--yellow)' : idea.score > 25 ? 'var(--orange)' : 'var(--red)' }} />
      </div>
      <div className="score-label">{idea.score}/100 · {idea.difficulty}</div>

      <div className="card-badges" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 12px 6px' }}>
        {idea.country && USER_FLAG && <span className="badge-geo">{USER_FLAG} {idea.country}</span>}
        <span className="badge-scope" style={{ background: `${sm.color}20`, color: sm.color }}>
          {sm.emoji} {sm.label}
        </span>
        <span className="badge-diff" style={{ background: `${getDifficultyColor(idea.difficulty)}20`, color: getDifficultyColor(idea.difficulty) }}>
          {idea.difficulty}
        </span>
        <span className="badge-cat" style={{ background: 'var(--accent-dim)', color: 'var(--accent-h)' }}>
          {idea.category}
        </span>
      </div>

      <div className="card-repos">
        {(idea.repos_used || []).slice(0, 4).map(r => (
          <a key={r} className="repo-badge" href={`https://github.com/${r}`} target="_blank" rel="noopener noreferrer">{r}</a>
        ))}
        {(idea.repos_used || []).length > 4 && <span className="repo-badge">+{idea.repos_used.length - 4}</span>}
      </div>

      <div className="card-actions">
        <button className="card-action-btn" onClick={() => dispatch({ type: 'TOGGLE_EXPAND', id: idea.id })}>
          {expanded ? '▲ Less' : '▼ More'}
        </button>
        <button className="card-action-btn" onClick={() => dispatch({ type: 'TOGGLE_SAVE', id: idea.id })}>
          {saved ? '★ Saved' : '☆ Save'}
        </button>
        <button className="card-action-btn" style={{ color: 'var(--red)' }} onClick={() => dispatch({ type: 'DELETE_IDEA', id: idea.id })}>
          ✕ Delete
        </button>
        <button className="card-action-btn build-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-build', { detail: idea }))}>
          📦 Build
        </button>
      </div>

      {expanded && (
        <div className="card-expand">
          <div dangerouslySetInnerHTML={{ __html: r('💡 Problem', '#fb923c', idea.problem) }} />
          <div dangerouslySetInnerHTML={{ __html: r('⚙️ How', '#38bdf8', idea.how) }} />
          <div dangerouslySetInnerHTML={{ __html: r('💰 Model', '#4ade80', idea.monetization) }} />
          <div dangerouslySetInnerHTML={{ __html: r('🎯 Users', '#a78bfa', idea.target_user) }} />
          <div dangerouslySetInnerHTML={{ __html: r('🔬 Analysis', '#f472b6', idea.analysis || '—') }} />
          <div dangerouslySetInnerHTML={{ __html: r('🧠 Brain', '#64748b', idea.brain) }} />
        </div>
      )}
    </div>
  );
}
