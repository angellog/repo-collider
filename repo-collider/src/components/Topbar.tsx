import { useAppState } from '../state';
import { PROVIDERS } from '../providers';
import { getProvider } from '../api';

export default function Topbar() {
  const { state, dispatch } = useAppState();
  const provider = getProvider(state.activeProvider);

  return (
    <div id="topbar">
      <div className="logo">
        <div className="logo-icon">⚡</div>
        Repo<span className="sub">&nbsp;Collider</span>
      </div>

      <div className="nav-tabs">
        <button className={`nav-tab${state.currentView === 'collider' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_VIEW', view: 'collider' })}>
          Collider
        </button>
        <button className={`nav-tab${state.currentView === 'saved' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_VIEW', view: 'saved' })}>
          Saved {state.savedIds.size > 0 && <span className="badge">{state.savedIds.size}</span>}
        </button>
        <button className={`nav-tab${state.currentView === 'stats' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_VIEW', view: 'stats' })}>
          Stats
        </button>
      </div>

      <div id="api-wrap">
        <span id="brain-label">Brain</span>
        <select id="provider-select" value={state.activeProvider} onChange={e => dispatch({ type: 'SET_ACTIVE_PROVIDER', provider: e.target.value })}>
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {provider && provider.models.length > 0 && (
          <select id="model-select" value={state.activeModel || provider.models[0]?.id || ''} onChange={e => dispatch({ type: 'SET_ACTIVE_MODEL', model: e.target.value })}>
            {provider.models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <input id="api-input" type="text" placeholder={provider?.placeholder || 'API key'} value={state.apiKeys[state.activeProvider] || ''}
          onChange={e => dispatch({ type: 'SET_API_KEY', provider: state.activeProvider, key: e.target.value })} />
        <span id="api-status" className={state.apiKeys[state.activeProvider]?.trim()?.length >= 8 ? 'ok' : ''} />
      </div>
    </div>
  );
}
