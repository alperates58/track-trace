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
import { SystemInfo } from './pages/SystemInfo';
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
  Package
} from 'lucide-react';

const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

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
      case 'system':
        return <SystemInfo />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Package size={24} color="var(--primary)" />
          <span>Track & Trace</span>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <FileText size={18} />
            <span>Sipariş Yönetimi</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            <Barcode size={18} />
            <span>Ürün Okutma (Scan)</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'cartons' ? 'active' : ''}`}
            onClick={() => setActiveTab('cartons')}
          >
            <Inbox size={18} />
            <span>Koli Yönetimi</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'pallets' ? 'active' : ''}`}
            onClick={() => setActiveTab('pallets')}
          >
            <Layers size={18} />
            <span>Palet Yönetimi</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <Search size={18} />
            <span>Barkod Sorgulama</span>
          </div>

          <div 
            className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <Printer size={18} />
            <span>Baskı Geçmişi</span>
          </div>

          {user?.role === 'Admin' && (
            <div 
              className={`sidebar-link ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <Settings size={18} />
              <span>Sistem Bilgisi</span>
            </div>
          )}
        </nav>

        {/* Sidebar User Footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-white)' }}>
            <UserIcon size={16} />
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
            <LogOut size={16} />
            <span>Çıkış Yap</span>
          </div>
        </div>
      </aside>

      {/* Main Page Layout */}
      <div className="main-content">
        <header className="header">
          <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', textTransform: 'capitalize' }}>
            {activeTab === 'search' ? 'Barkod Sorgulama' : activeTab === 'scan' ? 'Ürün Okutma Terminali' : activeTab}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span>Hattı Durumu: <strong style={{ color: 'var(--success)' }}>Çevrimiçi (Online)</strong></span>
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
