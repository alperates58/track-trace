import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Scan } from './pages/Scan';
import { Cartons } from './pages/Cartons';
import { Pallets } from './pages/Pallets';
import { BarcodeSearch } from './pages/BarcodeSearch';
import { Reports } from './pages/Reports';
import { DataMatrixCreator } from './pages/DataMatrixCreator';
import { SystemInfo } from './pages/SystemInfo';
import { Users } from './pages/Users';
import { 
  LayoutDashboard, 
  FileText, 
  Barcode, 
  Inbox, 
  Layers, 
  Search, 
  Printer, 
  Settings, 
  LogOut, 
  User as UserIcon,
  Users as UsersIcon,
  Package,
  Menu,
  QrCode
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
      case 'search':
        return <BarcodeSearch />;
      case 'reports':
        return <Reports />;
      case 'dm-creator':
        return <DataMatrixCreator />;
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
          <Package size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span>Track & Trace</span>
        </div>
        
        <nav className="sidebar-nav">
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

          <div 
            className={`sidebar-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => handleTabClick('search')}
            title="Barkod Sorgulama"
          >
            <Search size={18} style={{ flexShrink: 0 }} />
            <span>Barkod Sorgulama</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => handleTabClick('reports')}
            title="Baskı Geçmişi"
          >
            <Printer size={18} style={{ flexShrink: 0 }} />
            <span>Baskı Geçmişi</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'dm-creator' ? 'active' : ''}`}
            onClick={() => handleTabClick('dm-creator')}
            title="DataMatrix Üretici"
          >
            <QrCode size={18} style={{ flexShrink: 0 }} />
            <span>DataMatrix Üretici</span>
          </div>

          {user?.role === 'Admin' && (
            <>
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
            </>
          )}
        </nav>
 
        {/* Sidebar User Footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-white)' }}>
            <UserIcon size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{user?.name}</span>
          </div>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>
            {user?.role === 'Admin' ? 'Yönetici' : user?.role === 'Operator' ? 'Operatör' : 'İzleyici'}
          </span>
          <div 
            className="sidebar-link" 
            onClick={logout}
            style={{ padding: '8px 0', marginTop: '12px', borderTop: '1px solid #1e293b', color: '#ef4444', display: 'flex', gap: '8px' }}
          >
            <LogOut size={16} className="logout-icon-only" style={{ flexShrink: 0 }} />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </aside>

      {/* Main Page Layout */}
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', textTransform: 'capitalize' }}>
              {activeTab === 'search' ? 'Barkod Sorgulama' : activeTab === 'scan' ? 'Ürün Okutma Terminali' : activeTab === 'users' ? 'Kullanıcı Yönetimi' : activeTab === 'dm-creator' ? 'DataMatrix Üretici' : activeTab}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span className="online-indicator">Hattı Durumu: <strong style={{ color: 'var(--success)' }}>Çevrimiçi (Online)</strong></span>
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
  return isAuthenticated ? <AppShell /> : <Login />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
};

export default App;
