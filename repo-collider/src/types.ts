export interface Idea {
  id: number;
  name: string;
  tagline: string;
  repos_used: string[];
  analysis: string;
  scope: string;
  geo_level: string;
  country_relevance: string;
  problem: string;
  how: string;
  monetization: string;
  viral_factor: string;
  target_user: string;
  score: number;
  difficulty: string;
  category: string;
  repos_full: Repo[];
  scopeMeta?: ScopeMeta;
  generatedAt: string;
  expanded?: boolean;
  brain: string;
  country: string;
}

export interface Repo {
  name: string;
  cat: string;
  stars: string;
  stars_raw: number;
  desc: string;
  lang: string;
  topics: string[];
  url: string;
  source: 'top100' | 'starred' | 'manual';
  id: number;
}

export interface ScopeMeta {
  label: string;
  emoji: string;
  color: string;
  tier: number;
}

export interface Provider {
  id: string;
  name: string;
  color: string;
  endpoint: string;
  type: 'openai' | 'anthropic' | 'gemini';
  keyHint: string;
  placeholder: string;
  models: { id: string; name: string }[];
}

export interface BuildPackage {
  recommended_stack: string;
  mvp_scope: string;
  file_structure: string;
  first_build_prompt: string;
  key_risks: string;
  estimated_cost: string;
  time_to_mvp: string;
}

export interface IdeaGen {
  name: string;
  tagline: string;
  repos_used: string[];
  analysis: string;
  scope: string;
  geo_level: string;
  country_relevance: string;
  problem: string;
  how: string;
  monetization: string;
  viral_factor: string;
  target_user: string;
  score: number;
  difficulty: string;
  category: string;
}

export interface AppState {
  ideas: Idea[];
  savedIds: Set<number>;
  allSaved: Idea[];
  sortMode: 'recent' | 'score';
  currentView: 'collider' | 'saved' | 'stats';
  generating: boolean;
  apiKeys: Record<string, string>;
  activeProvider: string;
  activeModel: string;
  repoPool: Repo[];
  starredRepos: Repo[];
  manualRepos: Repo[];
  cachedRepos: { ts: number; repos: Repo[] } | null;
  starredUser: string;
  buildPromptText: string;
  searchQuery: string;
  readmeSummaries: Record<string, string>;
  readmeProgress: { fetched: number; total: number; done: boolean };
}

