import { useState, useMemo } from 'react';
import { useAppState } from '../state';
import { fetchTopRepos, fetchStarredRepos, fetchSingleRepo } from '../api';
import { CAT_ORDER, CAT_COLORS } from '../utils';
import type { Repo } from '../types';

export default function Sidebar() {
  const { state, dispatch } = useAppState();
  const [importStatus, setImportStatus] = useState('');
  const [starredUser, setStarredUser] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const mergedRepos = useMemo(() => {
    const map = new Map<string, Repo>();
    state.repoPool.forEach(r => map.set(r.name, r));
    state.starredRepos.forEach(r => map.set(r.name, r));
    state.manualRepos.forEach(r => map.set(r.name, r));
    return [...map.values()];
  }, [state.repoPool, state.starredRepos, state.manualRepos]);

  const categorized = useMemo(() => {
    const groups: Record<string, Repo[]> = {};
    CAT_ORDER.forEach(c => groups[c] = []);
    groups['Other'] = [];
    mergedRepos.forEach(r => {
      if (groups[r.cat]) groups[r.cat].push(r);
      else groups['Other'].push(r);
    });
    return groups;
  }, [mergedRepos]);

  async function handleRefresh() {
    try {
      const repos = await fetchTopRepos(true);
      dispatch({ type: 'SET_CACHED_REPOS', data: { ts: Date.now(), repos } });
      dispatch({ type: 'SET_REPO_POOL', repos });
      setImportStatus(`Refreshed ${repos.length} repos`);
    } catch (e: unknown) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleFetchStars() {
    if (!starredUser.trim()) return;
    try {
      const repos = await fetchStarredRepos(starredUser.trim());
      dispatch({ type: 'SET_STARRED_REPOS', repos, user: starredUser.trim() });
      setImportStatus(`Imported ${repos.length} starred repos`);
    } catch (e: unknown) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleAddRepo() {
    if (!urlInput.trim()) return;
    try {
      const repo = await fetchSingleRepo(urlInput.trim());
      dispatch({ type: 'SET_MANUAL_REPOS', repos: [...state.manualRepos, repo] });
      setUrlInput('');
      setImportStatus(`Added ${repo.name}`);
    } catch (e: unknown) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div id="left">
      <div id="left-top">
        <div id="repo-controls">
          <button id="refresh-repos" onClick={handleRefresh}>↻ Refresh</button>
          <span id="repo-pool-status">{mergedRepos.length} repos</span>
        </div>

        <div className="action-row">
          <button className="btn-gen" disabled={state.generating} onClick={() => {}}>
            ⚡ Collide
          </button>
        </div>

        <div id="import-section">
          <div className="import-row">
            <input className="import-input" placeholder="GitHub user" value={starredUser} onChange={e => setStarredUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFetchStars()} />
            <button className="import-btn" onClick={handleFetchStars} disabled={!starredUser.trim()}>★ Stars</button>
          </div>
          <div className="import-row">
            <input className="import-input" placeholder="GitHub repo URL" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRepo()} />
            <button className="import-btn" onClick={handleAddRepo} disabled={!urlInput.trim()}>+ Add</button>
          </div>
          {importStatus && <div id="import-status">{importStatus}</div>}
        </div>
      </div>

      <div id="repo-list">
        {CAT_ORDER.filter(c => (categorized[c]?.length || 0) > 0).map(cat => (
          <div key={cat} className="cat-section">
            <div className="cat-section-header" onClick={e => {
              const section = (e.currentTarget as HTMLElement).closest('.cat-section');
              if (section) section.classList.toggle('collapsed');
            }}>
              <span className="cat-dot" style={{ background: CAT_COLORS[cat] }} />
              <span className="cat-section-label">{cat}</span>
              <span className="cat-section-count">{categorized[cat]?.length || 0}</span>
              <span className="cat-section-arrow">▼</span>
            </div>
            <div className="cat-section-body">
              {(categorized[cat] || []).map(r => (
                <div key={r.name} className="repo-row">
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.desc}>{r.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 9, flexShrink: 0 }}>{r.lang}</span>
                  <span style={{ color: 'var(--yellow)', fontSize: 9, marginLeft: 4, flexShrink: 0 }}>★ {r.stars}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
