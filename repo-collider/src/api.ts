import type { Repo } from './types';
import { PROVIDERS } from './providers';
import { ghItemToRepo } from './utils';

const REPO_CACHE_KEY = 'rc-gh-repos-v2';
const CACHE_TTL = 4 * 60 * 60 * 1000;

const isLocal = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

export async function ghFetch(path: string): Promise<Response> {
  if (!isLocal) {
    try {
      const res = await fetch(`/gh-proxy${path}`);
      if (res.ok) return res;
    } catch { /* proxy unavailable */ }
  }
  return fetch(`https://api.github.com${path}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' },
  });
}

export async function fetchTopRepos(force = false): Promise<Repo[]> {
  const cached = getCachedRepos();
  if (cached && !force) return cached;

  const res = await ghFetch('/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=100');
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  const data = await res.json() as Record<string, unknown>;
  const items = (data.items || []) as Record<string, unknown>[];
  const repos: Repo[] = items.map((item, i) => {
    const r = ghItemToRepo(item, 'top100');
    r.id = i + 1;
    return r;
  });

  try {
    localStorage.setItem(REPO_CACHE_KEY, JSON.stringify({ ts: Date.now(), repos }));
  } catch {
    // ignore
  }
  return repos;
}

export async function fetchStarredRepos(username: string): Promise<Repo[]> {
  const res = await ghFetch(`/users/${encodeURIComponent(username)}/starred?per_page=100&sort=created&direction=desc`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const items = await res.json() as Record<string, unknown>[];
  return (items || []).map((item, i) => {
    const r = ghItemToRepo(item, 'starred');
    r.id = i + 1;
    return r;
  });
}

export async function fetchSingleRepo(url: string): Promise<Repo> {
  const match = url.match(/github\.com\/([\w.-]+\/[\w.-]+)/i);
  if (!match) throw new Error('Invalid GitHub URL');
  const res = await ghFetch(`/repos/${match[1]}`);
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const item = await res.json() as Record<string, unknown>;
  const r = ghItemToRepo(item, 'manual');
  r.id = Date.now();
  return r;
}

function getCachedRepos(): Repo[] | null {
  try {
    const raw = localStorage.getItem(REPO_CACHE_KEY);
    if (!raw) return null;
    const { ts, repos } = JSON.parse(raw) as { ts: number; repos: Repo[] };
    if (Date.now() - ts > CACHE_TTL) return null;
    return repos;
  } catch {
    return null;
  }
}

export function getProvider(id: string) {
  return PROVIDERS.find(p => p.id === id);
}

export function getKey(apiKeys: Record<string, string>, providerId: string): string {
  return (apiKeys[providerId] || '').trim();
}

export function validKey(apiKeys: Record<string, string>, providerId: string): boolean {
  const key = getKey(apiKeys, providerId);
  const provider = getProvider(providerId);
  if (!key || key.length < 8) return false;
  return !(provider?.keyHint && !key.startsWith(provider.keyHint));
}

async function openaiCall(endpoint: string, model: string, messages: unknown[], key: string, maxTokens: number) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'authorization': `Bearer ${key}` };
  if (endpoint.includes('openrouter.ai')) {
    headers['http-referer'] = 'https://repo-collider.vercel.app';
    headers['x-title'] = 'Repo Collider';
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.9 }),
  });
  const d = await res.json();
  return { ok: res.ok, status: res.status, d };
}

async function anthropicCall(endpoint: string, model: string, messages: unknown[], key: string, maxTokens: number) {
  const systemMsg = (messages as { role: string; content: string }[]).find(m => m.role === 'system');
  const nonSystem = (messages as { role: string; content: string }[]).filter(m => m.role !== 'system');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: nonSystem.map(m => ({ role: m.role, content: m.content })),
      system: systemMsg?.content || '',
    }),
  });
  const d = await res.json();
  return { ok: res.ok, status: res.status, d };
}

async function geminiCall(endpoint: string, model: string, messages: unknown[], key: string, maxTokens: number) {
  const msgs = messages as { role: string; content: string }[];
  const systemMsg = msgs.find(m => m.role === 'system');
  const contents = msgs.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 } };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  const res = await fetch(`${endpoint}/models/${model}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const d = await res.json();
  return { ok: res.ok, status: res.status, d };
}

function resolveEndpoint(endpoint: string): string {
  if (!isLocal) return endpoint;
  if (endpoint.startsWith('/zen-proxy')) {
    return endpoint.replace('/zen-proxy', 'https://opencode.ai/zen');
  }
  return endpoint;
}

export async function callLLM(providerId: string, modelId: string, apiKeys: Record<string, string>, messages: unknown[], maxTokens = 8192): Promise<string> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const key = getKey(apiKeys, providerId);
  if (!key) throw new Error('API key required');

  const endpoint = resolveEndpoint(provider.endpoint);

  let res: { ok: boolean; status: number; d: Record<string, unknown> };
  if (provider.type === 'anthropic') {
    res = await anthropicCall(endpoint, modelId, messages, key, maxTokens);
  } else if (provider.type === 'gemini') {
    res = await geminiCall(endpoint, modelId, messages, key, maxTokens);
  } else {
    res = await openaiCall(endpoint, modelId, messages, key, maxTokens);
  }

  if (!res.ok) {
    const err = (res.d?.error as Record<string, unknown>)?.message || (res.d?.error as string) || `HTTP ${res.status}`;
    throw new Error(typeof err === 'string' ? err : JSON.stringify(err));
  }

  if (provider.type === 'anthropic') {
    const t = (res.d?.content as { text?: string }[])?.[0]?.text || '';
    if (res.d?.stop_reason === 'max_tokens') throw new Error('Response was truncated (max_tokens)');
    return t;
  } else if (provider.type === 'gemini') {
    const t = (res.d?.candidates as { content?: { parts?: { text?: string }[] } }[])?.[0]?.content?.parts?.[0]?.text || '';
    if ((res.d?.candidates as { finishReason?: string }[])?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('Response was truncated (max_tokens)');
    return t;
  } else {
    const t = (res.d?.choices as { message?: { content?: string } }[])?.[0]?.message?.content || '';
    if ((res.d?.choices as { finish_reason?: string }[])?.[0]?.finish_reason === 'length') throw new Error('Response was truncated (max_tokens)');
    return t;
  }
}

export async function authFetch(path: string, token: string, options?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(path, {
    ...options,
    headers: { ...options?.headers, 'authorization': `Bearer ${token}` } as Record<string, string>,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((data.error as string) || `HTTP ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export async function login(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token: string; user: { id: string; email: string }; error?: string };
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function register(email: string, password: string): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json() as { token: string; user: { id: string; email: string }; error?: string };
  if (!res.ok) throw new Error(data.error || 'Registration failed');
  return data;
}

