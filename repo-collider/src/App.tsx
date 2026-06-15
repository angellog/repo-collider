import { useEffect, useState, useRef, useMemo } from 'react';
import { AppProvider, useAppState } from './state';
import { fetchTopRepos, callLLM, authFetch } from './api';
import { PROVIDERS } from './providers';
import { extractJSON, getScopeMeta, USER_COUNTRY, getLocalStorage, setLocalStorage } from './utils';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import IdeaCard from './components/IdeaCard';
import ProgressBar from './components/ProgressBar';
import AuthOverlay from './components/AuthOverlay';
import BuildModal from './components/BuildModal';
import StatsView from './components/StatsView';
import SavedView from './components/SavedView';
import Toast from './components/Toast';
import { showToast } from './components/toast-fn';
import type { Idea, IdeaGen } from './types';
import './App.css';

const GEN_STAGES = ['Analyzing repo pool', 'Permuting combinations', 'Scoring ideas', 'Finalizing'];

function AppInner() {
  const { state, dispatch } = useAppState();
  const [authed, setAuthed] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [, setAuthUser] = useState<{ id: string; email: string } | null>(null);
  const [progress, setProgress] = useState({ stage: -1, stages: GEN_STAGES, elapsed: 0, error: null as string | null });
  const [generating, setGenerating] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const [ideasInitialized, setIdeasInitialized] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const token = getLocalStorage<string>('rc-auth-token', '');
    if (token) {
      authFetch('/api/auth/me', token)
      .then((data: Record<string, unknown>) => {
          setAuthToken(data.token as string);
          setAuthUser(data.user as { id: string; email: string });
          setAuthed(true);
        })
        .catch(() => {
          localStorage.removeItem('rc-auth-token');
          showToast('Session expired. Please login again.');
        });
    }
  }, []);

  // Load repos on mount
  useEffect(() => {
    if (!authed) return;
    fetchTopRepos().then(repos => {
      dispatch({ type: 'SET_REPO_POOL', repos: repos.slice(0, 100) });
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Load remote ideas after auth
  useEffect(() => {
    if (!authToken || ideasInitialized) return;
    authFetch('/api/ideas/sync', authToken)
      .then((data: Record<string, unknown>) => {
        const remoteIdeas = data.ideas as Idea[] | undefined;
        if (remoteIdeas && remoteIdeas.length > 0) {
          dispatch({ type: 'SET_IDEAS', ideas: remoteIdeas });
        }
        setIdeasInitialized(true);
      })
      .catch(() => setIdeasInitialized(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, ideasInitialized]);

  // Progress timer
  useEffect(() => {
    if (!generating) {
      clearInterval(timerRef.current);
      return;
    }
    const start = Date.now() - progress.elapsed;
    timerRef.current = setInterval(() => {
      setProgress(p => ({ ...p, elapsed: Date.now() - start }));
    }, 100);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  async function generate() {
    const provider = PROVIDERS.find(p => p.id === state.activeProvider);
    if (!provider) { showToast('Select a provider'); return; }
    const key = (state.apiKeys[state.activeProvider] || '').trim();
    if (!key || key.length < 8) { showToast('Enter a valid API key'); return; }

    const allRepos = [...state.repoPool, ...state.starredRepos, ...state.manualRepos];
    if (allRepos.length < 3) { showToast('Need at least 3 repos in the pool'); return; }

    setGenerating(true);
    dispatch({ type: 'SET_GENERATING', generating: true });
    setProgress({ stage: 0, stages: GEN_STAGES, elapsed: 0, error: null });

    const shuffled = [...allRepos].sort(() => Math.random() - 0.5).slice(0, 30);
    const repoList = shuffled.map(r => `- ${r.name} ★${r.stars} (${r.cat}) ${r.desc ? ': ' + r.desc.slice(0, 80) : ''}`).join('\n');
    const cats = [...new Set(shuffled.map(r => r.cat))].slice(0, 6).join(', ');
    const topRepos = shuffled.sort((a, b) => b.stars_raw - a.stars_raw).slice(0, 5).map(r => r.name).join(', ');

    const modelName = state.activeModel || provider.models[0]?.id || '';

    const systemPrompt = `You are a startup idea generator for the "Repo Collider" engine. You analyze open-source repos and generate novel product ideas by combining them in unexpected ways. Be creative, specific, and practical.`;

    const userPrompt = `You have access to these open-source repositories:

${repoList}

Categories represented: ${cats}
Top repos by stars: ${topRepos}
User location: ${USER_COUNTRY || 'Unknown'}

Generate exactly 5 startup/product ideas by combining/remixing these repos. For each idea output:
- name (1-4 words, catchy)
- tagline (<12 words)
- repos_used (array of 2-4 repo "owner/name" strings from the list above)
- analysis (1-2 sentence landscape insight)
- scope ("Neighborhood"|"City"|"Country"|"Continent"|"Planet")
- geo_level ("local"|"national"|"global")
- country_relevance (1 sentence about why this fits the user's country, or "Global relevance")
- problem (1 sentence)
- how (2 sentences on how it works)
- monetization (1 sentence)
- viral_factor (1 sentence on growth)
- target_user (1 sentence)
- score (integer 1-100, higher = more viable)
- difficulty ("Weekend"|"1 Month"|"6 Months"|"1 Year")
- category ("AI Tool"|"Marketplace"|"SaaS"|"Infrastructure"|"Consumer App"|"Gov Tech"|"Dev Tool"|"Health Tech"|"EdTech"|"FinTech"|"Climate Tech"|"Creator Tool"|"Social"|"Productivity")

Prioritize ideas relevant to ${USER_COUNTRY || 'the user\'s location'} if detectable. Score based on: market size, technical feasibility, novelty, and monetization potential.

Respond ONLY with a valid JSON array of 5 objects — no markdown, no code fences, no extra text.`;

    try {
      const text = await callLLM(state.activeProvider, modelName, state.apiKeys, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 8192);

      setProgress(p => ({ ...p, stage: 3 }));

      const parsed = extractJSON(text);
      if (!parsed) throw new Error('Failed to parse LLM response');

      const ideas: IdeaGen[] = Array.isArray(parsed) ? parsed : [parsed];
      const timestamp = Date.now();

      const newIdeas: Idea[] = ideas.map((gen, i) => ({
        ...gen,
        id: timestamp + i + Math.floor(Math.random() * 1000),
        repos_full: shuffled,
        generatedAt: new Date().toISOString(),
        expanded: false,
        brain: `${provider.name} / ${modelName}`,
        country: USER_COUNTRY,
        geo_level: gen.geo_level || 'local',
        scopeMeta: getScopeMeta(gen.scope),
      }));

      dispatch({ type: 'ADD_IDEAS', ideas: newIdeas });

      // Sync if authed
      if (authToken) {
        const updated = [...newIdeas, ...state.ideas];
        authFetch('/api/ideas/sync', authToken, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ideas: updated }),
        }).catch(() => {});
      }

      showToast(`⚡ ${newIdeas.length} ideas generated`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Generation failed';
      setProgress(p => ({ ...p, error: msg, stage: p.stage }));
      showToast(`Error: ${msg}`);
    }

    setGenerating(false);
    dispatch({ type: 'SET_GENERATING', generating: false });
  }

  function handleAuth(token: string, user: { id: string; email: string }) {
    setAuthToken(token);
    setAuthUser(user);
    setAuthed(true);
    setLocalStorage('rc-auth-token', token);
    showToast('🎉 Welcome!');
  }



  // Filter + sort ideas
  const displayIdeas = useMemo(() => {
    let filtered = [...state.ideas];
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.tagline.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }
    if (state.sortMode === 'score') {
      filtered.sort((a, b) => b.score - a.score);
    } else {
      filtered.sort((a, b) => b.id - a.id);
    }
    return filtered;
  }, [state.ideas, state.searchQuery, state.sortMode]);

  const poolRepos = [...state.repoPool, ...state.starredRepos, ...state.manualRepos];

  if (!authed) {
    return <AuthOverlay onAuth={handleAuth} />;
  }

  return (
    <>
      <div id="app">
        <Topbar />
        <div id="main">
          <Sidebar />
          <div id="right">
            <div id="filter-bar">
              <input id="search-input" type="text" placeholder="Search ideas…" value={state.searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })} />
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span id="idea-count">{displayIdeas.length} ideas</span>
                <button className={`pill-btn${state.sortMode === 'recent' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_SORT', sortMode: 'recent' })}>Recent</button>
                <button className={`pill-btn${state.sortMode === 'score' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_SORT', sortMode: 'score' })}>Score</button>
                <button className="pill-btn" onClick={() => {
                  const data = { 'rc-ideas': state.ideas, 'rc-saved-ids': [...state.savedIds], 'rc-saved-ideas': state.allSaved, 'rc-starred-repos': state.starredRepos, 'rc-manual-repos': state.manualRepos };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `repo-collider-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                }}>📦 Export</button>
                <button className="pill-btn" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    try {
                      const data = JSON.parse(text);
                      if (data['rc-ideas']) dispatch({ type: 'SET_IDEAS', ideas: data['rc-ideas'] });
                      if (data['rc-starred-repos']) dispatch({ type: 'SET_STARRED_REPOS', repos: data['rc-starred-repos'], user: '' });
                      if (data['rc-manual-repos']) dispatch({ type: 'SET_MANUAL_REPOS', repos: data['rc-manual-repos'] });
                      showToast('📥 Ideas imported');
                    } catch { showToast('Invalid backup file'); }
                  };
                  input.click();
                }}>📥 Import</button>
              </div>
            </div>

            {generating && (
              <ProgressBar stages={progress.stages} currentStage={progress.stage} error={progress.error} elapsed={progress.elapsed} />
            )}

            <div id="ideas-wrap">
              {state.currentView === 'collider' && (
                <>
                  {displayIdeas.length === 0 && !generating && (
                    <div className="empty-state">
                      <div className="empty-icon">⚡</div>
                      <div className="empty-title">No ideas yet</div>
                      <div className="empty-sub">{poolRepos.length >= 3 ? 'Click ⚡ Collide in the sidebar to generate ideas' : 'Add repos to the pool first'}</div>
                      {poolRepos.length >= 3 && (
                        <button className="btn-gen" style={{ marginTop: 16, width: 200 }} onClick={generate}>⚡ Collide</button>
                      )}
                    </div>
                  )}
                  {displayIdeas.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 5, padding: '0 14px 8px' }}>
                        <button className="btn-gen" onClick={generate} disabled={generating}>
                          {generating ? 'Generating…' : '⚡ Collide'}
                        </button>
                      </div>
                      <div id="ideas-grid">
                        {displayIdeas.map((idea, i) => (
                          <div key={idea.id} style={{ '--i': i } as React.CSSProperties}>
                            <IdeaCard idea={idea} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {state.currentView === 'saved' && <SavedView />}
              {state.currentView === 'stats' && <StatsView />}
            </div>
          </div>
        </div>
      </div>
      <BuildModal />
      <div id="toast" />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
      <Toast />
    </AppProvider>
  );
}
