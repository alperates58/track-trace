import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React render error:', error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  private handleClearCacheAndRefresh = async () => {
    try {
      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // 2. Delete all caches in CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }

      // 3. Clear sessionStorage
      sessionStorage.clear();

      // 4. Safely clear non-essential localStorage items
      const keysToKeep = [
        'tt_token',
        'tt_user',
        'network_printer_ip',
        'network_printer_port',
        'datamatrix_generation_history',
        'tt_print_mode',
        'tt_auto_print'
      ];

      const savedData: Record<string, string | null> = {};
      keysToKeep.forEach(key => {
        savedData[key] = localStorage.getItem(key);
      });

      localStorage.clear();

      keysToKeep.forEach(key => {
        if (savedData[key] !== null) {
          localStorage.setItem(key, savedData[key]!);
        }
      });

      // 5. Force hard reload
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache fully:', err);
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box',
          textAlign: 'center',
          zIndex: 999999
        }}>
          <div style={{
            maxWidth: '500px',
            backgroundColor: '#1e293b',
            borderRadius: '16px',
            padding: '40px 30px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            border: '1px solid #334155'
          }}>
            {/* Warning Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h1 style={{
              fontSize: '24px',
              fontWeight: 800,
              margin: '0 0 12px 0',
              color: '#f1f5f9',
              letterSpacing: '-0.025em'
            }}>
              Bir Hata Oluştu
            </h1>

            <p style={{
              fontSize: '15px',
              color: '#94a3b8',
              lineHeight: '1.6',
              margin: '0 0 24px 0'
            }}>
              Uygulama çalıştırılırken beklenmeyen bir arayüz hatası meydana geldi. Aşağıdaki kurtarma seçeneklerini kullanabilirsiniz.
            </p>

            {this.state.error && (
              <div style={{
                textAlign: 'left',
                backgroundColor: '#0f172a',
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '28px',
                border: '1px solid #334155',
                overflowX: 'auto'
              }}>
                <code style={{
                  fontSize: '13px',
                  color: '#f87171',
                  fontFamily: "monospace",
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {this.state.error.name}: {this.state.error.message}
                </code>
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={this.handleRefresh}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#ffffff',
                  backgroundColor: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
              >
                Sayfayı Yenile
              </button>

              <button
                onClick={this.handleClearCacheAndRefresh}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#94a3b8',
                  backgroundColor: 'transparent',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#f1f5f9';
                  e.currentTarget.style.backgroundColor = '#1e293b';
                  e.currentTarget.style.borderColor = '#475569';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#334155';
                }}
              >
                Önbelleği Temizle ve Yenile
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
