import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, Idea, Repo } from './types';
import { getLocalStorage, setLocalStorage } from './utils';

type Action =
  | { type: 'SET_IDEAS'; ideas: Idea[] }
  | { type: 'ADD_IDEAS'; ideas: Idea[] }
  | { type: 'DELETE_IDEA'; id: number }
  | { type: 'TOGGLE_SAVE'; id: number }
  | { type: 'TOGGLE_EXPAND'; id: number }
  | { type: 'SET_SORT'; sortMode: 'recent' | 'score' }
  | { type: 'SET_VIEW'; view: AppState['currentView'] }
  | { type: 'SET_GENERATING'; generating: boolean }
  | { type: 'SET_API_KEY'; provider: string; key: string }
  | { type: 'SET_ACTIVE_PROVIDER'; provider: string }
  | { type: 'SET_ACTIVE_MODEL'; model: string }
  | { type: 'SET_REPO_POOL'; repos: Repo[] }
  | { type: 'SET_STARRED_REPOS'; repos: Repo[]; user: string }
  | { type: 'SET_MANUAL_REPOS'; repos: Repo[] }
  | { type: 'SET_CACHED_REPOS'; data: { ts: number; repos: Repo[] } | null }
  | { type: 'SET_BUILD_PROMPT'; text: string }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SET_CURRENT_VIEW'; view: AppState['currentView'] }
  | { type: 'LOAD_STATE'; state: Partial<AppState> };

const LS_KEYS = {
  ideas: 'rc-ideas',
  savedIds: 'rc-saved-ids',
  allSaved: 'rc-saved-ideas',
  apiKeys: 'rc-api-keys',
  activeProvider: 'rc-provider',
  activeModel: 'rc-model',
  starredRepos: 'rc-starred-repos',
  manualRepos: 'rc-manual-repos',
  cachedRepos: 'rc-gh-repos-v2',
};

function loadIds(): Set<number> {
  try {
    const raw = localStorage.getItem(LS_KEYS.savedIds);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveIds(ids: Set<number>) {
  try { localStorage.setItem(LS_KEYS.savedIds, JSON.stringify([...ids])); } catch {
    // ignore
  }
}

function initState(): AppState {
  return {
    ideas: getLocalStorage<Idea[]>(LS_KEYS.ideas, []),
    savedIds: loadIds(),
    allSaved: getLocalStorage<Idea[]>(LS_KEYS.allSaved, []),
    sortMode: 'recent',
    currentView: 'collider',
    generating: false,
    apiKeys: getLocalStorage<Record<string, string>>(LS_KEYS.apiKeys, {}),
    activeProvider: getLocalStorage<string>(LS_KEYS.activeProvider, 'openzen'),
    activeModel: getLocalStorage<string>(LS_KEYS.activeModel, ''),
    repoPool: [],
    starredRepos: getLocalStorage<Repo[]>(LS_KEYS.starredRepos, []),
    manualRepos: getLocalStorage<Repo[]>(LS_KEYS.manualRepos, []),
    cachedRepos: null,
    starredUser: '',
    buildPromptText: '',
    searchQuery: '',
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_IDEAS':
      return { ...state, ideas: action.ideas };
    case 'ADD_IDEAS':
      return { ...state, ideas: [...action.ideas, ...state.ideas] };
    case 'DELETE_IDEA': {
      const ideas = state.ideas.filter(i => i.id !== action.id);
      const savedIds = new Set(state.savedIds);
      savedIds.delete(action.id);
      saveIds(savedIds);
      const allSaved = state.allSaved.filter(i => i.id !== action.id);
      setLocalStorage(LS_KEYS.allSaved, allSaved);
      setLocalStorage(LS_KEYS.ideas, ideas);
      return { ...state, ideas, savedIds, allSaved };
    }
    case 'TOGGLE_SAVE': {
      const savedIds = new Set(state.savedIds);
      let allSaved = [...state.allSaved];
      const idea = state.ideas.find(i => i.id === action.id);
      if (savedIds.has(action.id)) {
        savedIds.delete(action.id);
        allSaved = allSaved.filter(i => i.id !== action.id);
      } else {
        savedIds.add(action.id);
        if (idea) allSaved = [idea, ...allSaved];
      }
      saveIds(savedIds);
      setLocalStorage(LS_KEYS.allSaved, allSaved);
      return { ...state, savedIds, allSaved };
    }
    case 'TOGGLE_EXPAND': {
      const ideas = state.ideas.map(i =>
        i.id === action.id ? { ...i, expanded: !i.expanded } : i
      );
      return { ...state, ideas };
    }
    case 'SET_SORT':
      return { ...state, sortMode: action.sortMode };
    case 'SET_VIEW':
      return { ...state, currentView: action.view };
    case 'SET_GENERATING':
      return { ...state, generating: action.generating };
    case 'SET_API_KEY': {
      const apiKeys = { ...state.apiKeys, [action.provider]: action.key };
      setLocalStorage(LS_KEYS.apiKeys, apiKeys);
      return { ...state, apiKeys };
    }
    case 'SET_ACTIVE_PROVIDER':
      setLocalStorage(LS_KEYS.activeProvider, action.provider);
      return { ...state, activeProvider: action.provider };
    case 'SET_ACTIVE_MODEL':
      setLocalStorage(LS_KEYS.activeModel, action.model);
      return { ...state, activeModel: action.model };
    case 'SET_REPO_POOL':
      return { ...state, repoPool: action.repos };
    case 'SET_STARRED_REPOS':
      setLocalStorage(LS_KEYS.starredRepos, action.repos);
      return { ...state, starredRepos: action.repos, starredUser: action.user };
    case 'SET_MANUAL_REPOS':
      setLocalStorage(LS_KEYS.manualRepos, action.repos);
      return { ...state, manualRepos: action.repos };
    case 'SET_CACHED_REPOS':
      return { ...state, cachedRepos: action.data };
    case 'SET_BUILD_PROMPT':
      return { ...state, buildPromptText: action.text };
    case 'SET_SEARCH':
      return { ...state, searchQuery: action.query };
    case 'SET_CURRENT_VIEW':
      return { ...state, currentView: action.view };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
}>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    setLocalStorage(LS_KEYS.ideas, state.ideas);
  }, [state.ideas]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Context files legitimately export both provider and hook
// eslint-disable-next-line react-refresh/only-export-components
export function useAppState() {
  return useContext(AppContext);
}
