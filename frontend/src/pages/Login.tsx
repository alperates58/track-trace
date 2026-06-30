import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Package, ShieldCheck, Database } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.post('/api/auth/login', { username, password });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      {/* Left Branding Section (Desktop only) */}
      <div className="login-left">
        <div className="login-branding">
          <div className="login-branding-icon">
            <Package size={48} color="var(--text-white)" />
          </div>
          <h1>TrackTrace Enterprise</h1>
          <p>
            Gelişmiş Aggregation & Koli-Palet Yönetim Sistemi. Üretimden teslimata kadar tam izlenebilirlik ve kontrol.
          </p>
        </div>
      </div>

      {/* Right Login Section */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <span className="login-logo">📦</span>
            <h2>Sisteme Giriş Yapın</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Hesabınıza erişmek için bilgilerinizi girin</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              border: '1px solid var(--danger-border)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '24px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <ShieldCheck size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="username">Kullanıcı Adı</label>
              <input
                className="form-input"
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '32px' }}>
              <label className="form-label" htmlFor="password">Şifre</label>
              <input
                className="form-input"
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', height: '48px', fontSize: '1rem', fontWeight: 600 }}
            >
              {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        {/* Environment Footer Info */}
        <div className="login-footer-info">
          <span><span className="status-dot"></span> Production Environment</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Database size={14} /> API Online</span>
          <span>v0.1.0</span>
        </div>
      </div>
    </div>
  );
};
