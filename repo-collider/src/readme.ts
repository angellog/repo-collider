import { ghFetch } from './api';
import type { Repo } from './types';
import { getLocalStorage, setLocalStorage } from './utils';

const CACHE_KEY = 'rc-readme-summaries-v1';
const CACHE_TTL = 4 * 60 * 60 * 1000;
const FETCH_DELAY = 1200;
const RATE_LIMIT_PAUSE = 60_000;
const PERSIST_INTERVAL = 10;

export function extractReadmeSummary(markdown: string): string {
  let text = markdown.slice(0, 2000);

  text = text
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s]*[-*_]{3,}\s*$/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1');

  const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim());

  for (const p of paragraphs) {
    if (p.length < 40) continue;
    if (/^(table of contents|contents|toc|installation|getting started|license|contributing)/i.test(p)) continue;
    if ((p.match(/https?:\/\//g) || []).length > 2) continue;

    if (p.length <= 250) return p;
    const sentenceEnd = p.slice(0, 250).search(/[.!?]\s/);
    if (sentenceEnd > 60) return p.slice(0, sentenceEnd + 1);
    return p.slice(0, 247) + '...';
  }

  return '';
}

async function fetchReadmeSummary(repoName: string, signal: AbortSignal): Promise<{ summary: string | null; rateLimited: boolean }> {
  try {
    const res = await ghFetch(`/repos/${repoName}/readme`);
    if (signal.aborted) return { summary: null, rateLimited: false };
    if (res.status === 403) return { summary: null, rateLimited: true };
    if (!res.ok) return { summary: null, rateLimited: false };

    const data = await res.json() as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== 'base64') return { summary: null, rateLimited: false };

    const decoded = decodeURIComponent(
      atob(data.content.replace(/\n/g, ''))
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const summary = extractReadmeSummary(decoded);
    return { summary: summary || null, rateLimited: false };
  } catch {
    return { summary: null, rateLimited: false };
  }
}

interface CachedSummaries {
  ts: number;
  summaries: Record<string, string>;
}

type ProgressCallback = (fetched: number, total: number, done: boolean) => void;
type SummariesCallback = (summaries: Record<string, string>) => void;

function loadCache(): Record<string, string> | null {
  const cached = getLocalStorage<CachedSummaries | null>(CACHE_KEY, null);
  if (!cached) return null;
  if (Date.now() - cached.ts > CACHE_TTL) return null;
  return cached.summaries;
}

function saveCache(summaries: Record<string, string>) {
  setLocalStorage(CACHE_KEY, { ts: Date.now(), summaries });
}

export function startReadmeEnrichment(
  repos: Repo[],
  onProgress: ProgressCallback,
  onSummaries: SummariesCallback,
): AbortController {
  const controller = new AbortController();
  const { signal } = controller;

  (async () => {
    const cached = loadCache();
    if (cached && Object.keys(cached).length > 0) {
      onSummaries(cached);
      onProgress(Object.keys(cached).length, repos.length, true);
      return;
    }

    const sorted = [...repos].sort((a, b) => b.stars_raw - a.stars_raw);
    const summaries: Record<string, string> = cached || {};
    let fetched = Object.keys(summaries).length;

    onProgress(fetched, sorted.length, false);

    for (const repo of sorted) {
      if (signal.aborted) return;
      if (summaries[repo.name] !== undefined) {
        fetched++;
        continue;
      }

      const { summary, rateLimited } = await fetchReadmeSummary(repo.name, signal);
      if (signal.aborted) return;

      if (rateLimited) {
        await new Promise(r => setTimeout(r, RATE_LIMIT_PAUSE));
        if (signal.aborted) return;
      }

      summaries[repo.name] = summary || '';
      fetched++;

      onProgress(fetched, sorted.length, false);

      if (fetched % PERSIST_INTERVAL === 0) {
        onSummaries({ ...summaries });
        saveCache(summaries);
      }

      if (!rateLimited) {
        await new Promise(r => setTimeout(r, FETCH_DELAY));
      }
    }

    if (!signal.aborted) {
      onSummaries({ ...summaries });
      saveCache(summaries);
      onProgress(sorted.length, sorted.length, true);
    }
  })();

  return controller;
}
