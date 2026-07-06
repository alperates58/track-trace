import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Scan } from './pages/Scan';
import { Cartons } from './pages/Cartons';
import { Pallets } from './pages/Pallets';
import { PrePrintedScan } from './pages/PrePrintedScan';
import { PublicBarcodeSearch } from './pages/PublicBarcodeSearch';
import { TraceabilityCenter } from './pages/TraceabilityCenter';
import { DataMatrixCreator } from './pages/DataMatrixCreator';
import { SystemInfo } from './pages/SystemInfo';
import { Users } from './pages/Users';
import { Stations } from './pages/Stations';
import { Reports } from './pages/Reports';
import { AuditCenter } from './pages/AuditCenter';
import { PermissionMatrix } from './pages/PermissionMatrix';
import { PrintSettings } from './pages/PrintSettings';
import { 
  LayoutDashboard, 
  FileText, 
  Barcode, 
  Inbox, 
  Layers, 
  Search, 
  Settings, 
  LogOut, 
  Users as UsersIcon,
  Package,
  Menu,
  QrCode,
  BarChart3,
  Shield,
  Key,
  Printer,
  Server
} from 'lucide-react';

const Unauthorized: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px', color: 'var(--text-muted)' }}>
    <Shield size={64} style={{ color: 'var(--danger)', opacity: 0.8 }} />
    <h2 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-main)' }}>Yetkisiz Erişim</h2>
    <p>Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
  </div>
);

const AppShell: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();

  const showUsers = hasPermission('users.view');
  const showStations = hasPermission('stations.view');
  const showAudit = hasPermission('audit.view');
  const showPermissions = hasPermission('permissions.manage') || user?.role === 'Admin';
  const showPrintSettings = hasPermission('system.manage');
  const showSystemInfo = hasPermission('system.view');
  const showAdminMenu = showUsers || showStations || showAudit || showPermissions || showPrintSettings || showSystemInfo;

  const showDashboard = hasPermission('dashboard.view');
  const showOrders = hasPermission('orders.view');
  const showScan = hasPermission('scan.view');
  const showCartons = hasPermission('cartons.view');
  const showPallets = hasPermission('pallets.view');
  const showTraceability = hasPermission('traceability.view');
  const showReports = hasPermission('reports.view');
  const showDmCreator = hasPermission('generator.view');

  const showOpsMenu = showDashboard || showOrders || showScan || showCartons || showPallets;
  const showIntelMenu = showTraceability || showReports || showDmCreator;

  const availableTabs = [
    ...(showDashboard ? ['dashboard'] : []),
    ...(showOrders ? ['orders'] : []),
    ...(showScan ? ['scan'] : []),
    ...(showScan ? ['preprint-scan'] : []),
    ...(showCartons ? ['cartons'] : []),
    ...(showPallets ? ['pallets'] : []),
    ...(showTraceability ? ['traceability'] : []),
    ...(showReports ? ['reports'] : []),
    ...(showDmCreator ? ['dm-creator'] : []),
    ...(showUsers ? ['users'] : []),
    ...(showStations ? ['stations'] : []),
    ...(showAudit ? ['audit'] : []),
    ...(showPermissions ? ['permission-matrix'] : []),
    ...(showPrintSettings ? ['print-settings'] : []),
    ...(showSystemInfo ? ['system'] : [])
  ];

  const [activeTab, setActiveTab] = useState(() => {
    return availableTabs.length > 0 ? availableTabs[0] : 'dashboard';
  });

  const availableTabsStr = availableTabs.join(',');
  useEffect(() => {
    if (!availableTabs.includes(activeTab) && availableTabs.length > 0) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabsStr, activeTab]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return showDashboard ? <Dashboard /> : <Unauthorized />;
      case 'orders':
        return showOrders ? <Orders /> : <Unauthorized />;
      case 'scan':
        return showScan ? <Scan /> : <Unauthorized />;
      case 'preprint-scan':
        return showScan ? <PrePrintedScan /> : <Unauthorized />;
      case 'cartons':
        return showCartons ? <Cartons /> : <Unauthorized />;
      case 'pallets':
        return showPallets ? <Pallets /> : <Unauthorized />;
      case 'traceability':
        return showTraceability ? <TraceabilityCenter /> : <Unauthorized />;
      case 'dm-creator':
        return showDmCreator ? <DataMatrixCreator /> : <Unauthorized />;
      case 'reports':
        return showReports ? <Reports /> : <Unauthorized />;
      case 'users':
        return showUsers ? <Users /> : <Unauthorized />;
      case 'stations':
        return showStations ? <Stations /> : <Unauthorized />;
      case 'system':
        return showSystemInfo ? <SystemInfo /> : <Unauthorized />;
      case 'audit':
        return showAudit ? <AuditCenter /> : <Unauthorized />;
      case 'permission-matrix':
        return showPermissions ? <PermissionMatrix /> : <Unauthorized />;
      case 'print-settings':
        return showPrintSettings ? <PrintSettings /> : <Unauthorized />;
      default:
        return <Unauthorized />;
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
            {showOpsMenu && (
              <div className="sidebar-section">
                <span className="sidebar-section-title">Operations</span>
                {showDashboard && (
                  <div 
                    className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleTabClick('dashboard')}
                    title="Dashboard"
                  >
                    <LayoutDashboard size={18} style={{ flexShrink: 0 }} />
                    <span>Dashboard</span>
                  </div>
                )}

                {showOrders && (
                  <div 
                    className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => handleTabClick('orders')}
                    title="Sipariş Yönetimi"
                  >
                    <FileText size={18} style={{ flexShrink: 0 }} />
                    <span>Sipariş Yönetimi</span>
                  </div>
                )}

                {showScan && (
                  <>
                    <div 
                      className={`sidebar-link ${activeTab === 'scan' ? 'active' : ''}`}
                      onClick={() => handleTabClick('scan')}
                      title="Otomatik Koli Modu (Scan)"
                    >
                      <Barcode size={18} style={{ flexShrink: 0 }} />
                      <span>Otomatik Koli Modu</span>
                    </div>
                    <div 
                      className={`sidebar-link ${activeTab === 'preprint-scan' ? 'active' : ''}`}
                      onClick={() => handleTabClick('preprint-scan')}
                      title="Ön Etiketli Koli Modu"
                    >
                      <Barcode size={18} style={{ flexShrink: 0 }} />
                      <span>Ön Etiketli Koli Modu</span>
                    </div>
                  </>
                )}

                {showCartons && (
                  <div 
                    className={`sidebar-link ${activeTab === 'cartons' ? 'active' : ''}`}
                    onClick={() => handleTabClick('cartons')}
                    title="Koli Yönetimi"
                  >
                    <Inbox size={18} style={{ flexShrink: 0 }} />
                    <span>Koli Yönetimi</span>
                  </div>
                )}

                {showPallets && (
                  <div 
                    className={`sidebar-link ${activeTab === 'pallets' ? 'active' : ''}`}
                    onClick={() => handleTabClick('pallets')}
                    title="Palet Yönetimi"
                  >
                    <Layers size={18} style={{ flexShrink: 0 }} />
                    <span>Palet Yönetimi</span>
                  </div>
                )}
              </div>
            )}

            {showIntelMenu && (
              <div className="sidebar-section" style={{ marginTop: '24px' }}>
                <span className="sidebar-section-title">Intelligence</span>
                {showTraceability && (
                  <div 
                    className={`sidebar-link ${activeTab === 'traceability' ? 'active' : ''}`}
                    onClick={() => handleTabClick('traceability')}
                    title="İzlenebilirlik Merkezi"
                  >
                    <Search size={18} style={{ flexShrink: 0 }} />
                    <span>İzlenebilirlik Merkezi</span>
                  </div>
                )}

                {showReports && (
                  <div 
                    className={`sidebar-link ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => handleTabClick('reports')}
                    title="Raporlama"
                  >
                    <BarChart3 size={18} style={{ flexShrink: 0 }} />
                    <span>Raporlama</span>
                  </div>
                )}

                {showDmCreator && (
                  <div 
                    className={`sidebar-link ${activeTab === 'dm-creator' ? 'active' : ''}`}
                    onClick={() => handleTabClick('dm-creator')}
                    title="DataMatrix Üretici"
                  >
                    <QrCode size={18} style={{ flexShrink: 0 }} />
                    <span>DataMatrix Üretici</span>
                  </div>
                )}
              </div>
            )}

            {showAdminMenu && (
              <div className="sidebar-section" style={{ marginTop: '24px' }}>
                <span className="sidebar-section-title">Administration</span>
                
                {showUsers && (
                  <div 
                    className={`sidebar-link ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => handleTabClick('users')}
                    title="Kullanıcı Yönetimi"
                  >
                    <UsersIcon size={18} style={{ flexShrink: 0 }} />
                    <span>Kullanıcı Yönetimi</span>
                  </div>
                )}

                {showStations && (
                  <div 
                    className={`sidebar-link ${activeTab === 'stations' ? 'active' : ''}`}
                    onClick={() => handleTabClick('stations')}
                    title="İstasyon Yönetimi"
                  >
                    <Server size={18} style={{ flexShrink: 0 }} />
                    <span>İstasyon Yönetimi</span>
                  </div>
                )}

                {showAudit && (
                  <div 
                    className={`sidebar-link ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => handleTabClick('audit')}
                    title="Audit Center"
                  >
                    <Shield size={18} style={{ flexShrink: 0 }} />
                    <span>Audit Center</span>
                  </div>
                )}

                {showPermissions && (
                  <div 
                    className={`sidebar-link ${activeTab === 'permission-matrix' ? 'active' : ''}`}
                    onClick={() => handleTabClick('permission-matrix')}
                    title="Yetki Matrisi"
                  >
                    <Key size={18} style={{ flexShrink: 0 }} />
                    <span>Yetki Matrisi</span>
                  </div>
                )}

                {showPrintSettings && (
                  <div 
                    className={`sidebar-link ${activeTab === 'print-settings' ? 'active' : ''}`}
                    onClick={() => handleTabClick('print-settings')}
                    title="Yazdırma Ayarları"
                  >
                    <Printer size={18} style={{ flexShrink: 0 }} />
                    <span>Yazdırma Ayarları</span>
                  </div>
                )}

                {showSystemInfo && (
                  <div 
                    className={`sidebar-link ${activeTab === 'system' ? 'active' : ''}`}
                    onClick={() => handleTabClick('system')}
                    title="Sistem Bilgisi"
                  >
                    <Settings size={18} style={{ flexShrink: 0 }} />
                    <span>Sistem Bilgisi</span>
                  </div>
                )}
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
                {activeTab === 'traceability' ? 'İzlenebilirlik Merkezi' : activeTab === 'scan' ? 'Otomatik Koli Modu' : activeTab === 'preprint-scan' ? 'Ön Etiketli Koli Modu' : activeTab === 'users' ? 'Kullanıcı Yönetimi' : activeTab === 'stations' ? 'İstasyon Yönetimi' : activeTab === 'dm-creator' ? 'DataMatrix Üretici' : activeTab === 'reports' ? 'Sipariş Bazlı Raporlama' : activeTab === 'permission-matrix' ? 'Yetki Matrisi' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
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
