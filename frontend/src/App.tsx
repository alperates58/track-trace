import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Scan } from './pages/Scan';
import { Cartons } from './pages/Cartons';
import { Pallets } from './pages/Pallets';
import { PublicBarcodeSearch } from './pages/PublicBarcodeSearch';
import { TraceabilityCenter } from './pages/TraceabilityCenter';
import { DataMatrixCreator } from './pages/DataMatrixCreator';
import { SystemInfo } from './pages/SystemInfo';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import { 
  LayoutDashboard, 
  FileText, 
  Barcode, 
  Inbox, 
  Layers, 
  Search, 
  Settings, 
  LogOut, 
  User as UserIcon,
  Users as UsersIcon,
  Package,
  Menu,
  QrCode,
  BarChart3,
  ChevronDown,
  Bell
} from 'lucide-react';

const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'orders':
        return <Orders />;
      case 'scan':
        return <Scan />;
      case 'cartons':
        return <Cartons />;
      case 'pallets':
        return <Pallets />;
      case 'traceability':
        return <TraceabilityCenter />;
      case 'dm-creator':
        return <DataMatrixCreator />;
      case 'reports':
        return <Reports />;
      case 'users':
        return <Users />;
      case 'system':
        return <SystemInfo />;
      default:
        return <Dashboard />;
    }
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileOpen(false);
  };

  return (
    <div className="app-container">
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <Package size={28} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span>TrackTrace</span>
        </div>
        
        <div className="sidebar-scrollable" style={{ flex: 1, overflowY: 'auto' }}>
          <nav className="sidebar-nav">
            <div className="sidebar-section">
              <span className="sidebar-section-title">Operations</span>
              <div 
                className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => handleTabClick('dashboard')}
                title="Dashboard"
              >
                <LayoutDashboard size={18} style={{ flexShrink: 0 }} />
                <span>Dashboard</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => handleTabClick('orders')}
                title="Sipariş Yönetimi"
              >
                <FileText size={18} style={{ flexShrink: 0 }} />
                <span>Sipariş Yönetimi</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'scan' ? 'active' : ''}`}
                onClick={() => handleTabClick('scan')}
                title="Ürün Okutma (Scan)"
              >
                <Barcode size={18} style={{ flexShrink: 0 }} />
                <span>Ürün Okutma (Scan)</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'cartons' ? 'active' : ''}`}
                onClick={() => handleTabClick('cartons')}
                title="Koli Yönetimi"
              >
                <Inbox size={18} style={{ flexShrink: 0 }} />
                <span>Koli Yönetimi</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'pallets' ? 'active' : ''}`}
                onClick={() => handleTabClick('pallets')}
                title="Palet Yönetimi"
              >
                <Layers size={18} style={{ flexShrink: 0 }} />
                <span>Palet Yönetimi</span>
              </div>
            </div>

            <div className="sidebar-section" style={{ marginTop: '24px' }}>
              <span className="sidebar-section-title">Intelligence</span>
              <div 
                className={`sidebar-link ${activeTab === 'traceability' ? 'active' : ''}`}
                onClick={() => handleTabClick('traceability')}
                title="İzlenebilirlik Merkezi"
              >
                <Search size={18} style={{ flexShrink: 0 }} />
                <span>İzlenebilirlik Merkezi</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => handleTabClick('reports')}
                title="Raporlama"
              >
                <BarChart3 size={18} style={{ flexShrink: 0 }} />
                <span>Raporlama</span>
              </div>

              <div 
                className={`sidebar-link ${activeTab === 'dm-creator' ? 'active' : ''}`}
                onClick={() => handleTabClick('dm-creator')}
                title="DataMatrix Üretici"
              >
                <QrCode size={18} style={{ flexShrink: 0 }} />
                <span>DataMatrix Üretici</span>
              </div>
            </div>

            {user?.role === 'Admin' && (
              <div className="sidebar-section" style={{ marginTop: '24px' }}>
                <span className="sidebar-section-title">Administration</span>
                <div 
                  className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => handleTabClick('users')}
                  title="Kullanıcı Yönetimi"
                >
                  <UsersIcon size={18} style={{ flexShrink: 0 }} />
                  <span>Kullanıcı Yönetimi</span>
                </div>
                <div 
                  className={`sidebar-link ${activeTab === 'system' ? 'active' : ''}`}
                  onClick={() => handleTabClick('system')}
                  title="Sistem Bilgisi"
                >
                  <Settings size={18} style={{ flexShrink: 0 }} />
                  <span>Sistem Bilgisi</span>
                </div>
              </div>
            )}
          </nav>
        </div>
 
        {/* User Profile Card */}
        <div className="sidebar-user-card">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
            <span className="user-status-dot"></span>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role === 'Admin' ? 'Yönetici' : user?.role === 'Operator' ? 'Operatör' : 'İzleyici'}</span>
          </div>
          <button className="user-menu-btn" onClick={logout} title="Çıkış Yap">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Page Layout */}
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setIsMobileOpen(!isMobileOpen);
                } else {
                  setIsCollapsed(!isCollapsed);
                }
              }}
              className="header-toggle-btn"
              title={isCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
            >
              <Menu size={20} />
            </button>
            <div className="header-title-area">
              <span className="header-breadcrumb">TrackTrace / {activeTab === 'dashboard' ? 'Operations' : activeTab === 'users' || activeTab === 'system' ? 'Administration' : 'Module'}</span>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', margin: 0, color: 'var(--text-main)' }}>
                {activeTab === 'traceability' ? 'İzlenebilirlik Merkezi' : activeTab === 'scan' ? 'Ürün Okutma Terminali' : activeTab === 'users' ? 'Kullanıcı Yönetimi' : activeTab === 'dm-creator' ? 'DataMatrix Üretici' : activeTab === 'reports' ? 'Sipariş Bazlı Raporlama' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h2>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="system-status-badge">
              <span className="status-dot-pulse"></span>
              API Online
            </div>
          </div>
        </header>

        <main className="page-wrapper">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { isAuthenticated } = useAuth();
  
  // Bypass authentication if code parameter is present in the URL (for public customer QR scan)
  const params = new URLSearchParams(window.location.search);
  const publicCode = params.get('code') || params.get('sscc');
  
  if (publicCode) {
    return <PublicBarcodeSearch code={publicCode} />;
  }

  return isAuthenticated ? <AppShell /> : <Login />;
};

const VersionChecker: React.FC = () => {
  const [showBanner, setShowBanner] = React.useState(false);
  const [serverVersion, setServerVersion] = React.useState<any>(null);

  React.useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }

    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        
        if (typeof __APP_VERSION_INFO__ !== 'undefined' && data && data.version) {
          if (data.version !== __APP_VERSION_INFO__.version) {
            setServerVersion(data);
            setShowBanner(true);
          }
        }
      } catch (err) {
        console.warn('Failed to check application version:', err);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 600 * 1000); // Check every 10 minutes
    return () => clearInterval(interval);
  }, []);

  if (!showBanner) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      backgroundColor: 'rgba(30, 41, 59, 0.95)',
      color: '#f8fafc',
      padding: '16px 20px',
      borderRadius: '12px',
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
      border: '1px solid #3b82f6',
      zIndex: 99999,
      fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      maxWidth: '400px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      backdropFilter: 'blur(8px)',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '50%',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          flexShrink: 0
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>Yeni Sürüm Yayınlandı</span>
          <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.4' }}>
            Uygulama arka planda güncellendi. Yeni özellikleri kullanabilmek için sayfayı yenilemeniz önerilir.
          </span>
          {serverVersion?.builtAt && (
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Yayınlanma: {new Date(serverVersion.builtAt).toLocaleString('tr-TR')}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button 
          onClick={() => setShowBanner(false)}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.backgroundColor = '#1e293b'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          Daha Sonra
        </button>
        <button 
          onClick={() => window.location.reload()}
          style={{
            background: '#2563eb',
            border: 'none',
            color: '#fff',
            padding: '6px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          Yenile
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate />
      <VersionChecker />
    </AuthProvider>
  );
};

export default App;
