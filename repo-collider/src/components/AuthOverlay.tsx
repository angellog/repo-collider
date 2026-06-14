import { useState } from 'react';
import { login, register } from '../api';

interface Props {
  onAuth: (token: string, user: { id: string; email: string }) => void;
}

export default function AuthOverlay({ onAuth }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!loginEmail || !loginPassword) { setError('Fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const data = await login(loginEmail, loginPassword);
      onAuth(data.token, data.user);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Login failed'); }
    setLoading(false);
  }

  async function handleRegister() {
    if (!registerEmail || !registerPassword) { setError('Fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const data = await register(registerEmail, registerPassword);
      onAuth(data.token, data.user);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Registration failed'); }
    setLoading(false);
  }

  return (
    <div id="auth-overlay" style={{ display: 'flex' }}>
      <div className="auth-card">
        <div className="logo" style={{ justifyContent: 'center', marginBottom: 16 }}>
          <div className="logo-icon">⚡</div>
          Repo&nbsp;Collider
        </div>
        <div className="auth-tabs">
          <button className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Login</button>
          <button className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Register</button>
        </div>
        <div id="auth-forms">
          {tab === 'login' ? (
            <div className="auth-form">
              <input className="auth-input" type="email" placeholder="Email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <input className="auth-input" type="password" placeholder="Password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              <button className="auth-btn" onClick={handleLogin} disabled={loading}>{loading ? 'Logging in…' : 'Login'}</button>
            </div>
          ) : (
            <div className="auth-form">
              <input className="auth-input" type="email" placeholder="Email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
              <input className="auth-input" type="password" placeholder="Password (6+ chars)" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />
              <button className="auth-btn" onClick={handleRegister} disabled={loading}>{loading ? 'Registering…' : 'Register'}</button>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--dim)', textAlign: 'center' }}>⚡ 100 accounts only · first come first serve</div>
      </div>
    </div>
  );
}
