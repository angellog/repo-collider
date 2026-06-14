import { useAppState } from '../state';
import { getScopeMeta, getDifficultyColor } from '../utils';
import { useMemo } from 'react';

export default function StatsView() {
  const { state } = useAppState();

  const stats = useMemo(() => {
    const ideas = state.ideas;
    const total = ideas.length;
    if (total === 0) return null;

    const scopes: Record<string, number> = {};
    const cats: Record<string, number> = {};
    const diffs: Record<string, number> = {};
    const geos: Record<string, number> = { local: 0, national: 0, global: 0 };
    let totalScore = 0;
    let highest = 0;
    let highestIdea = '';

    ideas.forEach(i => {
      scopes[i.scope] = (scopes[i.scope] || 0) + 1;
      cats[i.category] = (cats[i.category] || 0) + 1;
      diffs[i.difficulty] = (diffs[i.difficulty] || 0) + 1;
      const g = i.geo_level || 'local';
      if (geos[g] !== undefined) geos[g]++;
      totalScore += i.score;
      if (i.score > highest) { highest = i.score; highestIdea = i.name; }
    });

    const topScopes = Object.entries(scopes).sort((a, b) => b[1] - a[1]).slice(0, 6);

    return { total, totalScore, avg: Math.round(totalScore / total), highest, highestIdea, topScopes, cats, diffs, geos };
  }, [state.ideas]);

  if (!stats) {
    return (
      <div id="stats-view">
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No stats yet</div>
          <div className="empty-sub">Generate some ideas first</div>
        </div>
      </div>
    );
  }

  return (
    <div id="stats-view">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Ideas Generated</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Score</div>
          <div className="stat-value" style={{ color: stats.avg > 60 ? 'var(--green)' : stats.avg > 40 ? 'var(--yellow)' : 'var(--orange)' }}>{stats.avg}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Highest Score</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{stats.highest}</div>
          <div className="stat-sub">{stats.highestIdea}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Difficulty Mix</div>
          {Object.entries(stats.diffs).map(([k, v]) => (
            <div key={k} className="stat-row">
              <span style={{ color: getDifficultyColor(k), fontSize: 10 }}>{k}</span>
              <span style={{ color: 'var(--dim)', fontSize: 10 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="panel-label">Scope Distribution</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
          {stats.topScopes.map(([scope, count]) => {
            const sm = getScopeMeta(scope);
            return (
              <div key={scope} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{sm.emoji}</span>
                <div style={{ flex: 1, height: 20, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / stats.total) * 100}%`, background: sm.color, borderRadius: 4, transition: 'width .3s' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--dim)', minWidth: 24, textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
