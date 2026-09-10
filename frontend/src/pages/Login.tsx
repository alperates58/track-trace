import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { 
  Package, 
  AlertCircle, 
  Database, 
  Box, 
  Activity, 
  Shield, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  Sun, 
  Moon, 
  Loader2 
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
            <Package size={40} color="var(--text-white)" />
          </div>
          <div>
            <h1>TrackTrace Enterprise</h1>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 10px',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginTop: '8px'
            }}>
              MES & B2B Aggregation
            </div>
          </div>
          <p>
            Gelişmiş Endüstriyel Aggregation & Koli-Palet Yönetim Sistemi. Üretim hattından lojistik sevkiyata kadar tam izlenebilirlik ve operasyonel kontrol.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <Box size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>Koli-Palet İzlenebilirliği</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>GS1-128 ve SSCC tam uyumlu hiyerarşik aggregation</span>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <Activity size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>Canlı Operasyon Telemetrisi</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Milisaniyelik istasyon veri akışı ve anlık hat kontrolleri</span>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-wrapper">
                <Shield size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>Enterprise Güvenlik & Denetim</span>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Rol bazlı yetkilendirme ve değiştirilemez denetim izi</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px', fontSize: '0.75rem', color: '#64748b' }}>
            Lider Packaging Systems • Industrial MES Platform
          </div>
        </div>
      </div>

      {/* Right Login Section */}
      <div className="login-right">
        {/* Quick Theme Toggle in Corner */}
        <div className="login-theme-toggle">
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-secondary"
            title={`Temayı değiştir (${resolvedTheme === 'dark' ? 'Açık' : 'Koyu'})`}
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <Package size={40} color="var(--primary)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Lock size={16} />
              </div>
              <h2>Sisteme Giriş Yapın</h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              Hesabınıza erişmek için kurumsal bilgilerinizi girin
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              border: '1px solid var(--danger-border)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label 
                className="form-label" 
                htmlFor="username"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <User size={14} style={{ color: 'var(--text-muted)' }} />
                <span>Kullanıcı Adı</span>
              </label>
              <input
                className="form-input"
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                style={{ width: '100%', height: '40px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '26px' }}>
              <label 
                className="form-label" 
                htmlFor="password"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600 }}
              >
                <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                <span>Şifre</span>
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <input
                  className="form-input"
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', height: '40px', paddingRight: '40px', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 'var(--radius-xs)'
                  }}
                  title={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ 
                width: '100%', 
                height: '42px', 
                fontSize: '0.92rem', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <span>Giriş Yap</span>
              )}
            </button>
          </form>
        </div>

        {/* Environment Footer Info */}
        <div className="login-footer-info">
          <span><span className="status-dot"></span> Production Environment</span>
          <span className="footer-divider"></span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Database size={13} /> API Online
          </span>
          <span className="footer-divider"></span>
          <span className="font-mono tabular-nums">v0.1.0</span>
        </div>
      </div>
    </div>
  );
};
