import type { Repo, ScopeMeta } from './types';

export const CAT_ORDER = [
  'AI/ML', 'Framework/Library', 'Dev Tool', 'Infrastructure', 'Data/DB',
  'Security', 'Blockchain', 'Mobile/Desktop', 'CLI', 'CMS/E-Commerce',
  'Creative/Media', 'Automation', 'Learning', 'Template/Starter', 'Other',
];

export const CAT_COLORS: Record<string, string> = {
  'AI/ML': '#a78bfa', 'Framework/Library': '#60a5fa', 'Dev Tool': '#34d399',
  'Infrastructure': '#fb923c', 'Data/DB': '#38bdf8', 'Security': '#f472b6',
  'Blockchain': '#facc15', 'Mobile/Desktop': '#4ade80', 'CLI': '#94a3b8',
  'CMS/E-Commerce': '#2dd4bf', 'Creative/Media': '#e879f9', 'Automation': '#fdba74',
  'Learning': '#67e8f9', 'Template/Starter': '#a3a3a3', 'Other': '#64748b',
};

export const SCOPES: Record<string, ScopeMeta> = {
  Neighborhood: { label: 'Neighborhood', emoji: '📍', color: '#4ade80', tier: 1 },
  City: { label: 'City', emoji: '🏙️', color: '#38bdf8', tier: 2 },
  Country: { label: 'Country', emoji: '🌍', color: '#facc15', tier: 3 },
  Continent: { label: 'Continent', emoji: '🌏', color: '#fb923c', tier: 4 },
  Planet: { label: 'Planet', emoji: '🌐', color: '#f472b6', tier: 5 },
};

export const DIFF_COLORS: Record<string, string> = {
  Weekend: '#4ade80', '1 Month': '#38bdf8', '6 Months': '#facc15', '1 Year': '#fb923c',
};

export function formatStars(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function detectCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === 'UTC') return '';
    const parts = tz.split('/');
    if (parts.length < 2) return tz;
    const region = parts[parts.length - 1].replace(/_/g, ' ');
    const knownCountries: Record<string, string> = {
      'US': 'United States', 'CA': 'Canada', 'GB': 'United Kingdom', 'DE': 'Germany',
      'FR': 'France', 'JP': 'Japan', 'AU': 'Australia', 'BR': 'Brazil', 'IN': 'India',
      'CN': 'China', 'RU': 'Russia', 'KR': 'South Korea', 'NL': 'Netherlands',
      'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
      'IT': 'Italy', 'ES': 'Spain', 'PT': 'Portugal', 'CH': 'Switzerland',
      'AT': 'Austria', 'PL': 'Poland', 'CZ': 'Czech Republic', 'IE': 'Ireland',
      'NZ': 'New Zealand', 'SG': 'Singapore', 'HK': 'Hong Kong', 'TW': 'Taiwan',
      'IL': 'Israel', 'ZA': 'South Africa', 'AR': 'Argentina', 'MX': 'Mexico',
      'CO': 'Colombia', 'CL': 'Chile', 'TH': 'Thailand', 'VN': 'Vietnam',
      'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia', 'TR': 'Turkey',
      'GR': 'Greece', 'RO': 'Romania', 'HU': 'Hungary', 'UA': 'Ukraine',
    };
    const countryCode = parts.length > 2 ? parts[1] : '';
    return knownCountries[countryCode] || region;
  } catch {
    return '';
  }
}

const COUNTRY_EMOJIS: Record<string, string> = {
  'United States': '🇺🇸', 'Canada': '🇨🇦', 'United Kingdom': '🇬🇧', 'Germany': '🇩🇪',
  'France': '🇫🇷', 'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Brazil': '🇧🇷',
  'India': '🇮🇳', 'China': '🇨🇳', 'Russia': '🇷🇺', 'South Korea': '🇰🇷',
  'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Norway': '🇳🇴', 'Denmark': '🇩🇰',
  'Finland': '🇫🇮', 'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Portugal': '🇵🇹',
  'Switzerland': '🇨🇭', 'Austria': '🇦🇹', 'Poland': '🇵🇱', 'Czech Republic': '🇨🇿',
  'Ireland': '🇮🇪', 'New Zealand': '🇳🇿', 'Singapore': '🇸🇬', 'Hong Kong': '🇭🇰',
  'Taiwan': '🇹🇼', 'Israel': '🇮🇱', 'South Africa': '🇿🇦', 'Argentina': '🇦🇷',
  'Mexico': '🇲🇽', 'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳', 'Philippines': '🇵🇭', 'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾',
  'Turkey': '🇹🇷', 'Greece': '🇬🇷', 'Romania': '🇷🇴', 'Hungary': '🇭🇺',
  'Ukraine': '🇺🇦',
};

export const USER_COUNTRY = detectCountry();
export const USER_FLAG = COUNTRY_EMOJIS[USER_COUNTRY] || '';

export function categorizeRepo(r: { topics?: string[]; lang?: string; desc?: string; name?: string }): string {
  const t = (r.topics || []).map(x => x.toLowerCase());
  const l = (r.lang || '').toLowerCase();
  const d = (r.desc || '').toLowerCase();
  if (t.some(x => ['ai', 'machine-learning', 'deep-learning', 'llm', 'neural', 'gpt', 'nlp', 'reinforcement-learning'].includes(x)) ||
      ['ai', 'machine-learning'].includes(l)) return 'AI/ML';
  if (t.some(x => ['react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'framework', 'web-framework', 'css-framework'].includes(x)) ||
      ['react', 'vue', 'angular', 'svelte', 'nextjs'].includes(l)) return 'Framework/Library';
  if (t.some(x => ['developer-tools', 'ide', 'editor', 'linter', 'formatter', 'debugger', 'cli-tool', 'code-quality'].includes(x)) ||
      d.includes('developer') || d.includes('cli for') || d.includes('command line')) return 'Dev Tool';
  if (t.some(x => ['database', 'data-processing', 'etl', 'data-pipeline', 'data-visualization', 'big-data'].includes(x)) ||
      ['sql', 'database'].includes(l)) return 'Data/DB';
  if (t.some(x => ['security', 'authentication', 'authorization', 'encryption', 'vulnerability', 'cyber'].includes(x))) return 'Security';
  if (t.some(x => ['blockchain', 'web3', 'ethereum', 'solidity', 'crypto', 'nft', 'defi', 'smart-contracts'].includes(x))) return 'Blockchain';
  if (t.some(x => ['mobile', 'ios', 'android', 'flutter', 'react-native', 'swiftui'].includes(x)) ||
      ['kotlin', 'swift', 'flutter'].includes(l)) return 'Mobile/Desktop';
  if (l === 'shell' || t.some(x => ['cli', 'terminal', 'shell', 'command-line'].includes(x))) return 'CLI';
  if (t.some(x => ['cms', 'e-commerce', 'wordpress', 'shopify', 'headless-cms', 'blog', 'content-management'].includes(x))) return 'CMS/E-Commerce';
  if (t.some(x => ['creative', 'animation', 'design', 'video', 'audio', 'music', '3d', 'game', 'canvas', 'svg', 'webgl'].includes(x))) return 'Creative/Media';
  if (t.some(x => ['automation', 'ci-cd', 'devops', 'deployment', 'testing', 'workflow'].includes(x))) return 'Automation';
  if (t.some(x => ['education', 'tutorial', 'learning', 'course', 'documentation'].includes(x))) return 'Learning';
  if (t.some(x => ['template', 'starter', 'boilerplate', 'scaffold', 'example'].includes(x))) return 'Template/Starter';
  if (t.some(x => ['infrastructure', 'docker', 'kubernetes', 'cloud', 'terraform', 'serverless', 'microservices', 'monitoring', 'observability', 'logging'].includes(x))) return 'Infrastructure';
  return 'Other';
}

export function getScopeMeta(scope: string): ScopeMeta {
  return SCOPES[scope] || { label: scope, emoji: '🌐', color: '#64748b', tier: 0 };
}

export function getDifficultyColor(d: string): string {
  return DIFF_COLORS[d] || '#64748b';
}

export function extractJSON(raw: string): unknown {
  let text = raw.trim();
  const fence = text.indexOf('```');
  if (fence >= 0) {
    const start = text.indexOf('\n', fence);
    const end = text.lastIndexOf('```');
    if (start >= 0 && end > start) text = text.slice(start + 1, end).trim();
  }
  try { return JSON.parse(text); } catch {
    try {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first >= 0 && last > first) {
        const fixed = text.slice(first, last + 1)
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/"(\d+[kMB]?)\s*(?:weeks?|months?|years?|hours?|minutes?)\s*"/gi, '"$1"')
          .replace(/<integer>/gi, '"1"');
        return JSON.parse(fixed);
      }
    } catch {
      // ignore
    }
  }
  try {
    const first = text.indexOf('[');
    const last = text.lastIndexOf(']');
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
  } catch {
    // ignore
  }
  return null;
}

export function ghItemToRepo(item: Record<string, unknown>, source: 'top100' | 'starred' | 'manual'): Repo {
  return {
    name: (item.full_name as string) || (item.name as string) || '',
    cat: categorizeRepo(item),
    stars: formatStars((item.stargazers_count as number) || (item.stars_raw as number) || 0),
    stars_raw: (item.stargazers_count as number) || (item.stars_raw as number) || 0,
    desc: (item.description as string) || '',
    lang: (item.language as string) || '',
    topics: (item.topics as string[]) || [],
    url: (item.html_url as string) || `https://github.com/${item.full_name || item.name}`,
    source,
    id: 0,
  };
}

export function getLocalStorage<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function setLocalStorage(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {
    // ignore
  }
}
