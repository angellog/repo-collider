import { useState, useEffect, useCallback } from 'react';
import type { Idea, BuildPackage } from '../types';
import { useAppState } from '../state';
import { callLLM } from '../api';
import { extractJSON } from '../utils';

function BuildSection({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="build-section">
      <div className="build-section-label" style={{ color }}>{label}</div>
      {children}
    </div>
  );
}

export default function BuildModal() {
  const { state, dispatch } = useAppState();
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<BuildPackage | null>(null);
  const [error, setError] = useState('');

  const generateBuild = useCallback(async (idea: Idea) => {
    setLoading(true);
    setError('');
    const repoDescs = (idea.repos_full || []).slice(0, 6).map((r: { name?: string; desc?: string }) => `- ${r.name}: ${(r.desc || '').slice(0, 120)}`).join('\n');

    const prompt = `You are a startup technical co-founder. Build a package for this idea:

NAME: ${idea.name}
TAGLINE: ${idea.tagline}
PROBLEM: ${idea.problem}
HOW: ${idea.how}
REPOS: ${repoDescs}
SCOPE: ${idea.scope}
GEO: ${idea.geo_level || 'N/A'} / ${idea.country || 'N/A'}
CATEGORY: ${idea.category}
MONETIZATION: ${idea.monetization}
USER: ${idea.target_user}
DIFFICULTY: ${idea.difficulty}
COUNTRY RELEVANCE: ${idea.country_relevance || 'N/A'}
ANALYSIS: ${idea.analysis || 'N/A'}

Respond ONLY with valid JSON — no markdown, no code fences, no extra text:
{
  "recommended_stack": "tech stack with reasoning",
  "mvp_scope": "5 MVP features (numbered, each 1 line)",
  "file_structure": "file tree (indented lines)",
  "first_build_prompt": "complete build prompt, 300+ words, covering all steps",
  "key_risks": "top 3 risks (numbered, each 1 line)",
  "estimated_cost": "monthly cost estimate",
  "time_to_mvp": "time estimate"
}`;

    try {
      const text = await callLLM(state.activeProvider, state.activeModel, state.apiKeys, [
        { role: 'system', content: 'You are a technical co-founder who builds startups. Output only valid JSON.' },
        { role: 'user', content: prompt },
      ], 16384);
      const parsed = extractJSON(text) as BuildPackage | null;
      if (parsed) {
        setPkg(parsed);
        dispatch({ type: 'SET_BUILD_PROMPT', text: parsed.first_build_prompt || '' });
      } else {
        throw new Error('Failed to parse LLM response');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
    setLoading(false);
  }, [state.activeProvider, state.activeModel, state.apiKeys, dispatch]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIdea(detail);
      setPkg(null);
      setError('');
      setOpen(true);
      generateBuild(detail);
    };
    window.addEventListener('open-build', handler);
    return () => window.removeEventListener('open-build', handler);
  }, [generateBuild]);

  function copyPrompt() {
    if (state.buildPromptText) {
      navigator.clipboard.writeText(state.buildPromptText);
    }
  }

  if (!open) return null;

  return (
    <div id="modal-overlay" className="open" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div id="modal">
        <div id="modal-header">
          <div id="modal-title">Build Package {idea ? `· ${idea.name}` : ''}</div>
          <button id="modal-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div id="modal-body">
          {loading && (
            <div id="modal-loading">
              <div className="modal-spinner" />
              <div id="modal-pulse-text">Preparing your build package…</div>
              <div id="modal-loading-sub">Analyzing repos · Choosing stack · Writing first prompt</div>
            </div>
          )}
          {error && (
            <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 12, padding: 20 }}>
              ❌ {error}
              <button className="modal-action-btn" style={{ marginTop: 12, display: 'block' }} onClick={() => idea && generateBuild(idea)}>↻ Retry</button>
            </div>
          )}
          {!loading && !error && pkg && (
            <div id="build-output" style={{ display: 'block' }}>
              {pkg.recommended_stack && (
                <BuildSection label="Stack" color="#38bdf8">
                  <div className="build-section-content">{pkg.recommended_stack}</div>
                </BuildSection>
              )}
              {pkg.mvp_scope && (
                <BuildSection label="MVP Features" color="#4ade80">
                  <div className="build-section-content" style={{ whiteSpace: 'pre-line' }}>{pkg.mvp_scope}</div>
                </BuildSection>
              )}
              {pkg.file_structure && (
                <BuildSection label="File Structure" color="#a78bfa">
                  <div className="build-code">{pkg.file_structure}</div>
                </BuildSection>
              )}
              {pkg.key_risks && (
                <BuildSection label="Key Risks" color="#fb923c">
                  <div className="build-section-content" style={{ whiteSpace: 'pre-line' }}>{pkg.key_risks}</div>
                </BuildSection>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 }}>Monthly Cost</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>{pkg.estimated_cost || '—'}</div>
                </div>
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--dim)', letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 }}>Time to MVP</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--yellow)' }}>{pkg.time_to_mvp || '—'}</div>
                </div>
              </div>
              {pkg.first_build_prompt && (
                <BuildSection label="Build Prompt" color="#6366f1">
                  <div className="build-code">
                    {pkg.first_build_prompt}
                    <button className="copy-code-btn" onClick={copyPrompt}>Copy</button>
                  </div>
                </BuildSection>
              )}
            </div>
          )}
        </div>
        {pkg && (
          <div id="modal-footer" style={{ display: 'flex' }}>
            <button className="modal-action-btn" onClick={copyPrompt}>📋 Copy Build Prompt</button>
            <button className="modal-action-btn" onClick={() => setOpen(false)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
